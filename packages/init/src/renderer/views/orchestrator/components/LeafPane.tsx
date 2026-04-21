import { useEffect, useMemo, useRef, useState } from "react";
import { useDb } from "../../../lib/kyju-react";
import { useShortcutIframeRegistry } from "../providers/shortcut-forwarder";
import { useFocusOnRequest } from "../../../lib/focus-request";
import type { PaneNode } from "../pane-ops";
import type { SchemaRoot } from "../../../../../shared/schema";
import { PaneTabStrip } from "./PaneTab";

type SessionItem = SchemaRoot["windowStates"][number]["sessions"][number];
type AgentItem = SchemaRoot["agents"][string];

export function LeafPane({
  pane,
  agents,
  sessions,
  registryMap,
  wsPort,
  windowId,
  onSwitchTab,
  onCloseTab,
  onCloseTabQuiet,
  onTabContextMenu,
  onTabTearOff,
  onNewTab,
}: {
  pane: PaneNode;
  agents: AgentItem[];
  sessions: SessionItem[];
  registryMap: Map<string, { scope: string; url: string; port: number }>;
  wsPort: number;
  windowId: string;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseTabQuiet: (tabId: string) => void;
  onTabContextMenu: (tabId: string) => void;
  onTabTearOff: (
    tabId: string,
    screenX: number,
    screenY: number,
  ) => Promise<string | null>;
  onNewTab: () => void;
}) {
  const chatEntry = registryMap.get("chat");
  const showHeader = pane.tabIds.length > 1;
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const shortcutIframes = useShortcutIframeRegistry();

  useEffect(() => {
    return () => {
      for (const tabId of iframeRefs.current.keys()) {
        shortcutIframes.unregister(tabId);
      }
    };
  }, [shortcutIframes]);

  const activeTabIdForFocus = pane.activeTabId;
  useFocusOnRequest("active-view", () => {
    if (!activeTabIdForFocus) return;
    const iframe = iframeRefs.current.get(activeTabIdForFocus);
    iframe?.focus();
    // Also nudge focus into the iframe's document so keydowns route there.
    iframe?.contentWindow?.focus();
  });

  const [visitedTabIds, setVisitedTabIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!pane.activeTabId) return;
    setVisitedTabIds((prev) => {
      if (prev.has(pane.activeTabId!)) return prev;
      return new Set([...prev, pane.activeTabId!]);
    });
    requestAnimationFrame(() => {
      const el = tabRefs.current.get(pane.activeTabId!);
      el?.scrollIntoView({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
      const iframe = iframeRefs.current.get(pane.activeTabId!);
      iframe?.focus();
    });
  }, [pane.activeTabId]);

  // TODO: this will be removed when focus system is implemented
  const activeTabIdRef = useRef(pane.activeTabId);
  activeTabIdRef.current = pane.activeTabId;
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== "zenbu-iframe-ready") return;
      for (const [tabId, iframe] of iframeRefs.current) {
        if (
          iframe.contentWindow === e.source &&
          tabId === activeTabIdRef.current
        ) {
          iframe.focus();
          iframe.contentWindow?.postMessage(
            { type: "zenbu-focus-editor" },
            "*",
          );
          break;
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const tabsToRender = useMemo(
    () => pane.tabIds.filter((id) => visitedTabIds.has(id)),
    [pane.tabIds, visitedTabIds],
  );

  const chatPath = chatEntry ? new URL(chatEntry.url).pathname : "";

  return (
    <div className="flex h-full flex-col min-h-0 min-w-0">
      {showHeader && (
        <PaneTabStrip
          tabIds={pane.tabIds}
          activeTabId={pane.activeTabId}
          agents={agents}
          sessions={sessions}
          onSwitchTab={onSwitchTab}
          onCloseTab={onCloseTab}
          onCloseTabQuiet={onCloseTabQuiet}
          onTabContextMenu={onTabContextMenu}
          onTabTearOff={onTabTearOff}
          tabRefs={tabRefs}
        />
      )}
      <div className="relative flex-1 min-h-0">
        {pane.activeTabId && chatEntry ? (
          tabsToRender.map((tabId) => {
            const session = sessions.find((s) => s.id === tabId);
            const agentId = session?.agentId ?? tabId;
            const hostname = tabId.toLowerCase().replace(/[^a-z0-9]/g, "");
            return (
              <iframe
                key={tabId}
                ref={(el) => {
                  if (el) iframeRefs.current.set(tabId, el);
                  else iframeRefs.current.delete(tabId);
                }}
                onLoad={(e) => {
                  const win = (e.currentTarget as HTMLIFrameElement)
                    .contentWindow;
                  if (win) shortcutIframes.register(tabId, win);
                }}
                // src={`${chatEntry.url}/index.html?agentId=${agentId}&wsPort=${wsPort}`}
                src={`http://${hostname}.localhost:${wsPort}${chatPath}/index.html?agentId=${agentId}&wsPort=${wsPort}&windowId=${encodeURIComponent(windowId)}&paneId=${encodeURIComponent(pane.id)}`}
                className="border-none"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  display: tabId !== pane.activeTabId ? "none" : "block",
                }}
              />
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-400 text-xs">
            Empty pane
          </div>
        )}
      </div>
    </div>
  );
}
