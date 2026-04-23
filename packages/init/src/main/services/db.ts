import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import type { WebSocket } from "ws";
import { createDb, type Db, type SectionConfig } from "@zenbu/kyju";
import type { KyjuError, EffectFieldNode, FieldNode } from "@zenbu/kyju";
import type * as Effect from "effect/Effect";
import { createRouter, dbStringify, dbParse } from "@zenbu/kyju/transport";
import type { DbRoot } from "#registry/db-sections";
//
import { Service, runtime } from "../runtime";
import { trace as traceSpan } from "../../../shared/tracer";
import { HttpService } from "./http";

type EffectSectionProxy<S> = {
  [K in keyof S]: EffectFieldNode<S[K]>;
};

type SectionProxy<S> = {
  [K in keyof S]: FieldNode<S[K]>;
};

export type SectionedEffectClient = {
  readRoot(): DbRoot;
  update(fn: (root: DbRoot) => void | DbRoot): Effect.Effect<void, KyjuError>;
  createBlob(data: Uint8Array, hot?: boolean): Effect.Effect<string, KyjuError>;
  deleteBlob(blobId: string): Effect.Effect<void, KyjuError>;
  getBlobData(blobId: string): Effect.Effect<Uint8Array | null, KyjuError>;
  plugin: {
    [K in keyof DbRoot["plugin"]]: EffectSectionProxy<DbRoot["plugin"][K]>;
  };
};

export type SectionedClient = {
  readRoot(): DbRoot;
  update(fn: (root: DbRoot) => void | DbRoot): Promise<void>;
  createBlob(data: Uint8Array, hot?: boolean): Promise<string>;
  deleteBlob(blobId: string): Promise<void>;
  getBlobData(blobId: string): Promise<Uint8Array | null>;
  plugin: {
    [K in keyof DbRoot["plugin"]]: SectionProxy<DbRoot["plugin"][K]>;
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
  // Plain `import()` so dynohot wraps the schema/migrations as live deps of
  // DbService. When these files change, dynohot's file watcher invalidates
  // them and propagates upward via `iterateWithDynamics`; DbService's
  // `runtime.register(..., import.meta.hot)` accept handler re-runs
  // evaluate(), which re-discovers sections and calls createDb with the new
  // migrations array. Kyju's migration plugin then applies only the delta
  // against the existing on-disk DB.
  return import(pathToFileURL(modulePath).href);
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
        if (str[j] === "\\") {
          j += 2;
        } else if (str[j] === '"') {
          j++;
          break;
        } else {
          j++;
        }
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

  // Per-plugin accounting. Each task fills its own entry; push order doesn't
  // matter because we sort before logging.
  const perPluginTimings: Array<{
    name: string;
    manifestMs: number;
    resolveSchemaMs: number;
    importSchemaMs: number;
    resolveMigrationsMs: number;
    importMigrationsMs: number;
    totalMs: number;
  }> = [];

  // Parallelize two axes:
  //   • Across plugins: all manifests process concurrently (outer Promise.all)
  //   • Within a plugin: schema chain and migrations chain overlap
  //
  // The imports are IO-bound (tsx compile, dynohot wrap, JS evaluation). Node's
  // ESM loader handles concurrent imports safely and the V8 compile cache
  // deduplicates work across overlapping compiles of the same file.
  const tasks = config.plugins.map(
    async (manifestPath): Promise<SectionConfig | null> => {
      const pluginStart = Date.now();
      let manifestMs = 0;
      let resolveSchemaMs = 0;
      let importSchemaMs = 0;
      let resolveMigrationsMs = 0;
      let importMigrationsMs = 0;
      let pluginName = path.basename(path.dirname(manifestPath));

      try {
        const t0 = Date.now();
        const raw = await traceSpan(
          "discover:read-manifest",
          () => fs.readFile(manifestPath, "utf8"),
          { parentKey: "db", meta: { plugin: pluginName } },
        );
        manifestMs = Date.now() - t0;

        const manifest = JSON.parse(raw);
        pluginName = manifest.name ?? pluginName;
        if (!manifest.name || !manifest.schema) {
          console.error(
            `[db] skipping manifest without name/schema: ${manifestPath}`,
          );
          return null;
        }

        const baseDir = path.dirname(path.resolve(manifestPath));

        const schemaChain = (async () => {
          const s0 = Date.now();
          const schemaPath = await traceSpan(
            "discover:resolve-schema",
            () => resolveManifestModulePath(baseDir, manifest.schema),
            { parentKey: "db", meta: { plugin: pluginName } },
          );
          resolveSchemaMs = Date.now() - s0;

          const s1 = Date.now();
          const schemaModule = await traceSpan(
            "discover:import-schema",
            () => importFreshModule(schemaPath),
            { parentKey: "db", meta: { plugin: pluginName } },
          );
          importSchemaMs = Date.now() - s1;

          return { schemaPath, schemaModule };
        })();

        const migrationsChain = manifest.migrations
          ? (async () => {
              try {
                const m0 = Date.now();
                const migrationsPath = await traceSpan(
                  "discover:resolve-migrations",
                  () => resolveManifestModulePath(baseDir, manifest.migrations),
                  { parentKey: "db", meta: { plugin: pluginName } },
                );
                resolveMigrationsMs = Date.now() - m0;

                const m1 = Date.now();
                const migModule = await traceSpan(
                  "discover:import-migrations",
                  () => importFreshModule(migrationsPath),
                  { parentKey: "db", meta: { plugin: pluginName } },
                );
                importMigrationsMs = Date.now() - m1;

                return { migModule, failed: false as const };
              } catch (error) {
                console.error(
                  `[db] failed to load migrations from ${manifestPath}: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                );
                return { migModule: null, failed: true as const };
              }
            })()
          : Promise.resolve({
              migModule: null,
              failed: false as const,
            });

        const [schemaResult, migrationsResult] = await Promise.all([
          schemaChain,
          migrationsChain,
        ]);

        if (migrationsResult.failed) return null;

        const schema =
          schemaResult.schemaModule.schema ?? schemaResult.schemaModule.default;
        if (!schema?.shape) {
          console.error(
            `[db] schema module did not export a valid schema: ${schemaResult.schemaPath}`,
          );
          return null;
        }

        const migrations = migrationsResult.migModule
          ? migrationsResult.migModule.migrations ??
            migrationsResult.migModule.default ??
            []
          : [];

        return { name: manifest.name, schema, migrations };
      } catch (error) {
        console.error(
          `[db] failed to load section from ${manifestPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      } finally {
        perPluginTimings.push({
          name: pluginName,
          manifestMs,
          resolveSchemaMs,
          importSchemaMs,
          resolveMigrationsMs,
          importMigrationsMs,
          totalMs: Date.now() - pluginStart,
        });
      }
    },
  );

  const resolvedSections = await Promise.all(tasks);
  // Preserve config.plugins order: Promise.all keeps indices, filter drops
  // failed ones without shuffling.
  const sections: SectionConfig[] = resolvedSections.filter(
    (s): s is SectionConfig => s !== null,
  );

  const sorted = [...perPluginTimings].sort((a, b) => b.totalMs - a.totalMs);
  const sum = (k: keyof (typeof perPluginTimings)[number]) =>
    perPluginTimings.reduce((acc, p) => acc + (p[k] as number), 0);
  console.log("[db.discover] per-plugin breakdown (ms, parallel):");
  console.log(
    `  ${"plugin".padEnd(28)} ${"total".padStart(6)} ${"man".padStart(
      5,
    )} ${"resS".padStart(5)} ${"impS".padStart(6)} ${"resM".padStart(
      5,
    )} ${"impM".padStart(6)}`,
  );
  for (const p of sorted) {
    console.log(
      `  ${p.name.padEnd(28)} ${String(p.totalMs).padStart(6)} ${String(
        p.manifestMs,
      ).padStart(5)} ${String(p.resolveSchemaMs).padStart(5)} ${String(
        p.importSchemaMs,
      ).padStart(6)} ${String(p.resolveMigrationsMs).padStart(5)} ${String(
        p.importMigrationsMs,
      ).padStart(6)}`,
    );
  }
  console.log(
    `  ${"SUM(cpu)".padEnd(28)} ${String(sum("totalMs")).padStart(6)} ${String(
      sum("manifestMs"),
    ).padStart(5)} ${String(sum("resolveSchemaMs")).padStart(5)} ${String(
      sum("importSchemaMs"),
    ).padStart(6)} ${String(sum("resolveMigrationsMs")).padStart(5)} ${String(
      sum("importMigrationsMs"),
    ).padStart(6)}`,
  );
  console.log(
    `  (wall time: look at db.discover-sections span — should be ~max(totalMs) not SUM)`,
  );

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

  get client(): SectionedClient {
    return this.db!.client as unknown as SectionedClient;
  }

  get effectClient(): SectionedEffectClient {
    return this.db!.effectClient as unknown as SectionedEffectClient;
  }

  /**
   * Drain kyju's lagged-persistence queue. Safe to call anytime; idempotent
   * when nothing is pending. Used by service teardown (effect cleanup) so
   * shutdown / hot-reload don't lose in-memory writes.
   */
  async flush(): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.flush();
    } catch (err) {
      console.error("[db] flush failed:", err);
    }
  }

  async getAgentDebugPaths(agentId: string): Promise<{
    agentId: string;
    collectionId: string | null;
    collectionFilePath: string | null;
    lastPageFilePath: string | null;
  }> {
    const kernel = this.client.readRoot().plugin.kernel;
    const agent = kernel.agents.find((a) => a.id === agentId);
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
        lastPageFilePath = this.getPageDataPath(
          collectionId,
          index.activePageId,
        );
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
    const sections = await this.trace("discover-sections", () =>
      discoverSections(),
    );
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
      this.db = await this.trace("create-db", () =>
        createDb({
          sections,
          path: DB_PATH,
          send: (event) => this.dbRouter!.send(event),
        }),
      );
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

    // Flush lagged kyju writes on any teardown (hot-reload OR shutdown).
    // Without this, in-memory writes that haven't yet hit setImmediate's
    // disk write would vanish when the Db instance is replaced/destroyed.
    this.setup("kyju-flush-on-cleanup", () => async () => {
      await this.flush();
    });

    this.setup("ws-transport", () => {
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
