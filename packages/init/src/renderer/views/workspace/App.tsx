import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"
import { nanoid } from "nanoid"
import { makeCollection } from "@zenbu/kyju/schema"
import {
  RpcProvider,
  EventsProvider,
  KyjuClientProvider,
  useWsConnection,
} from "@/lib/ws-connection"
import type { WsConnectionState } from "@/lib/ws-connection"
import { KyjuProvider, useDb } from "@/lib/kyju-react"
import { useKyjuClient, useRpc } from "@/lib/providers"
import { ViewCacheSlot } from "@/lib/view-cache"
import { AgentList } from "@/views/orchestrator/components/AgentList"
import {
  type PaneState,
  initPaneState,
  addTabToPane,
  switchTabInPane,
  closeTabInPane,
} from "@/views/orchestrator/pane-ops"
import {
  insertHotAgent,
  validSelectionFromTemplate,
  type ArchivedAgent,
} from "../../../../shared/agent-ops"
import type { SchemaRoot } from "../../../../shared/schema"

type SessionItem = SchemaRoot["windowStates"][number]["sessions"][number]
type AgentItem = SchemaRoot["agents"][number]
type RegistryEntry = {
  scope: string
  url: string
  port: number
  icon?: string
  workspaceId?: string
  meta?: { kind?: string; sidebar?: boolean }
}
type WindowState = SchemaRoot["windowStates"][number]

const params = new URLSearchParams(window.location.search)
const wsPort = Number(params.get("wsPort"))
const wsToken = params.get("wsToken") ?? ""
const windowId = params.get("windowId") ?? ""
const workspaceIdParam = params.get("workspaceId") ?? ""
if (!windowId) throw new Error("Missing ?windowId= in workspace URL")
if (!wsToken) throw new Error("Missing ?wsToken= in workspace URL")

// ---- width stores (localStorage-backed) ----

const AGENT_SIDEBAR_STORAGE_KEY = "agent-sidebar:width"
const UTILITY_SIDEBAR_STORAGE_KEY = "utility-sidebar:width"
const AGENT_MIN = 220
const AGENT_MAX = 500
const AGENT_DEFAULT = 280
const UTIL_MIN = 220
const UTIL_MAX = 720
const UTIL_DEFAULT = 320

function makeWidthStore(
  storageKey: string,
  min: number,
  max: number,
  defaultVal: number,
) {
  const listeners = new Set<() => void>()
  let memo: number | null = null

  function read(): number {
    if (memo !== null) return memo
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw != null) {
        const n = parseInt(raw, 10)
        if (Number.isFinite(n)) {
          memo = Math.max(min, Math.min(max, n))
          return memo
        }
      }
    } catch {}
    memo = defaultVal
    return memo
  }
  function get(): number { return read() }
  function set(next: number) {
    const clamped = Math.max(min, Math.min(max, Math.round(next)))
    if (clamped === memo) return
    memo = clamped
    try { localStorage.setItem(storageKey, String(clamped)) } catch {}
    for (const l of listeners) l()
  }
  function useWidth(): number {
    return useSyncExternalStore(
      (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
      read,
      read,
    )
  }
  return { get, set, useWidth }
}

const agentWidthStore = makeWidthStore(
  AGENT_SIDEBAR_STORAGE_KEY,
  AGENT_MIN,
  AGENT_MAX,
  AGENT_DEFAULT,
)
const utilWidthStore = makeWidthStore(
  UTILITY_SIDEBAR_STORAGE_KEY,
  UTIL_MIN,
  UTIL_MAX,
  UTIL_DEFAULT,
)

// ---- main view ----

function WorkspaceContent() {
  const client = useKyjuClient()
  const rpc = useRpc()

  const windowState = useDb((root) =>
    root.plugin.kernel.windowStates?.find((w) => w.id === windowId),
  )
  const sessions = windowState?.sessions ?? []

  const agents = useDb((root) => root.plugin.kernel.agents) ?? []

  const registry = useDb((root) => root.plugin.kernel.viewRegistry) ?? []
  const registryMap = useMemo(() => {
    const m = new Map<string, RegistryEntry>()
    for (const e of registry) m.set(e.scope, e)
    return m
  }, [registry])

  const workspace = useDb((root) =>
    root.plugin.kernel.workspaces?.find((w) => w.id === workspaceIdParam),
  )
  const workspaceCwds = workspace?.cwds ?? []

  const sidebarOpen = useDb((root) => {
    const map = root.plugin.kernel.sidebarOpenByWindow
    const v = map?.[windowId]
    return typeof v === "boolean" ? v : true
  })

  const utilSelected = useDb(
    (root) => root.plugin.kernel.utilitySidebarSelectedByWindow?.[windowId],
  )

  const sidebarEntries = useMemo<RegistryEntry[]>(() => {
    const all = registry.filter((e) => e.meta?.sidebar === true)
    const filtered = all.filter((e) =>
      !e.workspaceId || e.workspaceId === workspaceIdParam,
    )
    console.log(
      `[workspace-view] sidebar filter: wsId=${workspaceIdParam} allSidebar=[${all.map(e => `${e.scope}(ws=${e.workspaceId ?? "global"})`).join(",")}] shown=[${filtered.map(e => e.scope).join(",")}]`,
    )
    return filtered
  }, [registry, workspaceIdParam])
  const selectedUtilEntry = useMemo(
    () => sidebarEntries.find((e) => e.scope === utilSelected),
    [sidebarEntries, utilSelected],
  )

  const paneState: PaneState = useMemo(
    () => ({
      panes: windowState?.panes ?? [],
      rootPaneId: windowState?.rootPaneId ?? null,
      focusedPaneId: windowState?.focusedPaneId ?? null,
    }),
    [windowState?.panes, windowState?.rootPaneId, windowState?.focusedPaneId],
  )
  const rootPane = useMemo(
    () =>
      paneState.panes.find(
        (p) => p.id === paneState.rootPaneId && p.type === "leaf",
      ) ?? null,
    [paneState],
  )

  const updateWindowState = useCallback(
    async (updater: (ws: WindowState) => void) => {
      const root = client.readRoot()
      const states = root.plugin.kernel.windowStates ?? []
      const idx = states.findIndex((w) => w.id === windowId)
      if (idx < 0) return
      const updated = [...states]
      updated[idx] = { ...updated[idx] }
      updater(updated[idx])
      await client.plugin.kernel.windowStates.set(updated)
    },
    [client],
  )

  const writePaneState = useCallback(
    async (next: PaneState) => {
      await updateWindowState((ws) => {
        ws.panes = next.panes
        ws.rootPaneId = next.rootPaneId
        ws.focusedPaneId = next.focusedPaneId
      })
    },
    [updateWindowState],
  )

  // ---- handlers ----

  const handleNewAgent = useCallback(async () => {
    const tabId = `new-agent:${nanoid()}`
    if (paneState.rootPaneId) {
      const next = addTabToPane(paneState, paneState.rootPaneId, tabId)
      await writePaneState(next)
    } else {
      await writePaneState(initPaneState([tabId], tabId))
    }
  }, [paneState, writePaneState])

  const handleOpenPlugins = useCallback(async () => {
    const paneId = paneState.rootPaneId
    const pane = paneId
      ? paneState.panes.find((p) => p.id === paneId)
      : null
    const existing = pane?.tabIds.find((t) => t.startsWith("scope:plugins:"))
    if (existing) {
      await writePaneState(switchTabInPane(paneState, paneId!, existing))
      return
    }
    const tabId = `scope:plugins:${nanoid()}`
    await updateWindowState((ws) => {
      ws.sessions = [
        ...ws.sessions,
        { id: tabId, agentId: "", lastViewedAt: null },
      ]
    })
    if (paneId) {
      await writePaneState(addTabToPane(paneState, paneId, tabId))
    } else {
      await writePaneState(initPaneState([tabId], tabId))
    }
  }, [paneState, writePaneState, updateWindowState])

  const handleSwitchTab = useCallback(
    async (tabId: string) => {
      const paneId = paneState.rootPaneId
      if (!paneId) return
      const pane = paneState.panes.find((p) => p.id === paneId)
      const oldActive = pane?.activeTabId
      await writePaneState(switchTabInPane(paneState, paneId, tabId))
      if (oldActive !== tabId) {
        await updateWindowState((ws) => {
          const now = Date.now()
          for (const s of ws.sessions) {
            if (s.id === oldActive) s.lastViewedAt = now
            if (s.id === tabId) s.lastViewedAt = null
          }
        })
      }
    },
    [paneState, writePaneState, updateWindowState],
  )

  const removeSession = useCallback(
    async (sessionId: string) => {
      await updateWindowState((ws) => {
        ws.sessions = ws.sessions.filter((s) => s.id !== sessionId)
      })
    },
    [updateWindowState],
  )

  const handleCloseTab = useCallback(
    async (tabId: string) => {
      const paneId = paneState.rootPaneId
      if (!paneId) return
      const confirmed = await rpc.window.confirm({
        title: "Close chat?",
        message: "You can always re-open this chat later.",
        confirmLabel: "Close",
        windowId,
      })
      if (!confirmed) return
      await removeSession(tabId)
      await writePaneState(closeTabInPane(paneState, paneId, tabId))
    },
    [paneState, removeSession, writePaneState, rpc],
  )

  const handleCloseTabQuiet = useCallback(
    async (tabId: string) => {
      const paneId = paneState.rootPaneId
      if (!paneId) return
      await removeSession(tabId)
      await writePaneState(closeTabInPane(paneState, paneId, tabId))
    },
    [paneState, removeSession, writePaneState],
  )

  const onUtilIconClick = useCallback(
    (scope: string) => {
      const next = scope === utilSelected ? "" : scope
      client.plugin.kernel.utilitySidebarSelectedByWindow.set({
        ...(client.plugin.kernel.utilitySidebarSelectedByWindow.read() ?? {}),
        [windowId]: next,
      })
    },
    [client, utilSelected],
  )

  // Track lastTabByWorkspace whenever the active tab changes — used to
  // restore the last-viewed agent when the workspace becomes active again.
  useEffect(() => {
    const id = rootPane?.activeTabId
    if (!id || !workspaceIdParam) return
    if (id.startsWith("new-agent:") || id.startsWith("scope:")) return
    const cur = client.plugin.kernel.lastTabByWorkspace.read() ?? {}
    if (cur[workspaceIdParam] === id) return
    client.plugin.kernel.lastTabByWorkspace.set({
      ...cur,
      [workspaceIdParam]: id,
    })
  }, [rootPane?.activeTabId, client])

  // Lazy iframe mounting — only mount iframes for visited tabs.
  const [visitedTabIds, setVisitedTabIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!rootPane?.activeTabId) return
    setVisitedTabIds((prev) => {
      if (prev.has(rootPane.activeTabId!)) return prev
      const next = new Set(prev)
      next.add(rootPane.activeTabId!)
      return next
    })
  }, [rootPane?.activeTabId])
  const tabsToRender = useMemo(
    () =>
      (rootPane?.tabIds ?? []).filter((id) => visitedTabIds.has(id)),
    [rootPane?.tabIds, visitedTabIds],
  )

  // ---- iframe srcs ----

  const wsParam = workspaceIdParam
    ? `&workspaceId=${encodeURIComponent(workspaceIdParam)}`
    : ""

  const chatEntry = registryMap.get("chat")

  const utilPanelVisible = selectedUtilEntry != null
  const utilPanelSrc = useMemo(() => {
    if (!selectedUtilEntry) return ""
    let entryPath = new URL(selectedUtilEntry.url).pathname
    const ownsServer = entryPath === "/" || entryPath === ""
    if (ownsServer) entryPath = ""
    else if (entryPath.endsWith("/")) entryPath = entryPath.slice(0, -1)
    const targetPort = ownsServer ? selectedUtilEntry.port : wsPort
    const raw = `usb-${windowId}-${selectedUtilEntry.scope}`
    const hostname = raw.toLowerCase().replace(/[^a-z0-9]/g, "")
    return `http://${hostname}.localhost:${targetPort}${entryPath}/index.html?wsPort=${wsPort}&wsToken=${encodeURIComponent(
      wsToken,
    )}&windowId=${encodeURIComponent(
      windowId,
    )}&scope=${encodeURIComponent(selectedUtilEntry.scope)}${wsParam}`
  }, [selectedUtilEntry, wsParam, wsToken])

  // ---- layout state ----

  const agentWidth = agentWidthStore.useWidth()
  const utilWidth = utilWidthStore.useWidth()
  const [agentResizing, setAgentResizing] = useState(false)
  const [utilResizing, setUtilResizing] = useState(false)

  return (
    <div className="flex flex-row h-full min-h-0 min-w-0">
      {sidebarOpen && (
        <div
          className="shrink-0 flex flex-col overflow-hidden text-[13px]"
          style={{
            width: agentWidth,
            borderRight: "1px solid var(--zenbu-panel-border)",
          }}
        >
          <AgentList
            agents={agents}
            sessions={sessions}
            activeTabId={rootPane?.activeTabId}
            workspaceCwds={workspaceCwds}
            windowId={windowId}
            onSwitchTab={handleSwitchTab}
            onCloseTab={handleCloseTab}
            onCloseTabQuiet={handleCloseTabQuiet}
            onNewAgent={handleNewAgent}
            onOpenPlugins={handleOpenPlugins}
          />
        </div>
      )}
      {sidebarOpen && (
        <ResizeHandle
          onResizeChange={setAgentResizing}
          direction="right"
          store={agentWidthStore}
        />
      )}
      {agentResizing && <ResizeOverlay />}

      <div className="flex-1 min-w-0 min-h-0 relative">
        {rootPane?.activeTabId ? (
          tabsToRender.map((tabId) => {
            const session = sessions.find((s) => s.id === tabId)
            const scopeMatch =
              /^scope:([^:]+):/.exec(tabId) ??
              (tabId.startsWith("new-agent:") ? ["", "new-agent"] : null)
            const scope = scopeMatch?.[1] ?? "chat"
            const entry = scope === "chat" ? chatEntry : registryMap.get(scope)
            if (!entry) return null
            let entryPath = new URL(entry.url).pathname
            const ownsServer = entryPath === "/" || entryPath === ""
            if (ownsServer) entryPath = ""
            else if (entryPath.endsWith("/"))
              entryPath = entryPath.slice(0, -1)
            const targetPort = ownsServer ? entry.port : wsPort
            const agentId = session?.agentId ?? tabId
            const hostname = tabId.toLowerCase().replace(/[^a-z0-9]/g, "")
            const src = `http://${hostname}.localhost:${targetPort}${entryPath}/index.html?agentId=${encodeURIComponent(
              agentId,
            )}&wsPort=${wsPort}&wsToken=${encodeURIComponent(
              wsToken,
            )}&windowId=${encodeURIComponent(
              windowId,
            )}&paneId=${encodeURIComponent(rootPane.id)}${wsParam}`
            const isActive = tabId === rootPane.activeTabId
            return (
              <ViewCacheSlot
                key={tabId}
                cacheKey={tabId}
                src={src}
                hidden={!isActive}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  display: isActive ? "block" : "none",
                }}
              />
            )
          })
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
            <button
              onClick={handleNewAgent}
              className="px-3 py-1.5 rounded bg-secondary hover:bg-accent text-secondary-foreground transition-colors cursor-pointer"
            >
              + New Chat
            </button>
          </div>
        )}
      </div>

      {utilPanelVisible && (
        <ResizeHandle
          onResizeChange={setUtilResizing}
          direction="left"
          store={utilWidthStore}
        />
      )}
      {utilResizing && <ResizeOverlay />}

      {utilPanelVisible && (
        <div
          className="shrink-0 flex flex-col overflow-hidden"
          style={{
            width: utilWidth,
            background: "var(--zenbu-panel)",
            borderLeft: "1px solid var(--zenbu-panel-border)",
            borderRight: "1px solid var(--zenbu-panel-border)",
          }}
        >
          <UtilPanelHeader title={formatScope(selectedUtilEntry!.scope)} />
          <div className="flex-1 min-h-0 relative">
            <ViewCacheSlot
              cacheKey={`utility-sidebar:${windowId}:${selectedUtilEntry!.scope}`}
              src={utilPanelSrc}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
            />
          </div>
        </div>
      )}

      <UtilityRail
        entries={sidebarEntries}
        selected={utilSelected ?? ""}
        panelVisible={utilPanelVisible}
        onIconClick={onUtilIconClick}
      />
    </div>
  )
}

function UtilityRail({
  entries,
  selected,
  panelVisible,
  onIconClick,
}: {
  entries: RegistryEntry[]
  selected: string
  panelVisible: boolean
  onIconClick: (scope: string) => void
}) {
  const RAIL_WIDTH = 44
  return (
    <div
      className="shrink-0 flex flex-col items-center gap-1 py-2"
      style={{
        width: RAIL_WIDTH,
        background: "var(--zenbu-panel)",
        borderLeft: panelVisible ? "none" : "1px solid var(--zenbu-panel-border)",
      }}
    >
      {entries.length === 0 && (
        <div
          className="text-[10px] text-muted-foreground px-1 text-center mt-2"
          title="No sidebar views registered"
        >
          no views
        </div>
      )}
      {entries.map((e) => (
        <button
          key={e.scope}
          type="button"
          onClick={() => onIconClick(e.scope)}
          title={formatScope(e.scope)}
          className={`usb-icon relative inline-flex items-center justify-center rounded text-muted-foreground cursor-pointer ${
            e.scope === selected ? "is-active" : ""
          }`}
          style={{ width: 36, height: 36 }}
        >
          {e.icon ? (
            <span
              className="inline-flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: e.icon }}
            />
          ) : (
            <span
              className="inline-flex items-center justify-center rounded"
              style={{
                width: 18,
                height: 18,
                fontSize: 11,
                fontWeight: 600,
                background: "var(--zenbu-control-hover)",
              }}
            >
              {(e.scope[0] ?? "?").toUpperCase()}
            </span>
          )}
        </button>
      ))}
      <style>{`
        .usb-icon { transition: background-color 80ms ease; }
        .usb-icon:hover { background: var(--zenbu-control-hover); color: var(--foreground); }
        .usb-icon.is-active { background: var(--accent); color: var(--accent-foreground); }
        .usb-icon svg { width: 20px; height: 20px; filter: grayscale(100%); opacity: 0.65; transition: opacity 80ms ease; }
        .usb-icon:hover svg { opacity: 0.85; }
        .usb-icon.is-active svg { opacity: 1; }
      `}</style>
    </div>
  )
}

function UtilPanelHeader({ title }: { title: string }) {
  return (
    <div
      className="shrink-0 flex items-center"
      style={{
        height: 32,
        paddingLeft: 10,
        paddingRight: 10,
      }}
    >
      <span className="flex-1 text-[11px] uppercase tracking-wide text-muted-foreground truncate">
        {title}
      </span>
    </div>
  )
}

function ResizeHandle({
  onResizeChange,
  direction,
  store,
}: {
  onResizeChange: (resizing: boolean) => void
  direction: "left" | "right"
  store: { get: () => number; set: (v: number) => void }
}) {
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = store.get()
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      onResizeChange(true)

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX
        store.set(direction === "right" ? startWidth + delta : startWidth - delta)
      }
      const onUp = () => {
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        onResizeChange(false)
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
      }
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [onResizeChange, store, direction],
  )

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 4,
        cursor: "col-resize",
        flexShrink: 0,
        background: "transparent",
        marginLeft: -2,
        marginRight: -2,
        zIndex: 1,
      }}
    />
  )
}

function ResizeOverlay() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        cursor: "col-resize",
        background: "transparent",
      }}
    />
  )
}

function formatScope(scope: string): string {
  return scope
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function ConnectedApp({
  connection,
}: {
  connection: Extract<WsConnectionState, { status: "connected" }>
}) {
  return (
    <RpcProvider value={connection.rpc}>
      <EventsProvider value={connection.events}>
        <KyjuClientProvider value={connection.kyjuClient}>
          <KyjuProvider client={connection.kyjuClient} replica={connection.replica}>
            <WorkspaceContent />
          </KyjuProvider>
        </KyjuClientProvider>
      </EventsProvider>
    </RpcProvider>
  )
}

/**
 * 
 * we need to abstract this already
 */
export function App() {
  const connection = useWsConnection()
  if (connection.status === "connecting") return <div className="h-full" />
  if (connection.status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-red-500 text-xs">
        {connection.error}
      </div>
    )
  }
  return <ConnectedApp connection={connection} />
}
