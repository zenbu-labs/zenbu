// The canonical way a renderer declares "I handle shortcut <id> when
// routing rule <when> matches." Works identically inside the orchestrator
// and inside any view iframe — each iframe has its own WebSocket and its
// own EventProvider/KyjuProvider, so the hook filters locally.
//
// The main process emits `shortcut.dispatched` to every connected renderer;
// this hook decides whether *this* renderer is the right one to run the
// handler, based on the `when` predicate and focus state read from Kyju.

import { useEffect, useRef } from "react";
import { useEvents } from "./providers";
import { useDb } from "./kyju-react";

export type ShortcutPredicate =
  | { focused: true; scope?: string }
  | { scope: string; focused?: false }
  | { always: true };

export interface ShortcutHandlerCtx {
  id: string;
  scope: string;
  windowId: string | null;
  paneId: string | null;
}

/**
 * Resolve identity info from the current iframe's URL. Every iframe (and
 * the orchestrator) is loaded with `?windowId=`; `?paneId=` is added by
 * LeafPane when rendering view iframes. Orchestrator has windowId but no
 * paneId.
 */
function useIframeIdentity(): {
  scope: string;
  windowId: string | null;
  paneId: string | null;
} {
  const ref = useRef<{
    scope: string;
    windowId: string | null;
    paneId: string | null;
  } | null>(null);
  if (ref.current) return ref.current;
  const params = new URLSearchParams(window.location.search);
  const viewMatch = window.location.pathname.match(/^\/views\/([^/]+)\//);
  let scope = "unknown";
  if (viewMatch) scope = viewMatch[1]!;
  else if (window.location.pathname.startsWith("/orchestrator/")) {
    scope = "orchestrator";
  }
  ref.current = {
    scope,
    windowId: params.get("windowId"),
    paneId: params.get("paneId"),
  };
  return ref.current;
}

/**
 * Read focused window id from Kyju (main-process OS-level focus). The
 * per-iframe focus check is done via `document.hasFocus()` inside
 * `matchesPredicate` — Kyju's `focusedPaneId` is just the active tab slot,
 * which isn't the same as "the user is actually typing into this iframe".
 */
function useFocusedIds(): { windowId: string | null; paneId: string | null } {
  const focusedWindowId = useDb(
    (root: any) => root.plugin.kernel.focusedWindowId,
  ) as string | null | undefined;
  return { windowId: focusedWindowId ?? null, paneId: null };
}

function matchesPredicate(
  pred: ShortcutPredicate,
  self: {
    scope: string;
    windowId: string | null;
    paneId: string | null;
  },
  focused: { windowId: string | null; paneId: string | null },
): boolean {
  if ("always" in pred && pred.always) return true;

  if ("scope" in pred && pred.scope && !("focused" in pred && pred.focused)) {
    return self.scope === pred.scope;
  }

  if ("focused" in pred && pred.focused) {
    if (!focused.windowId) return false;
    if (self.windowId !== focused.windowId) return false;
    // The Kyju `focusedPaneId` is really "which tab slot is active" — it
    // doesn't track whether the *OS focus* is inside the iframe or on the
    // orchestrator shell. `document.hasFocus()` is the real answer: true iff
    // this frame is what the user is typing into right now.
    if (typeof document !== "undefined" && !document.hasFocus()) return false;
    if (pred.scope && self.scope !== pred.scope) return false;
    return true;
  }

  return false;
}

export interface UseShortcutHandlerArgs {
  id: string;
  when?: ShortcutPredicate;
  handler: (ctx: ShortcutHandlerCtx) => void | Promise<void>;
}

/**
 * Declare a handler for a shortcut id. Runs when the dispatched event
 * matches the routing predicate. Default predicate: `{ focused: true }`.
 */
export function useShortcutHandler(args: UseShortcutHandlerArgs) {
  const events = useEvents();
  const self = useIframeIdentity();
  const focused = useFocusedIds();

  const handlerRef = useRef(args.handler);
  handlerRef.current = args.handler;
  const predicateRef = useRef<ShortcutPredicate>(
    args.when ?? { focused: true },
  );
  predicateRef.current = args.when ?? { focused: true };
  const focusedRef = useRef(focused);
  focusedRef.current = focused;

  useEffect(() => {
    const unsub = (events as any).shortcut.dispatched.subscribe(
      (data: ShortcutHandlerCtx) => {
        if (data.id !== args.id) return;
        const ok = matchesPredicate(
          predicateRef.current,
          self,
          focusedRef.current,
        );
        if (!ok) return;
        try {
          const maybe = handlerRef.current(data);
          if (maybe && typeof (maybe as any).catch === "function") {
            (maybe as Promise<unknown>).catch((err) =>
              console.error(
                `[shortcut-handler] handler for "${args.id}" threw:`,
                err,
              ),
            );
          }
        } catch (err) {
          console.error(
            `[shortcut-handler] handler for "${args.id}" threw:`,
            err,
          );
        }
      },
    );
    return () => unsub();
  }, [events, args.id, self]);
}

/**
 * Convenience for the 90% case: "when this view iframe is focused, handle id".
 * Scope is inferred from the iframe URL.
 */
export function useShortcut(
  id: string,
  handler: (ctx: ShortcutHandlerCtx) => void | Promise<void>,
) {
  const self = useIframeIdentity();
  useShortcutHandler({
    id,
    when: { focused: true, scope: self.scope },
    handler,
  });
}
