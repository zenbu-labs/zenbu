import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  lazy,
  Suspense,
} from "react"
import { useCollection, useDb } from "../../../lib/kyju-react"
import { useKyjuClient, useRpc } from "../../../lib/providers"

const SettingsDialog = lazy(() =>
  import("./SettingsDialog").then((m) => ({ default: m.SettingsDialog })),
)

const SIDEBAR_FOOTER_HEIGHT = 44
const SIDEBAR_FOOTER_FADE = 24

type AgentItem = {
  id: string
  status?: string
  title?: { kind: string; value?: string }
  metadata?: { cwd?: string }
  configId?: string
  lastUserMessageAt?: number
  createdAt?: number
  lastFinishedAt?: number
  eventLog?: any
}

type SessionItem = {
  id: string
  agentId: string
  lastViewedAt: number | null
}

const PLUGINS_TAB_PREFIX = "scope:plugins:"

export function AgentList({
  agents,
  sessions,
  activeTabId,
  workspaceCwds,
  windowId,
  onSwitchTab,
  onCloseTab,
  onCloseTabQuiet,
  onNewAgent,
  onOpenPlugins,
}: {
  agents: AgentItem[]
  sessions: SessionItem[]
  activeTabId: string | undefined
  workspaceCwds: string[]
  windowId: string
  onSwitchTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onCloseTabQuiet: (tabId: string) => void
  onNewAgent: () => void
  onOpenPlugins: () => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  const cwdSet = useMemo(() => new Set(workspaceCwds), [workspaceCwds])

  const items = useMemo(() => {
    const out: Array<{
      tabId: string
      agent: AgentItem | undefined
      session: SessionItem | undefined
    }> = []
    for (const session of sessions) {
      // Skip sentinel/scope tabs — they don't represent agents.
      if (session.id.startsWith("scope:")) continue
      if (session.id.startsWith("new-agent:")) continue
      const agent = agents.find((a) => a.id === session.agentId)
      const agentCwd = agent?.metadata?.cwd ?? ""
      if (cwdSet.size > 0 && agentCwd && !cwdSet.has(agentCwd)) continue
      out.push({ tabId: session.id, agent, session })
    }
    out.sort(
      (a, b) =>
        (b.agent?.lastUserMessageAt ?? b.agent?.createdAt ?? 0) -
        (a.agent?.lastUserMessageAt ?? a.agent?.createdAt ?? 0),
    )
    return out
  }, [sessions, agents, cwdSet])

  const pluginsTabActive =
    typeof activeTabId === "string" && activeTabId.startsWith(PLUGINS_TAB_PREFIX)

  return (
    <>
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            // initialSection="registry"
            initialSection="general"
          />
        </Suspense>
      )}
      <div
        className="flex flex-col h-full overflow-hidden"
        style={{ background: "var(--zenbu-agent-sidebar)" }}
      >
        <div
          className="shrink-0 flex flex-col px-2 pt-2 pb-2 gap-0.5"
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          <HeaderRow
            icon={<ComposeIcon />}
            label="New Chat"
            shortcut="⌘N"
            onClick={onNewAgent}
          />
          <HeaderRow
            icon={<PluginIcon />}
            label="Plugins"
            onClick={onOpenPlugins}
            isActive={pluginsTabActive}
          />
        </div>
        <div
          className="relative flex-1 min-h-0"
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          <div
            className="absolute inset-0 overflow-auto"
            style={{ paddingBottom: SIDEBAR_FOOTER_HEIGHT }}
          >
            <div className="px-1.5 pt-1">
              {items.map((item) => (
                <SidebarRow
                  key={item.tabId}
                  item={item}
                  isActive={item.tabId === activeTabId}
                  onClick={() => onSwitchTab(item.tabId)}
                  onClose={(quiet) =>
                    quiet
                      ? onCloseTabQuiet(item.tabId)
                      : onCloseTab(item.tabId)
                  }
                />
              ))}
              {items.length === 0 && (
                <div className="px-3 py-6 text-[11px] text-(--zenbu-agent-sidebar-muted) text-center">
                  No agents in this workspace yet.
                </div>
              )}
            </div>
          </div>
          <SidebarFooter onSettings={() => setSettingsOpen(true)} />
        </div>
      </div>
      <style>{`
        @keyframes agent-sidebar-spin {
          to { transform: rotate(360deg); }
        }
        .as-row {
          transition: background-color 80ms ease, color 80ms ease;
        }
        .as-row:hover { background: var(--zenbu-agent-sidebar-hover); color: var(--zenbu-agent-sidebar-foreground); }
        .as-row.is-active {
          background: var(--zenbu-agent-sidebar-active);
          color: var(--zenbu-agent-sidebar-foreground);
        }
        .as-header {
          transition: background-color 80ms ease;
        }
        .as-header:hover { background: var(--zenbu-agent-sidebar-hover); }
        .as-header.is-active { background: var(--zenbu-agent-sidebar-active); color: var(--zenbu-agent-sidebar-foreground); }
      `}</style>
    </>
  )
}

function SidebarRow({
  item,
  isActive,
  onClick,
  onClose,
}: {
  item: {
    tabId: string
    agent: AgentItem | undefined
    session: SessionItem | undefined
  }
  isActive: boolean
  onClick: () => void
  onClose: (quiet: boolean) => void
}) {
  const { items: events } = useCollection(item.agent?.eventLog)
  const { lastUserPrompt, hasUserMessages } = useMemo(() => {
    let lastUserPrompt: string | undefined
    let hasUserMessages = false
    for (const e of events) {
      if ((e as any).data?.kind === "user_prompt") {
        lastUserPrompt = (e as any).data.text
        hasUserMessages = true
      }
    }
    return { lastUserPrompt, hasUserMessages }
  }, [events])

  const title = item.agent?.title
  const isGeneratingTitle = title?.kind === "generating"
  const label =
    title?.kind === "set"
      ? title.value
      : lastUserPrompt?.replace(/\s+/g, " ").trim() || "New Chat"

  const isStreaming = item.agent?.status === "streaming"
  const hasUnread =
    !isActive &&
    item.session?.lastViewedAt != null &&
    item.agent?.lastFinishedAt != null &&
    (item.agent.lastFinishedAt as number) > item.session.lastViewedAt

  const ts = item.agent?.lastUserMessageAt ?? item.agent?.createdAt
  const timeLabel = useLiveTimeAgo(ts)

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose(!hasUserMessages)
      }}
      className={`as-row group flex items-center gap-2 pl-1.5 pr-2 py-1.5 mb-px rounded-md min-h-[30px] cursor-pointer text-(--zenbu-agent-sidebar-foreground) ${
        isActive ? "is-active" : ""
      }`}
    >
      {isGeneratingTitle ? (
        <span className="flex-1">
          <span className="inline-block w-20 h-3 rounded-sm bg-size-[200%_100%] bg-linear-to-r from-neutral-200 via-neutral-100 to-neutral-200 text-shimmer" />
        </span>
      ) : (
        <span className={`flex-1 truncate text-[13px] ${isActive ? "font-medium" : ""}`}>
          {label}
        </span>
      )}
      <span className="shrink-0 flex items-center gap-1 group-hover:hidden">
        {hasUnread && !isStreaming && (
          <span className="size-[6px] rounded-full bg-blue-500" />
        )}
        {isStreaming ? (
          <Spinner />
        ) : timeLabel ? (
          <span className="text-[10px] text-(--zenbu-agent-sidebar-muted)">{timeLabel}</span>
        ) : null}
      </span>
      <span
        onClick={(e) => {
          e.stopPropagation()
          onClose(!hasUserMessages)
        }}
        className="hidden group-hover:inline text-(--zenbu-agent-sidebar-muted) hover:text-(--zenbu-agent-sidebar-foreground) text-sm leading-none shrink-0 px-1"
        title="Close"
      >
        ×
      </span>
    </div>
  )
}

function HeaderRow({
  icon,
  label,
  shortcut,
  onClick,
  isActive,
}: {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
  isActive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`as-header flex items-center gap-2 w-full text-left px-2 py-1 rounded text-(--zenbu-agent-sidebar-foreground) ${isActive ? "is-active" : ""}`}
    >
      <span className="size-4 inline-flex items-center justify-center text-(--zenbu-agent-sidebar-muted)">
        {icon}
      </span>
      <span className="flex-1 truncate text-[13px]">{label}</span>
      {shortcut && (
        <span className="text-[11px] text-(--zenbu-agent-sidebar-muted)">{shortcut}</span>
      )}
    </button>
  )
}

function PluginIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12h2a2 2 0 0 1 0 4h-2v3a2 2 0 0 1-2 2h-3v-2a2 2 0 0 0-4 0v2H7a2 2 0 0 1-2-2v-3H3a2 2 0 0 1 0-4h2V8a2 2 0 0 1 2-2h3V4a2 2 0 0 1 4 0v2h3a2 2 0 0 1 2 2v4z" />
    </svg>
  )
}

function ComposeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function SidebarFooter({ onSettings }: { onSettings: () => void }) {
  return (
    <div
      className="absolute left-0 right-0 bottom-0 pointer-events-none"
      style={{ height: SIDEBAR_FOOTER_HEIGHT + SIDEBAR_FOOTER_FADE }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            to bottom,
            color-mix(in srgb, var(--zenbu-agent-sidebar) 0%, transparent) 0%,
            color-mix(in srgb, var(--zenbu-agent-sidebar) 85%, transparent) ${SIDEBAR_FOOTER_FADE}px,
            var(--zenbu-agent-sidebar) ${SIDEBAR_FOOTER_FADE + 4}px,
            var(--zenbu-agent-sidebar) 100%
          )`,
        }}
      />
      <div
        className="absolute left-0 right-0 bottom-0 flex items-center px-2"
        style={{
          height: SIDEBAR_FOOTER_HEIGHT,
          pointerEvents: "auto",
          WebkitAppRegion: "no-drag",
        } as any}
      >
        <button
          type="button"
          onClick={onSettings}
          title="Settings"
          className="inline-flex items-center justify-center rounded text-(--zenbu-agent-sidebar-muted) cursor-pointer hover:bg-(--zenbu-agent-sidebar-hover) hover:text-(--zenbu-agent-sidebar-foreground)"
          style={{ width: 22, height: 22 }}
        >
          <SettingsGearIcon />
        </button>
      </div>
    </div>
  )
}

function SettingsGearIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      style={{
        animation: "agent-sidebar-spin 0.9s linear infinite",
      }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function timeAgo(ts: number | undefined): string {
  if (!ts) return ""
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return "now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function useLiveTimeAgo(ts: number | undefined): string {
  const [, force] = useState(0)
  useEffect(() => {
    if (!ts) return
    const age = Date.now() - ts
    const interval = age < 60_000 ? 5_000 : age < 3_600_000 ? 30_000 : 300_000
    const id = setInterval(() => force((x) => x + 1), interval)
    return () => clearInterval(id)
  }, [ts])
  return timeAgo(ts)
}
