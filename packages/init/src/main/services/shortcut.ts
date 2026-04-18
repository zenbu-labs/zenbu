import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";
import { RpcService } from "./rpc";
import { registerContentScript } from "./advice-config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPTURE_SCRIPT_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "renderer",
  "lib",
  "shortcut-capture.ts",
);

export interface ShortcutDefinition {
  id: string;
  defaultBinding: string;
  description: string;
  scope?: string;
  handler?: (ctx: DispatchContext) => void | Promise<void>;
}

export interface DispatchContext {
  id: string;
  scope: string;
  windowId: string | null;
  paneId: string | null;
}

interface ShortcutEntry {
  id: string;
  defaultBinding: string;
  description: string;
  scope: string;
  handler?: (ctx: DispatchContext) => void | Promise<void>;
}

export class ShortcutService extends Service {
  static key = "shortcut";
  static deps = { db: DbService, rpc: RpcService };
  declare ctx: { db: DbService; rpc: RpcService };

  private entries = new Map<string, ShortcutEntry>();

  /**
   * Register a shortcut. Call from a service's `evaluate()`, wrap the returned
   * unregister fn in an `effect(...)` cleanup so HMR unregisters cleanly.
   */
  register(def: ShortcutDefinition): () => void {
    if (this.entries.has(def.id)) {
      throw new Error(
        `[shortcut] duplicate registration for "${def.id}" — shortcuts must have unique ids`,
      );
    }
    const entry: ShortcutEntry = {
      id: def.id,
      defaultBinding: def.defaultBinding,
      description: def.description,
      scope: def.scope ?? "global",
      handler: def.handler,
    };
    this.entries.set(def.id, entry);
    void this.syncRegistryToDb();
    console.log(
      `[shortcut] registered "${entry.id}" (${entry.defaultBinding}) scope=${entry.scope}`,
    );
    return () => {
      if (this.entries.get(def.id) === entry) {
        this.entries.delete(def.id);
        void this.syncRegistryToDb();
        console.log(`[shortcut] unregistered "${def.id}"`);
      }
    };
  }

  /**
   * RPC: settings UI writes a user-chosen binding. Pass `null` to clear the
   * override and fall back to the default.
   */
  async setBinding(id: string, binding: string | null): Promise<{ ok: boolean }> {
    const client = this.ctx.db.client;
    await Effect.runPromise(
      client.update((root) => {
        const overrides = root.plugin.kernel.shortcutOverrides ?? {};
        if (binding === null) {
          delete overrides[id];
        } else {
          overrides[id] = binding;
        }
        root.plugin.kernel.shortcutOverrides = overrides;
      }),
    );
    return { ok: true };
  }

  /** RPC: disable a shortcut (no binding fires it). Enable via `enable(id)`. */
  async disable(id: string): Promise<{ ok: boolean }> {
    const client = this.ctx.db.client;
    await Effect.runPromise(
      client.update((root) => {
        const disabled = root.plugin.kernel.shortcutDisabled ?? [];
        if (!disabled.includes(id)) {
          root.plugin.kernel.shortcutDisabled = [...disabled, id];
        }
      }),
    );
    return { ok: true };
  }

  async enable(id: string): Promise<{ ok: boolean }> {
    const client = this.ctx.db.client;
    await Effect.runPromise(
      client.update((root) => {
        const disabled = root.plugin.kernel.shortcutDisabled ?? [];
        root.plugin.kernel.shortcutDisabled = disabled.filter((x) => x !== id);
      }),
    );
    return { ok: true };
  }

  /**
   * RPC: called by the renderer-side forwarder when a chord resolves to an id.
   * Runs the backend handler (if any) and emits the `shortcut.dispatched`
   * event so frontend `useShortcutHandler` subscribers can react in the
   * right-focused iframe.
   */
  async dispatch(
    id: string,
    scope: string,
    windowId: string | null,
    paneId: string | null,
  ): Promise<{ ok: boolean }> {
    const entry = this.entries.get(id);
    const effectiveScope = entry?.scope ?? scope ?? "global";
    console.log(
      `[shortcut] dispatch "${id}" scope=${effectiveScope} windowId=${windowId} paneId=${paneId}`,
    );

    const ctx: DispatchContext = {
      id,
      scope: effectiveScope,
      windowId,
      paneId,
    };

    if (entry?.handler) {
      try {
        await entry.handler(ctx);
      } catch (err) {
        console.error(`[shortcut] handler for "${id}" threw:`, err);
      }
    }

    try {
      this.ctx.rpc.emit.shortcut.dispatched({
        id,
        scope: effectiveScope,
        windowId,
        paneId,
        ts: Date.now(),
      });
    } catch (err) {
      console.error(`[shortcut] emit failed for "${id}":`, err);
    }

    return { ok: true };
  }

  /**
   * In-memory lookup — used by other services that want to introspect the
   * current registry (e.g., a future command palette).
   */
  _get(id: string): ShortcutEntry | undefined {
    return this.entries.get(id);
  }

  _list(): ShortcutEntry[] {
    return [...this.entries.values()];
  }

  evaluate() {
    this.effect("content-script", () => {
      const remove = registerContentScript("*", CAPTURE_SCRIPT_PATH);
      console.log(
        "[shortcut] registered capture content script:",
        CAPTURE_SCRIPT_PATH,
      );
      return remove;
    });

    // Don't clear kyju registry on teardown — dependents re-register during
    // the same reconcile cycle and re-populate it. Emptying the DB mid-HMR
    // races with `useShortcutHandler` subscribers.
  }

  private async syncRegistryToDb(): Promise<void> {
    const client = this.ctx.db.client;
    const snapshot = [...this.entries.values()].map((e) => ({
      id: e.id,
      defaultBinding: e.defaultBinding,
      description: e.description,
      scope: e.scope,
    }));
    await Effect.runPromise(
      client.update((root) => {
        root.plugin.kernel.shortcutRegistry = snapshot;
      }),
    ).catch((err) => {
      console.error("[shortcut] failed to sync registry to db:", err);
    });
  }
}

runtime.register(ShortcutService, (import.meta as any).hot);
