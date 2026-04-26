import { useEffect } from "react";
import { useEvents } from "../../../lib/providers";
import { dispatchTokenInsert } from "../lib/token-bus";

/**
 * Renderer bridge between the backend `insert.requested` zenrpc event and
 * the local token-bus. Subscribes once per Composer, filters on agentId
 * (belt-and-suspenders with the main-process focused-active filter), and
 * re-dispatches through the local bus so the `TokenInsertPlugin` (and any
 * other local subscriber) handles it identically to a local paste / picker
 * dispatch.
 *
 * `document.hasFocus()` acts as defense-in-depth — if kernel focus state
 * lags the OS (e.g., user already moved focus off the app), we prefer to
 * drop the live insert and let the caller retry through the persisted
 * path rather than apply it to a composer the user has stopped attending
 * to.
 */
export function InsertBridgePlugin({ agentId }: { agentId: string }) {
  const events = useEvents();
  useEffect(() => {
    const unsub = events.insert.requested.subscribe(
      (data: { sessionId: string; agentId: string; payload: any }) => {
        if (data.agentId !== agentId) return;
        if (typeof document !== "undefined" && !document.hasFocus()) return;
        dispatchTokenInsert({
          sessionId: data.sessionId,
          agentId: data.agentId,
          payload: data.payload,
          source: "rpc",
        });
      },
    );
    return () => unsub();
  }, [events, agentId]);
  return null;
}
