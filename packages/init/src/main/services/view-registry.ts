import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import * as Effect from "effect/Effect";
import { Service, runtime } from "../runtime";
import { ReloaderService, type ReloaderEntry } from "./reloader";
import { DbService } from "./db";

interface ViewEntry {
  scope: string;
  url: string;
  port: number;
  ownsServer: boolean;
  workspaceId?: string;
  meta?: { kind?: string; sidebar?: boolean };
}

export class ViewRegistryService extends Service {
  static key = "view-registry";
  static deps = { reloader: ReloaderService, db: DbService };
  declare ctx: { reloader: ReloaderService; db: DbService };

  private views = new Map<string, ViewEntry>();
  private manifestIcons = new Map<string, string>();

  async register(
    scope: string,
    root: string,
    configFile?: string | false,
    meta?: { kind?: string; sidebar?: boolean },
  ): Promise<ViewEntry> {
    const existing = this.views.get(scope);
    if (existing) return existing;

    const ws = runtime.getActiveScope() ?? undefined;
    const reloaderEntry = await this.ctx.reloader.create(
      scope,
      root,
      configFile,
    );
    const entry: ViewEntry = {
      scope,
      url: reloaderEntry.url,
      port: reloaderEntry.port,
      ownsServer: true,
      workspaceId: ws,
      meta,
    };
    this.views.set(scope, entry);
    await this.syncToDb();
    console.log(`[view-registry] registered "${scope}" at ${entry.url} wsId=${ws ?? "global"} sidebar=${meta?.sidebar ?? false}`);
    return entry;
  }

  registerAlias(
    scope: string,
    reloaderId: string,
    pathPrefix: string,
    meta?: { kind?: string; sidebar?: boolean },
  ): ViewEntry {
    const existing = this.views.get(scope);
    if (existing) return existing;

    const reloaderEntry = this.ctx.reloader.get(reloaderId);
    if (!reloaderEntry)
      throw new Error(
        `Reloader "${reloaderId}" not found for alias "${scope}"`,
      );

    const ws = runtime.getActiveScope() ?? undefined;
    const entry: ViewEntry = {
      scope,
      url: `${reloaderEntry.url}${pathPrefix}`,
      port: reloaderEntry.port,
      ownsServer: false,
      workspaceId: ws,
      meta,
    };
    this.views.set(scope, entry);
    void this.syncToDb();
    console.log(
      `[view-registry] aliased "${scope}" -> ${reloaderId}${pathPrefix} wsId=${ws ?? "global"} sidebar=${meta?.sidebar ?? false}`,
    );
    return entry;
  }

  async unregister(scope: string): Promise<void> {
    const entry = this.views.get(scope);
    if (!entry) return;
    if (entry.ownsServer) {
      await this.ctx.reloader.remove(scope);
    }
    this.views.delete(scope);
    await this.syncToDb();
    console.log(`[view-registry] unregistered "${scope}"`);
  }

  get(scope: string): ViewEntry | undefined {
    return this.views.get(scope);
  }

  evaluate() {
    this.loadManifestIcons();

    this.setup("view-registry-cleanup", () => {
      return async () => {
        for (const [scope, entry] of this.views) {
          if (entry.ownsServer) {
            await this.ctx.reloader.remove(scope);
          }
        }
        this.views.clear();
        await this.syncToDb();
      };
    });
  }

  private loadManifestIcons(): void {
    this.manifestIcons.clear();
    try {
      const configPath = resolveConfigPath();
      if (!fsSync.existsSync(configPath)) return;
      const raw = fsSync.readFileSync(configPath, "utf8");
      const config = parseJsonc(raw) as { plugins?: string[] };
      for (const manifestPath of config.plugins ?? []) {
        try {
          const manifestRaw = fsSync.readFileSync(manifestPath, "utf8");
          const manifest = JSON.parse(manifestRaw);
          const icons: Record<string, string> = manifest.icons ?? {};
          for (const [scope, svg] of Object.entries(icons)) {
            this.manifestIcons.set(scope, svg);
          }
        } catch {}
      }
    } catch {}
  }

  private async syncToDb(): Promise<void> {
    const client = this.ctx.db.effectClient;
    const snapshot = [...this.views.values()].map((e) => ({
      scope: e.scope,
      url: e.url,
      port: e.port,
      icon: this.manifestIcons.get(e.scope),
      workspaceId: e.workspaceId,
      meta: e.meta,
    }));
    console.log(
      `[view-registry] syncToDb entries=[${snapshot.map(s => `${s.scope}(ws=${s.workspaceId ?? "global"},sidebar=${s.meta?.sidebar ?? false})`).join(", ")}]`,
    );
    await Effect.runPromise(
      client.update((root) => {
        root.plugin.kernel.viewRegistry = snapshot;
      }),
    ).catch((err) => {
      console.error("[view-registry] failed to sync to db:", err);
    });
  }
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

runtime.register(ViewRegistryService, (import.meta as any).hot);
