import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import type { WebSocket } from "ws";
import { createDb, type Db, type SectionConfig } from "@zenbu/kyju";
import type { KyjuError, EffectFieldNode } from "@zenbu/kyju";
import type { Effect } from "effect";
import { createRouter, dbStringify, dbParse } from "@zenbu/kyju/transport";
import type { DbRoot } from "#registry/db-sections";
import { Service, runtime } from "../runtime";
import { HttpService } from "./http";

type EffectSectionProxy<S> = {
  [K in keyof S]: EffectFieldNode<S[K]>;
};

export type SectionedEffectClient = {
  readRoot(): DbRoot;
  update(fn: (root: DbRoot) => void | DbRoot): Effect.Effect<void, KyjuError>;
  plugin: {
    [K in keyof DbRoot["plugin"]]: EffectSectionProxy<DbRoot["plugin"][K]>;
  };
};

const DB_PATH = path.join(process.cwd(), ".zenbu", "db");

export async function resolveManifestModulePath(
  baseDir: string,
  specifier: string,
): Promise<string> {
  const resolved = path.resolve(baseDir, specifier);
  const candidates = path.extname(resolved)
    ? [resolved]
    : [
        resolved,
        `${resolved}.ts`,
        `${resolved}.js`,
        `${resolved}.mjs`,
        path.join(resolved, "index.ts"),
        path.join(resolved, "index.js"),
        path.join(resolved, "index.mjs"),
      ];

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // keep trying candidates
    }
  }

  throw new Error(
    `Could not resolve module entry for "${specifier}" from "${baseDir}"`,
  );
}

async function importFreshModule(modulePath: string): Promise<any> {
  const stat = await fs.stat(modulePath);
  // These schema/migration imports happen later inside DbService, so they are
  // not part of the shell's original dynohot-managed module graph. Plain
  // import(fileUrl) would stay cached even if the file changed on disk, so we
  // cache-bust by mtime until section loading is moved into the main hot graph.
  return import(`${pathToFileURL(modulePath).href}?v=${stat.mtimeMs}`);
}

function resolveConfigPath(): string {
  const jsonc = path.join(os.homedir(), ".zenbu", "config.jsonc");
  if (fsSync.existsSync(jsonc)) return jsonc;
  return path.join(os.homedir(), ".zenbu", "config.json");
}

function parseJsonc(str: string): unknown {
  let result = "";
  let i = 0;
  while (i < str.length) {
    if (str[i] === '"') {
      let j = i + 1;
      while (j < str.length) {
        if (str[j] === "\\") { j += 2; }
        else if (str[j] === '"') { j++; break; }
        else { j++; }
      }
      result += str.slice(i, j);
      i = j;
    } else if (str[i] === "/" && str[i + 1] === "/") {
      i += 2;
      while (i < str.length && str[i] !== "\n") i++;
    } else if (str[i] === "/" && str[i + 1] === "*") {
      i += 2;
      while (i < str.length && !(str[i] === "*" && str[i + 1] === "/")) i++;
      i += 2;
    } else {
      result += str[i];
      i++;
    }
  }
  return JSON.parse(result.replace(/,\s*([\]}])/g, "$1"));
}

export async function discoverSections(
  configPath = resolveConfigPath(),
): Promise<SectionConfig[]> {
  let config: { plugins: string[] } = { plugins: [] };
  try {
    const raw = await fs.readFile(configPath, "utf8");
    config = parseJsonc(raw) as { plugins: string[] };
  } catch (error) {
    console.error(
      `[db] failed to read plugin config at ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }

  const sections: SectionConfig[] = [];
  for (const manifestPath of config.plugins) {
    try {
      const raw = await fs.readFile(manifestPath, "utf8");
      const manifest = JSON.parse(raw);
      if (!manifest.name || !manifest.schema) {
        console.error(
          `[db] skipping manifest without name/schema: ${manifestPath}`,
        );
        continue;
      }

      const baseDir = path.dirname(path.resolve(manifestPath));
      const schemaPath = await resolveManifestModulePath(baseDir, manifest.schema);
      const schemaModule = await importFreshModule(schemaPath);
      const schema = schemaModule.schema ?? schemaModule.default;
      if (!schema?.shape) {
        console.error(
          `[db] schema module did not export a valid schema: ${schemaPath}`,
        );
        continue;
      }

      let migrations: any[] = [];
      if (manifest.migrations) {
        try {
          const migrationsPath = await resolveManifestModulePath(
            baseDir,
            manifest.migrations,
          );
          const migModule = await importFreshModule(migrationsPath);
          migrations = migModule.migrations ?? migModule.default ?? [];
        } catch (error) {
          console.error(
            `[db] failed to load migrations from ${manifestPath}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          continue;
        }
      }

      sections.push({ name: manifest.name, schema, migrations });
    } catch (error) {
      console.error(
        `[db] failed to load section from ${manifestPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return sections;
}

export class DbService extends Service {
  static key = "db";
  static deps = { http: HttpService };
  declare ctx: { http: HttpService };

  db: Db | null = null;
  dbRouter: ReturnType<typeof createRouter> | null = null;
  private sectionsHash = "";
  private dbPath = "";

  private getCollectionDir(collectionId: string): string {
    return path.join(DB_PATH, "collections", collectionId);
  }

  private getCollectionIndexPath(collectionId: string): string {
    return path.join(this.getCollectionDir(collectionId), "index.json");
  }

  private getPageDataPath(collectionId: string, pageId: string): string {
    return path.join(
      this.getCollectionDir(collectionId),
      "pages",
      pageId,
      "data.jsonl",
    );
  }

  get client(): SectionedEffectClient {
    return this.db!.effectClient as unknown as SectionedEffectClient;
  }

  async getAgentDebugPaths(agentId: string): Promise<{
    agentId: string;
    collectionId: string | null;
    collectionFilePath: string | null;
    lastPageFilePath: string | null;
  }> {
    const kernel = this.client.readRoot().plugin.kernel;
    const agent = (kernel.agents ?? []).find((entry) => entry.id === agentId);
    const collectionId = agent?.eventLog?.collectionId ?? null;

    if (!collectionId) {
      return {
        agentId,
        collectionId: null,
        collectionFilePath: null,
        lastPageFilePath: null,
      };
    }

    const collectionFilePath = this.getCollectionIndexPath(collectionId);
    let lastPageFilePath: string | null = null;

    try {
      const raw = await fs.readFile(collectionFilePath, "utf8");
      const index = JSON.parse(raw) as { activePageId?: string };
      if (index.activePageId) {
        lastPageFilePath = this.getPageDataPath(collectionId, index.activePageId);
      }
    } catch {
      lastPageFilePath = null;
    }

    return {
      agentId,
      collectionId,
      collectionFilePath,
      lastPageFilePath,
    };
  }

  async evaluate() {
    const sections = await discoverSections();
    const sectionsHash = JSON.stringify(
      sections.map((s) => ({ name: s.name, v: s.migrations.length })),
    );

    if (
      !this.db ||
      this.sectionsHash !== sectionsHash ||
      this.dbPath !== DB_PATH
    ) {
      fsSync.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      this.dbRouter = createRouter();
      this.db = await createDb({
        sections,
        path: DB_PATH,
        send: (event) => this.dbRouter!.send(event),
      });
      this.sectionsHash = sectionsHash;
      this.dbPath = DB_PATH;
      console.log(
        `[db] ready at ${DB_PATH} (sections: ${sections
          .map((s) => `${s.name}@v${s.migrations.length}`)
          .join(", ")})`,
      );
      // 
    }

    const { http } = this.ctx;
    const wsDbConnections = new Map<
      string,
      { receive: (event: any) => Promise<void>; close: () => void }
    >();

    this.effect("ws-transport", () => {
      const onConnected = (id: string, ws: WebSocket) => {
        const dbConn = this.dbRouter!.connection({
          send: (event: any) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(dbStringify({ ch: "db", data: event }));
            }
          },
          postMessage: this.db!.postMessage,
        });
        wsDbConnections.set(id, dbConn);

        ws.on("message", async (raw: Buffer) => {
          const msg = dbParse(String(raw));
          if (msg.ch === "db") {
            await dbConn.receive(msg.data);
          }
        });
      };

      const onDisconnected = (id: string) => {
        const conn = wsDbConnections.get(id);
        if (conn) {
          conn.close();
          wsDbConnections.delete(id);
        }
      };

      const unsubConnected = http.onConnected(onConnected);
      const unsubDisconnected = http.onDisconnected(onDisconnected);

      for (const [id, ws] of http.activeConnections) {
        onConnected(id, ws);
      }

      return () => {
        unsubConnected();
        unsubDisconnected();
        for (const conn of wsDbConnections.values()) conn.close();
        wsDbConnections.clear();
      };
    });
  }
}

runtime.register(DbService, (import.meta as any).hot);
