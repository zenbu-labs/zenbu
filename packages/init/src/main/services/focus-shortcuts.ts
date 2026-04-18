import { Effect } from "effect";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";
import { ShortcutService } from "./shortcut";

/**
 * Default canonical focus shortcuts. Backend handlers write the
 * declarative focus-request directly to Kyju — views subscribing via
 * `useFocusOnRequest` react and call the appropriate DOM focus.
 *
 * This is the "one shortcut, many listeners" pattern: the shortcut dispatch
 * doesn't run view-side code; it just changes state, and views observe it.
 */
export class FocusShortcutsService extends Service {
  static key = "focus-shortcuts";
  static deps = { db: DbService, shortcut: ShortcutService };
  declare ctx: { db: DbService; shortcut: ShortcutService };

  evaluate() {
    this.effect("register:focusOrchestrator", () =>
      this.ctx.shortcut.register({
        id: "kernel.focusOrchestrator",
        defaultBinding: "cmd+shift+o",
        description: "Move focus to the orchestrator shell",
        scope: "global",
        handler: (ctx) => this.writeFocusRequest("orchestrator", ctx.windowId),
      }),
    );

    this.effect("register:focusActiveView", () =>
      this.ctx.shortcut.register({
        id: "kernel.focusActiveView",
        defaultBinding: "cmd+shift+i",
        description: "Move focus into the active view (iframe)",
        scope: "global",
        handler: (ctx) => this.writeFocusRequest("active-view", ctx.windowId),
      }),
    );
  }

  private async writeFocusRequest(
    target: string,
    windowId: string | null,
  ): Promise<void> {
    const client = this.ctx.db.client;
    const nonce = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    await Effect.runPromise(
      client.update((root) => {
        root.plugin.kernel.focusRequestTarget = target;
        root.plugin.kernel.focusRequestWindowId = windowId;
        root.plugin.kernel.focusRequestNonce = nonce;
      }),
    ).catch((err) => {
      console.error("[focus-shortcuts] failed to write focus request:", err);
    });
  }
}

runtime.register(FocusShortcutsService, (import.meta as any).hot);
