// Declarative focus-request channel.
//
// Writers call `requestFocus(selector, { windowId? })` — which just bumps
// three kyju fields under `plugin.kernel.focusRequest*`. Views subscribe via
// `useFocusOnRequest(selector, handler)` — when a new request matches the
// selector (and the windowId matches the iframe's own), the handler runs.
//
// This is deliberately "fire-and-forget broadcast": the channel stores the
// *intent* to move focus, not the current focus state. Every new request
// generates a fresh nonce so the same selector can be requested repeatedly
// and each firing triggers subscribers.
//
// Usage examples:
//   // chat iframe wants focus to move back to orchestrator:
//   const request = useRequestFocus()
//   request("orchestrator")
//
//   // orchestrator listens and calls its own DOM's focus:
//   const rootRef = useRef<HTMLDivElement>(null)
//   useFocusOnRequest("orchestrator", () => rootRef.current?.focus())

import { useCallback, useEffect, useRef } from "react";
import { useDb } from "./kyju-react";
import { useKyjuClient } from "./providers";

export interface FocusRequest {
  target: string;
  windowId: string | null;
}

type Selector =
  | string
  | ((req: FocusRequest, self: { windowId: string | null; scope: string }) => boolean);

function selfIdentity(): { windowId: string | null; scope: string } {
  const params = new URLSearchParams(window.location.search);
  const m = window.location.pathname.match(/^\/views\/([^/]+)\//);
  return {
    windowId: params.get("windowId"),
    scope: m ? m[1]! : "unknown",
  };
}

/**
 * Returns a function that records a declarative focus request in Kyju.
 * Views matching `target` + `windowId` (via `useFocusOnRequest`) will fire
 * their handlers on the next render.
 */
export function useRequestFocus() {
  const client = useKyjuClient();
  return useCallback(
    async (target: string, opts?: { windowId?: string | null }) => {
      const self = selfIdentity();
      const windowId = opts?.windowId === undefined ? self.windowId : opts.windowId;
      const nonce = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      await client.update((root: any) => {
        root.plugin.kernel.focusRequestTarget = target;
        root.plugin.kernel.focusRequestWindowId = windowId;
        root.plugin.kernel.focusRequestNonce = nonce;
      });
    },
    [client],
  );
}

/**
 * Subscribe to focus requests. When a new request matches the selector, the
 * handler runs. The default selector matching is:
 *   - string selector: equal to request.target AND request.windowId is null
 *     OR equals this iframe's windowId
 *   - function selector: called with the request and this iframe's identity
 *
 * The handler typically calls `focus()` on some ref — but it can do anything.
 */
export function useFocusOnRequest(selector: Selector, handler: () => void) {
  const target = useDb(
    (root: any) => root.plugin.kernel.focusRequestTarget,
  ) as string | null | undefined;
  const windowId = useDb(
    (root: any) => root.plugin.kernel.focusRequestWindowId,
  ) as string | null | undefined;
  const nonce = useDb(
    (root: any) => root.plugin.kernel.focusRequestNonce,
  ) as string | undefined;

  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const selfRef = useRef(selfIdentity());
  const lastHandledNonceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!nonce || !target) return;
    if (lastHandledNonceRef.current === nonce) return;

    const req: FocusRequest = {
      target,
      windowId: windowId ?? null,
    };

    let match = false;
    if (typeof selector === "string") {
      const windowMatch =
        req.windowId === null || req.windowId === selfRef.current.windowId;
      match = req.target === selector && windowMatch;
    } else {
      match = selector(req, selfRef.current);
    }

    if (match) {
      lastHandledNonceRef.current = nonce;
      handlerRef.current();
    }
  }, [nonce, target, windowId, selector]);
}
