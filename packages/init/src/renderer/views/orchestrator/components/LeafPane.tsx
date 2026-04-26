import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PencilLineIcon } from "lucide-react";
import { useCollection, useDb } from "../../../lib/kyju-react";
import { useRpc } from "../../../lib/providers";
import { useShortcutIframeRegistry } from "../providers/shortcut-forwarder";
import { useFocusOnRequest } from "../../../lib/focus-request";
import { ViewCacheSlot, getCachedIframe } from "../../../lib/view-cache";
import type { PaneNode } from "../pane-ops";
import type { SchemaRoot } from "../../../../../shared/schema";

type SessionItem = SchemaRoot["windowStates"][number]["sessions"][number];
type AgentItem = SchemaRoot["agents"][number];

function useAgentEvents(agent: AgentItem | undefined) {
  const { items: events } = useCollection(agent?.eventLog);
  return useMemo(() => {
    let lastUserPrompt: string | undefined;
    let hasUserMessages = false;
    for (const event of events) {
      if (event.data.kind === "user_prompt") {
        lastUserPrompt = event.data.text;
        hasUserMessages = true;
      }
    }
    return { lastUserPrompt, hasUserMessages };
  }, [events]);
}

const MOVE_THRESHOLD = 4;
const TEAR_OFF_THRESHOLD = 30;

function useTabTearOff(
  onTearOff: (screenX: number, screenY: number) => Promise<string | null>,
) {
  const rpc = useRpc();
  const stateRef = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
    tornOff: boolean;
    previewWindowId: string | null;
    lastScreenX: number;
    lastScreenY: number;
    pendingPos: { screenX: number; screenY: number } | null;
  } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const cancelDrag = useCallback(() => {
    const state = stateRef.current;
    if (state?.previewWindowId) {
      rpc.window.cancelTearOff({ previewWindowId: state.previewWindowId });
    }
    stateRef.current = null;
    cleanupRef.current?.();
  }, [rpc]);

  const onMouseDown = useCallback(
    (ev: React.MouseEvent) => {
      if (ev.button !== 0) return;
      if ((ev.target as HTMLElement).closest("[data-close-btn]")) return;

      stateRef.current = {
        startX: ev.screenX,
        startY: ev.screenY,
        moved: false,
        tornOff: false,
        previewWindowId: null,
        lastScreenX: ev.screenX,
        lastScreenY: ev.screenY,
        pendingPos: null,
      };

      const onMouseMove = async (ev: MouseEvent) => {
        const state = stateRef.current;
        if (!state) return;

        state.lastScreenX = ev.screenX;
        state.lastScreenY = ev.screenY;

        const dx = ev.screenX - state.startX;
        const dy = ev.screenY - state.startY;

        if (
          !state.moved &&
          Math.abs(dx) < MOVE_THRESHOLD &&
          Math.abs(dy) < MOVE_THRESHOLD
        )
          return;
        state.moved = true;

        if (!state.tornOff && Math.abs(dy) < TEAR_OFF_THRESHOLD) return;

        if (!state.tornOff) {
          state.tornOff = true;
          state.pendingPos = { screenX: ev.screenX, screenY: ev.screenY };

          const previewWindowId = await onTearOff(ev.screenX, ev.screenY);
          if (!previewWindowId || !stateRef.current) {
            stateRef.current = null;
            cleanupRef.current?.();
            return;
          }
          state.previewWindowId = previewWindowId;

          if (state.pendingPos) {
            rpc.window.updateDragWindowPosition({
              windowId: previewWindowId,
              screenX: state.pendingPos.screenX,
              screenY: state.pendingPos.screenY,
            });
            state.pendingPos = null;
          }
          return;
        }

        if (state.previewWindowId) {
          rpc.window.updateDragWindowPosition({
            windowId: state.previewWindowId,
            screenX: ev.screenX,
            screenY: ev.screenY,
          });
        } else {
          state.pendingPos = { screenX: ev.screenX, screenY: ev.screenY };
        }
      };

      const onMouseUp = () => {
        const state = stateRef.current;
        if (state?.previewWindowId) {
          rpc.window.finalizeTearOff({
            previewWindowId: state.previewWindowId,
            screenX: state.lastScreenX,
            screenY: state.lastScreenY,
          });
        }
        stateRef.current = null;
        cleanupRef.current?.();
      };

      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") cancelDrag();
      };

      document.body.classList.add("tab-dragging");
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.addEventListener("keydown", onKeyDown);
      cleanupRef.current = () => {
        document.body.classList.remove("tab-dragging");
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.removeEventListener("keydown", onKeyDown);
        cleanupRef.current = null;
      };
    },
    [onTearOff, rpc, cancelDrag],
  );

  const wasDragged = useCallback(() => {
    return stateRef.current?.moved ?? false;
  }, []);

  return { onMouseDown, wasDragged };
}

function PaneTab({
  tabId,
  agents,
  sessions,
  isActive,
  onSwitch,
  onClose,
  onCloseQuiet,
  onContextMenu,
  onTearOff,
  tabRef,
}: {
  tabId: string;
  agents: AgentItem[];
  sessions: SessionItem[];
  isActive: boolean;
  onSwitch: () => void;
  onClose: () => void;
  onCloseQuiet: () => void;
  onContextMenu: () => void;
  onTearOff: (screenX: number, screenY: number) => Promise<string | null>;
  tabRef?: React.Ref<HTMLButtonElement>;
}) {
  const session = useMemo(
    () => sessions.find((s) => s.id === tabId),
    [sessions, tabId],
  );
  const agent = useMemo(() => {
    if (!session) return undefined;
    return agents.find((a) => a.id === session.agentId);
  }, [agents, session]);
  const { lastUserPrompt, hasUserMessages } = useAgentEvents(agent);
  const hasUnread =
    !isActive &&
    session?.lastViewedAt != null &&
    agent?.lastFinishedAt != null &&
    agent.lastFinishedAt > session.lastViewedAt;
  const composerDrafts = useDb((root) => root.plugin.kernel.composerDrafts);
  const hasDraft = useMemo(() => {
    if (!agent?.id) return false;
    const draft = composerDrafts?.[agent.id];
    if (!draft) return false;
    if (draft.chatBlobs?.length) return true;

    // todo: remove this any
    const root = (draft.editorState as any)?.root;
    if (!root?.children?.length) return false;
    for (const block of root.children) {
      if (!block.children?.length) continue;
      for (const inline of (block as any).children) {
        if (inline.type === "linebreak") continue;
        if (inline.type === "text") {
          if (inline.text?.trim()) return true;
        } else return true;
      }
    }
    return false;
  }, [agent?.id, composerDrafts]);
  const title = agent?.title;
  const isGeneratingTitle = title?.kind === "generating";
  const label = useMemo(() => {
    if (title?.kind === "set") return title.value;
    return lastUserPrompt?.replace(/\s+/g, " ").trim() || "New Chat";
  }, [title, lastUserPrompt]);
  const isStreaming = agent?.status === "streaming";
  const [showSweep, setShowSweep] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const { onMouseDown, wasDragged } = useTabTearOff(onTearOff);

  useEffect(() => {
    if (isStreaming) {
      setFadeOut(false);
      setShowSweep(true);
    } else if (showSweep) {
      setFadeOut(true);
      const timer = setTimeout(() => {
        setShowSweep(false);
        setFadeOut(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming]);

  return (
    <button
      ref={tabRef}
      onMouseDown={onMouseDown}
      onClick={() => {
        if (!wasDragged()) onSwitch();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu();
      }}
      className={`group relative flex flex-1 items-center justify-center min-w-[120px] pl-7 pr-3 h-[48px] text-xs whitespace-nowrap overflow-hidden border-l border-r border-b ${
        isActive
          ? "text-(--zenbu-panel-foreground) bg-(--zenbu-panel) border-l-(--zenbu-tab-border) border-r-(--zenbu-tab-border) border-b-transparent"
          : "text-neutral-500 hover:text-neutral-700 hover:bg-black/5 border-l-transparent border-r-transparent border-b-(--zenbu-tab-border)"
      }`}
    >
      {showSweep && (
        <div
          className={`pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden transition-opacity duration-500 ${
            fadeOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="h-full w-[40%] animate-[tab-sweep_2.2s_ease-in-out_infinite] rounded-full bg-linear-to-r from-transparent via-blue-400 to-transparent" />
        </div>
      )}
      <span
        data-close-btn
        onClick={(e) => {
          e.stopPropagation();
          hasUserMessages ? onClose() : onCloseQuiet();
        }}
        className="absolute left-1 flex items-center justify-center w-5 h-5 rounded opacity-0 group-hover:opacity-100 hover:bg-neutral-300 text-neutral-400 hover:text-neutral-700 cursor-pointer text-sm z-10"
      >
        ×
      </span>
      {hasUnread && (
        <span className="mr-1.5 size-[6px] shrink-0 rounded-full bg-blue-500" />
      )}
      {isGeneratingTitle ? (
        <span className="inline-block w-20 h-3 rounded-sm bg-size-[200%_100%] bg-linear-to-r from-neutral-200 via-neutral-100 to-neutral-200 text-shimmer" />
      ) : (
        <span className="truncate text-center">{label}</span>
      )}
      {/* Persisted draft state is not yet reliable, so the pencil indicator is disabled.
          TODO: extract this indicator into a plugin once draft persistence is trustworthy. */}
      {/* {hasDraft && !isActive && (
        <PencilLineIcon className="ml-1 size-3 shrink-0 text-neutral-400" />
      )} */}
    </button>
  );
}

export function LeafPane({
  pane,
  agents,
  sessions,
  registryMap,
  wsPort,
  wsToken,
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
  wsToken: string;
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
  const knownTabIds = useRef<Set<string>>(new Set());
  const shortcutIframes = useShortcutIframeRegistry();

  useEffect(() => {
    return () => {
      for (const tabId of knownTabIds.current) {
        shortcutIframes.unregister(tabId);
      }
    };
  }, [shortcutIframes]);

  const activeTabIdForFocus = pane.activeTabId;
  useFocusOnRequest("active-view", () => {
    if (!activeTabIdForFocus) return;
    const iframe = getCachedIframe(activeTabIdForFocus);
    iframe?.focus();
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
      const iframe = getCachedIframe(pane.activeTabId!);
      iframe?.focus();
    });
  }, [pane.activeTabId]);

  const activeTabIdRef = useRef(pane.activeTabId);
  activeTabIdRef.current = pane.activeTabId;
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== "zenbu-iframe-ready") return;
      const activeId = activeTabIdRef.current;
      if (!activeId) return;
      const iframe = getCachedIframe(activeId);
      if (iframe?.contentWindow === e.source) {
        iframe.focus();
        iframe.contentWindow?.postMessage(
          { type: "zenbu-focus-editor" },
          "*",
        );
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
        <div className="flex items-center bg-(--zenbu-chrome) border-t border-(--zenbu-tab-border) select-none shrink-0">
          <div className="flex items-center min-w-0 flex-1 overflow-x-auto [scrollbar-width:thin] [scrollbar-color:var(--color-neutral-400)_transparent]">
            {pane.tabIds.map((tabId) => (
              <PaneTab
                key={tabId}
                tabId={tabId}
                agents={agents}
                sessions={sessions}
                isActive={tabId === pane.activeTabId}
                onSwitch={() => onSwitchTab(tabId)}
                onClose={() => onCloseTab(tabId)}
                onCloseQuiet={() => onCloseTabQuiet(tabId)}
                onContextMenu={() => onTabContextMenu(tabId)}
                onTearOff={(screenX, screenY) =>
                  onTabTearOff(tabId, screenX, screenY)
                }
                tabRef={(el) => {
                  if (el) tabRefs.current.set(tabId, el);
                  else tabRefs.current.delete(tabId);
                }}
              />
            ))}
          </div>
        </div>
      )}
      <div className="relative flex-1 min-h-0">
        {pane.activeTabId && chatEntry ? (
          tabsToRender.map((tabId) => {
            const session = sessions.find((s) => s.id === tabId);
            // Tabs whose id is `scope:<name>:<nanoid>` route to a
            // non-chat scope. Plugins use this to reserve a tab slot for
            // their own views (e.g. agent-sidebar's "new-agent:" sentinel).
            const scopeMatch = /^scope:([^:]+):/.exec(tabId) ?? (
              tabId.startsWith("new-agent:") ? ["", "new-agent"] : null
            );
            const scope = scopeMatch?.[1] ?? "chat";
            const entry = scope === "chat" ? chatEntry : registryMap.get(scope);
            if (!entry) return null;
            let entryPath = new URL(entry.url).pathname;
            const ownsServer = entryPath === "/" || entryPath === "";
            if (ownsServer) entryPath = "";
            else if (entryPath.endsWith("/")) entryPath = entryPath.slice(0, -1);
            // Aliased views (e.g. "chat") proxy through the kernel's wsPort.
            // Own-server views (e.g. "new-agent") go directly to their
            // plugin's Vite port — the kernel HTTP proxy only routes to core.
            const targetPort = ownsServer ? entry.port : wsPort;
            const agentId = session?.agentId ?? tabId;
            const hostname = tabId.toLowerCase().replace(/[^a-z0-9]/g, "");
            const src = `http://${hostname}.localhost:${targetPort}${entryPath}/index.html?agentId=${encodeURIComponent(agentId)}&wsPort=${wsPort}&wsToken=${encodeURIComponent(wsToken)}&windowId=${encodeURIComponent(windowId)}&paneId=${encodeURIComponent(pane.id)}`;
            knownTabIds.current.add(tabId);
            const isActive = tabId === pane.activeTabId;
            return (
              <ViewCacheSlot
                key={tabId}
                cacheKey={tabId}
                src={src}
                hidden={!isActive}
                onLoad={(win) => shortcutIframes.register(tabId, win)}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  display: isActive ? "block" : "none",
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
