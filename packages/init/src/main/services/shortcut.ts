import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, webContents, type WebContents } from "electron";
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
  /**
   * If true, also capture this binding at the Electron webContents level via
   * `before-input-event`, so keystrokes are intercepted before any renderer
   * (including embedded iframes like code-server) consumes them. Window-
   * scoped, NOT OS-wide — other apps keep their cmd+t. Default false; leave
   * off unless the shortcut needs to beat a non-zenbu webContents.
   */
  captureAtWebContents?: boolean;
}

export interface DispatchContext {
  id: string;
  /** The registered scope of the binding (static, from `register({ scope })`). */
  scope: string;
  /**
   * Scope as passed by the dispatcher — for iframe-originated keystrokes with
   * a `"global"` binding, this is the origin iframe's scope (e.g. `"chat"`,
   * `"settings"`). Main-process handlers gate on this when they need to know
   * *where the key was actually pressed*, since `scope` is static.
   */
  originScope: string;
  windowId: string | null;
  paneId: string | null;
}

type ParsedBinding = {
  key: string;
  cmd: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
};

interface ShortcutEntry {
  id: string;
  defaultBinding: string;
  description: string;
  scope: string;
  handler?: (ctx: DispatchContext) => void | Promise<void>;
  captureAtWebContents: boolean;
  parsedBinding: ParsedBinding | null;
}

function parseBinding(binding: string): ParsedBinding {
  const toks = binding.split("+").map((t) => t.trim().toLowerCase());
  const b: ParsedBinding = {
    key: "",
    cmd: false,
    ctrl: false,
    alt: false,
    shift: false,
  };
  for (const t of toks) {
    if (t === "cmd" || t === "command" || t === "meta") b.cmd = true;
    else if (t === "ctrl" || t === "control") b.ctrl = true;
    else if (t === "alt" || t === "option") b.alt = true;
    else if (t === "shift") b.shift = true;
    else b.key = t;
  }
  return b;
}

function matchesBinding(b: ParsedBinding, input: Electron.Input): boolean {
  if (!!input.meta !== b.cmd) return false;
  if (!!input.control !== b.ctrl) return false;
  if (!!input.alt !== b.alt) return false;
  if (!!input.shift !== b.shift) return false;
  return input.key.toLowerCase() === b.key;
}

export class ShortcutService extends Service {
  static key = "shortcut";
  static deps = { db: DbService, rpc: RpcService };
  declare ctx: { db: DbService; rpc: RpcService };

  // Re-assigned in `evaluate()` so HMR doesn't strand an old instance missing
  // the field (class-field initializers don't re-run on prototype swap).
  private entries!: Map<string, ShortcutEntry>;
  private lastDispatchedAt!: Map<string, number>;

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
    const captureAtWebContents = def.captureAtWebContents ?? false;
    const entry: ShortcutEntry = {
      id: def.id,
      defaultBinding: def.defaultBinding,
      description: def.description,
      scope: def.scope ?? "global",
      handler: def.handler,
      captureAtWebContents,
      parsedBinding: captureAtWebContents
        ? parseBinding(def.defaultBinding)
        : null,
    };
    this.entries.set(def.id, entry);
    void this.syncRegistryToDb();
    console.log(
      `[shortcut] registered "${entry.id}" (${entry.defaultBinding}) scope=${entry.scope}${captureAtWebContents ? " [wc-capture]" : ""}`,
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
    // Keep the in-memory parsed binding in sync for webContents-capture
    // shortcuts so the matcher sees the new combo on the next keystroke.
    const entry = this.entries.get(id);
    if (entry?.captureAtWebContents) {
      entry.parsedBinding = parseBinding(binding ?? entry.defaultBinding);
    }
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
    // De-dup the dual-capture race: a captureAtWebContents shortcut fired
    // from inside a zenbu iframe can trip both the renderer capture and the
    // main-process before-input-event hook. 50 ms is shorter than a realistic
    // double-press and swallows the echo.
    const now = Date.now();
    const last = this.lastDispatchedAt.get(id) ?? 0;
    if (now - last < 50) return { ok: true };
    this.lastDispatchedAt.set(id, now);

    const entry = this.entries.get(id);
    const effectiveScope = entry?.scope ?? scope ?? "global";
    const originScope = scope ?? effectiveScope;
    console.log(
      `[shortcut] dispatch "${id}" scope=${effectiveScope} origin=${originScope} windowId=${windowId} paneId=${paneId}`,
    );

    const ctx: DispatchContext = {
      id,
      scope: effectiveScope,
      originScope,
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
        originScope,
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
    this.entries ??= new Map<string, ShortcutEntry>();
    this.lastDispatchedAt ??= new Map<string, number>();

    this.effect("content-script", () => {
      const remove = registerContentScript("*", CAPTURE_SCRIPT_PATH);
      console.log(
        "[shortcut] registered capture content script:",
        CAPTURE_SCRIPT_PATH,
      );
      return remove;
    });

    // Window-level keystroke capture. Attaches a single `before-input-event`
    // listener per webContents (current + future). Reads `this.entries` live
    // on each keystroke so individual shortcut register/unregister doesn't
    // need to rebind listeners.
    this.effect("webContents-capture", () => {
      const tracked = new Set<WebContents>();

      const handleInput = (
        event: Electron.Event,
        input: Electron.Input,
      ) => {
        if (input.type !== "keyDown") return;
        for (const entry of this.entries.values()) {
          if (!entry.captureAtWebContents || !entry.parsedBinding) continue;
          if (!matchesBinding(entry.parsedBinding, input)) continue;
          event.preventDefault();
          const focusedWindowId =
            this.ctx.db.client.readRoot().plugin.kernel.focusedWindowId ??
            null;
          void this.dispatch(
            entry.id,
            entry.scope,
            focusedWindowId,
            null,
          );
          return;
        }
      };

      const attach = (wc: WebContents) => {
        if (tracked.has(wc)) return;
        tracked.add(wc);
        wc.on("before-input-event", handleInput);
        wc.once("destroyed", () => tracked.delete(wc));
      };

      for (const wc of webContents.getAllWebContents()) attach(wc);
      const onCreated = (_e: Electron.Event, wc: WebContents) => attach(wc);
      app.on("web-contents-created", onCreated);

      return () => {
        app.off("web-contents-created", onCreated);
        for (const wc of tracked) {
          try {
            wc.off("before-input-event", handleInput);
          } catch {}
        }
        tracked.clear();
      };
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
