import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  SearchIcon,
  SettingsIcon,
  RotateCwIcon,
  DownloadIcon,
  GitMergeIcon,
  RefreshCwIcon,
} from "lucide-react";
import { nanoid } from "nanoid";
import { makeCollection } from "@zenbu/kyju/schema";
import {
  useWsConnection,
  RpcProvider,
  EventsProvider,
  KyjuClientProvider,
} from "../../lib/ws-connection";
import type { WsConnectionState } from "../../lib/ws-connection";
import { KyjuProvider, useDb, useCollection } from "../../lib/kyju-react";
import { useKyjuClient, useRpc } from "../../lib/providers";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { LeafPane } from "./components/LeafPane";
import { SettingsDialog } from "./components/SettingsDialog";
import { ReviewMode, type ReviewFileEntry } from "./components/ReviewMode";
import { ShortcutForwarderProvider } from "./providers/shortcut-forwarder";
import { useFocusOnRequest } from "../../lib/focus-request";
import {
  type PaneState,
  type PaneNode,
  initPaneState,
  addTabToPane,
  switchTabInPane,
  closeTabInPane,
} from "./pane-ops";
import {
  insertHotAgent,
  type ArchivedAgent,
} from "../../../../shared/agent-ops";

const params = new URLSearchParams(window.location.search);
const wsPort = Number(params.get("wsPort"));
const windowId = params.get("windowId");
const defaultCwd = params.get("defaultCwd") ?? "";
if (!windowId) throw new Error("Missing ?windowId= in orchestrator URL");

import type { SchemaRoot } from "../../../../shared/schema";

type WindowState = SchemaRoot["windowStates"][number];
type SessionItem = WindowState["sessions"][number];
type AgentItem = SchemaRoot["agents"][number];
type RegistryEntry = { scope: string; url: string; port: number };

type ErrorFallbackRender = (args: {
  error: Error;
  reset: () => void;
}) => ReactNode;

class ErrorBoundary extends Component<
  { children: ReactNode; scope: string; fallback: ErrorFallbackRender },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[orchestrator:${this.props.scope}] Uncaught error:`,
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.error) {
      return this.props.fallback({
        error: this.state.error,
        reset: () => this.setState({ error: null }),
      });
    }
    return this.props.children;
  }
}

function FullErrorFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const [showStack, setShowStack] = useState(false);

  return (
    <div className="flex h-full items-center justify-center bg-[#F4F4F4] p-8">
      <div className="flex max-w-lg flex-col gap-3 rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-red-600">
          Something went wrong
        </div>
        <div className="text-xs text-neutral-600 font-mono break-all">
          {error.message}
        </div>
        {error.stack && (
          <button
            onClick={() => setShowStack((s) => !s)}
            className="text-xs text-neutral-400 hover:text-neutral-600 text-left cursor-pointer"
          >
            {showStack ? "Hide" : "Show"} stack trace
          </button>
        )}
        {showStack && error.stack && (
          <pre className="max-h-48 overflow-auto rounded bg-neutral-50 p-3 text-[10px] text-neutral-500 leading-relaxed">
            {error.stack}
          </pre>
        )}
        <button
          onClick={onReset}
          className="mt-1 self-start rounded bg-neutral-800 px-3 py-1.5 text-xs text-white hover:bg-neutral-700 cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function TitleBarErrorFallback({
  error,
  onReset,
  hasTabs,
}: {
  error: Error;
  onReset: () => void;
  hasTabs: boolean;
}) {
  return (
    <div
      className={`flex h-9 shrink-0 items-center gap-2 px-3 ${
        hasTabs ? "bg-[#E0E0E0]" : "bg-[#F4F4F4]"
      }`}
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div
        className="flex flex-1 items-center gap-2 pl-[74px] min-w-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <span className="text-xs text-red-600 shrink-0">Title bar error</span>
        <span
          className="text-xs text-neutral-500 font-mono truncate"
          title={error.message}
        >
          {error.message}
        </span>
        <button
          onClick={onReset}
          className="ml-auto shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-xs text-white hover:bg-neutral-700 cursor-pointer"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function AgentLabel({ agent }: { agent: AgentItem }) {
  const { items: events } = useCollection(agent.eventLog);
  const label = useMemo(() => {
    if (agent.title?.kind === "set") return agent.title.value;
    let last: string | undefined;
    for (const event of events) {
      if (event.data.kind === "user_prompt") last = event.data.text;
    }
    return last?.replace(/\s+/g, " ").trim() || "New Chat";
  }, [agent.title, events]);
  return <>{label}</>;
}

function timeAgo(ts: number | undefined): string {
  if (!ts) return "";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function AgentPickerCombobox({
  agents,
  sessions,
  onSelect,
}: {
  agents: AgentItem[];
  sessions: SessionItem[];
  onSelect: (agentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sortedAgents = useMemo(
    () =>
      [...agents].sort(
        (a, b) => (b.lastUserMessageAt ?? 0) - (a.lastUserMessageAt ?? 0),
      ),
    [agents],
  );

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          className="flex h-6 items-center gap-1 rounded px-1.5 text-neutral-500 transition-colors hover:bg-black/10 hover:text-neutral-700 text-xs"
          title="Load agent"
        >
          <SearchIcon size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 ml-2" align="start">
        <Command>
          <CommandInput placeholder="Search agents..." />
          <CommandList>
            <CommandEmpty>No agents found.</CommandEmpty>
            <CommandGroup>
              {sortedAgents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={agent.id}
                  onSelect={() => {
                    onSelect(agent.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="truncate flex-1">
                    <AgentLabel agent={agent} />
                  </span>
                  {agent.lastUserMessageAt && (
                    <span className="shrink-0 text-[10px] text-neutral-400">
                      {timeAgo(agent.lastUserMessageAt)}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type UpdateStatus =
  | { kind: "not-a-repo" }
  | { kind: "no-remote" }
  | { kind: "detached-head" }
  | { kind: "git-missing" }
  | { kind: "fetch-error"; message: string }
  | {
      kind: "ok";
      branch: string;
      ahead: number;
      behind: number;
      dirty: boolean;
      mergeable: boolean | null;
      conflictingFiles: string[];
      checkedAt: number;
    };

function ReloadMenu() {
  const rpc = useRpc();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [pullPending, setPullPending] = useState<"check" | "pull" | null>(null);
  const [reloadPending, setReloadPending] = useState(false);
  const [transient, setTransient] = useState<
    "updated" | "up-to-date" | "needs-relaunch" | null
  >(null);

  const handleFullReload = async () => {
    if (reloadPending) return;
    setReloadPending(true);
    try {
      await rpc.runtime.reload();
    } catch (e) {
      console.error("[orchestrator] full reload failed:", e);
    } finally {
      setReloadPending(false);
    }
  };

  const pendingStagedRef = useRef<{
    plugin: string;
    version: number | null;
    headBefore: string | null;
  } | null>(null);

  const handleRelaunch = async () => {
    const staged = pendingStagedRef.current;
    try {
      if (staged && staged.version != null) {
        await (rpc as any).gitUpdates.commitPluginUpdate({
          plugin: staged.plugin,
          version: staged.version,
        });
      } else {
        await (rpc as any).runtime.quitAndRelaunch();
      }
    } catch {
      // process exits from under us
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const cached: UpdateStatus | null =
          await rpc.gitUpdates.getCachedStatus();
        if (cached) setStatus(cached);
      } catch {}
    })();
  }, [rpc]);

  const hasConflicts = status?.kind === "ok" && status.mergeable === false;
  const hasUpdates =
    status?.kind === "ok" && status.behind > 0 && status.mergeable !== false;

  const flashTransient = (kind: "updated" | "up-to-date") => {
    setTransient(kind);
    setTimeout(() => {
      setTransient((cur) => (cur === kind ? null : cur));
    }, 2000);
  };

  const handlePullItem = async () => {
    if (hasConflicts || pullPending) return;
    setTransient(null);
    setPullPending(hasUpdates ? "pull" : "check");
    try {
      const result = await rpc.gitUpdates.pullAndInstall({ plugin: "kernel" });
      const next: UpdateStatus = await rpc.gitUpdates.checkUpdates(true);
      setStatus(next);
      if (result?.ok) {
        if (result.pending) {
          // setup.ts ran but state isn't committed yet. Remember staged info
          // so handleRelaunch knows which plugin to commit. Show sticky
          // needs-relaunch indicator.
          pendingStagedRef.current = {
            plugin: result.plugin,
            version: result.version,
            headBefore: result.headBefore,
          };
          setTransient("needs-relaunch");
        } else {
          pendingStagedRef.current = null;
          flashTransient(result.updated || result.setupRan ? "updated" : "up-to-date");
        }
      } else if (result?.error) {
        console.error("[orchestrator] pullAndInstall failed:", result.error);
      }
    } finally {
      setPullPending(null);
    }
  };

  const pullLabel =
    pullPending === "pull"
      ? "Pulling & installing…"
      : pullPending === "check"
      ? "Checking…"
      : hasConflicts
      ? "Conflicts — resolve in Settings"
      : transient === "updated"
      ? "Updated!"
      : transient === "up-to-date"
      ? "Up to date"
      : transient === "needs-relaunch"
      ? "Relaunch required"
      : "Pull updates";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-6 w-7 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-black/10 hover:text-neutral-700"
          title="Reload"
        >
          <RotateCwIcon size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px] text-xs">
        <DropdownMenuItem
          className="text-xs"
          onClick={() => window.location.reload()}
        >
          <RotateCwIcon className="size-3" />
          Reload window
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-xs"
          disabled={reloadPending}
          onSelect={(e) => {
            e.preventDefault();
            handleFullReload();
          }}
        >
          <RefreshCwIcon className="size-3" />
          {reloadPending ? "Reloading…" : "Full reload"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-xs"
          disabled={hasConflicts || pullPending !== null}
          onSelect={(e) => {
            e.preventDefault();
            handlePullItem();
          }}
        >
          {hasConflicts ? (
            <GitMergeIcon className="size-3 text-red-500" />
          ) : (
            <DownloadIcon className="size-3" />
          )}
          <span className="flex-1">{pullLabel}</span>
          {hasUpdates && pullPending === null && transient === null && (
            <span className="size-1.5 rounded-full bg-blue-500" />
          )}
        </DropdownMenuItem>
        {transient === "needs-relaunch" && (
          <DropdownMenuItem
            className="text-xs text-blue-600 dark:text-blue-400"
            onSelect={(e) => {
              e.preventDefault();
              handleRelaunch();
            }}
          >
            <RotateCwIcon className="size-3" />
            <span className="flex-1">Relaunch to apply</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TitleBar({
  agents,
  sessions,
  hasTabs,
  onSettings,
  onNew,
  onLoadAgent,
}: {
  agents: AgentItem[];
  sessions: SessionItem[];
  hasTabs: boolean;
  onSettings: () => void;
  onNew: () => void;
  onLoadAgent: (agentId: string) => void;
}) {
  return (
    <div
      className={`flex h-9 shrink-0 items-center ${
        hasTabs ? "bg-[#E0E0E0]" : "bg-[#F4F4F4]"
      }`}
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div
        className="flex h-full shrink-0 items-center gap-1 pl-[74px]"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <ReloadMenu />
        <button
          onClick={onSettings}
          className="flex h-6 w-7 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-black/10 hover:text-neutral-700"
          title="Settings"
        >
          <SettingsIcon size={14} />
        </button>
        <AgentPickerCombobox
          agents={agents}
          sessions={sessions}
          onSelect={onLoadAgent}
        />
      </div>
      <div className="flex flex-1 items-center justify-center" />
      <div
        className="flex shrink-0 items-center justify-end gap-1 pr-2"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <TitleBarActions onNew={onNew} />
      </div>
    </div>
  );
}

function TitleBarActions({ onNew }: { onNew: () => void }) {
  return (
    <button
      onClick={onNew}
      className="flex h-6 w-7 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-black/10 hover:text-neutral-700"
      title="New Chat"
    >
      +
    </button>
  );
}

function OrchestratorContent() {
  const allWindowStates =
    useDb((root) => root.plugin.kernel.windowStates) ?? [];
  const windowState = useMemo(
    () => allWindowStates.find((ws) => ws.id === windowId),
    [allWindowStates],
  );
  const sessions = windowState?.sessions ?? [];
  const agents = useDb((root) => root.plugin.kernel.agents);
  const registry = useDb((root) => root.plugin.kernel.viewRegistry);
  const client = useKyjuClient();
  const rpc = useRpc();
  // panes should of been deleted
  const paneState: PaneState = useMemo(
    () => ({
      panes: windowState?.panes ?? [],
      rootPaneId: windowState?.rootPaneId ?? null,
      focusedPaneId: windowState?.focusedPaneId ?? null,
    }),
    [windowState?.panes, windowState?.rootPaneId, windowState?.focusedPaneId],
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<
    "general" | "registry"
  >("registry");
  const [reviewEntries, setReviewEntries] = useState<ReviewFileEntry[] | null>(
    null,
  );
  const initializedRef = useRef(false);
  const ensuredRef = useRef(false);

  useEffect(() => {
    if (ensuredRef.current || !windowId) return;
    const states = client.readRoot().plugin.kernel.windowStates ?? [];
    if (states.some((ws) => ws.id === windowId)) return;
    ensuredRef.current = true;
    client.plugin.kernel.windowStates.set([
      ...states,
      {
        id: windowId,
        sessions: [],
        panes: [],
        rootPaneId: null,
        focusedPaneId: null,
        sidebarOpen: false,
        tabSidebarOpen: true,
        sidebarPanel: "overview",
      },
    ]);
  }, [client, allWindowStates]);

  const registryMap = useMemo(() => {
    const map = new Map<string, RegistryEntry>();
    for (const entry of registry) map.set(entry.scope, entry);
    return map;
  }, [registry]);

  const updateWindowState = useCallback(
    async (updater: (ws: WindowState) => void) => {
      const root = client.readRoot();
      const states = root.plugin.kernel.windowStates ?? [];
      const idx = states.findIndex((ws) => ws.id === windowId);
      if (idx < 0) return;
      const updated = [...states];
      updated[idx] = { ...updated[idx] };
      updater(updated[idx]);
      await client.plugin.kernel.windowStates.set(updated);
    },
    [client],
  );

  const writePaneState = useCallback(
    async (next: PaneState) => {
      await updateWindowState((ws) => {
        ws.panes = next.panes;
        ws.rootPaneId = next.rootPaneId;
        ws.focusedPaneId = next.focusedPaneId;
      });
    },
    [updateWindowState],
  );

  const createAgentAndSession = useCallback(async (): Promise<string> => {
    const kernel = client.readRoot().plugin.kernel;
    const configs = kernel.agentConfigs;
    const selectedConfigId = kernel.selectedConfigId;
    const selectedConfig =
      configs.find((c) => c.id === selectedConfigId) ?? configs[0];

    const agentId = nanoid();
    const sessionId = nanoid();

    // Inherit cwd from the focused agent (like terminal new tabs)
    const focusedPaneId =
      windowState?.focusedPaneId ?? windowState?.rootPaneId ?? null;
    const focusedPane = focusedPaneId
      ? (windowState?.panes ?? []).find((p) => p.id === focusedPaneId)
      : undefined;
    const focusedSessionId = focusedPane?.activeTabId;
    const focusedSession = focusedSessionId
      ? sessions.find((s) => s.id === focusedSessionId)
      : undefined;
    const focusedAgent = focusedSession
      ? kernel.agents.find((a) => a.id === focusedSession.agentId)
      : undefined;
    const inheritedCwd =
      typeof focusedAgent?.metadata?.cwd === "string"
        ? focusedAgent.metadata.cwd
        : undefined;
    const newAgentCwd = inheritedCwd ?? defaultCwd;

    // Copy config from most recent agent with same configId, validating against available options
    const existingAgents = kernel.agents.filter(
      (a) => a.configId === selectedConfig.id,
    );
    const lastAgent = existingAgents[existingAgents.length - 1];

    const validModel =
      lastAgent?.model &&
      (!selectedConfig.availableModels?.length ||
        selectedConfig.availableModels.some(
          (m) => m.value === lastAgent.model,
        ));
    const validThinking =
      lastAgent?.thinkingLevel &&
      (!selectedConfig.availableThinkingLevels?.length ||
        selectedConfig.availableThinkingLevels.some(
          (t) => t.value === lastAgent.thinkingLevel,
        ));
    const validMode =
      lastAgent?.mode &&
      (!selectedConfig.availableModes?.length ||
        selectedConfig.availableModes.some((m) => m.value === lastAgent.mode));

    let evicted: ArchivedAgent[] = [];
    await client.update((root) => {
      evicted = insertHotAgent(root.plugin.kernel, {
        id: agentId,
        name: selectedConfig.name,
        startCommand: selectedConfig.startCommand,
        configId: selectedConfig.id,
        metadata: {
          ...(newAgentCwd ? { cwd: newAgentCwd } : {}),
        },
        eventLog: makeCollection({
          collectionId: nanoid(),
          debugName: "eventLog",
        }),
        status: "idle",
        ...(validModel ? { model: lastAgent.model } : {}),
        ...(validThinking ? { thinkingLevel: lastAgent.thinkingLevel } : {}),
        ...(validMode ? { mode: lastAgent.mode } : {}),
        title: { kind: "not-available" },
        reloadMode: "keep-alive",
        sessionId: null,
        firstPromptSentAt: null,
        createdAt: Date.now(),
      });
    });
    if (evicted.length > 0) {
      await client.plugin.kernel.archivedAgents.concat(evicted).catch(() => {});
    }

    await updateWindowState((ws) => {
      ws.sessions = [
        ...ws.sessions,
        { id: sessionId, agentId, lastViewedAt: null },
      ];
    });

    rpc.agent
      .init(agentId)
      .catch((e: unknown) =>
        console.error("[orchestrator] agent init failed:", e),
      );
    return sessionId;
  }, [client, rpc, updateWindowState, windowState, sessions]);

  const createSessionForAgent = useCallback(
    async (agentId: string): Promise<string> => {
      const sessionId = nanoid();
      await updateWindowState((ws) => {
        ws.sessions = [
          ...ws.sessions,
          { id: sessionId, agentId, lastViewedAt: null },
        ];
      });
      return sessionId;
    },
    [updateWindowState],
  );

  const removeSession = useCallback(
    async (sessionId: string) => {
      await updateWindowState((ws) => {
        ws.sessions = ws.sessions.filter((s) => s.id !== sessionId);
      });
    },
    [updateWindowState],
  );

  useEffect(() => {
    if (initializedRef.current) return;
    if (paneState.rootPaneId) {
      initializedRef.current = true;
      return;
    }

    const tabIds = sessions.map((s) => s.id);
    if (tabIds.length === 0) return;

    initializedRef.current = true;
    const initial = initPaneState(tabIds, tabIds[tabIds.length - 1]);
    writePaneState(initial);
  }, [paneState.rootPaneId, sessions, writePaneState]);

  const handleNewTab = useCallback(async () => {
    const paneId = paneState.rootPaneId;
    if (!paneId) return;
    const pane = paneState.panes.find((p) => p.id === paneId);
    const oldActiveTabId = pane?.activeTabId;
    const newSessionId = await createAgentAndSession();
    const next = addTabToPane(paneState, paneId, newSessionId);
    await writePaneState(next);
    if (oldActiveTabId) {
      await updateWindowState((ws) => {
        const s = ws.sessions.find((s) => s.id === oldActiveTabId);
        if (s) s.lastViewedAt = Date.now();
      });
    }
  }, [paneState, createAgentAndSession, writePaneState, updateWindowState]);

  const handleSwitchTab = useCallback(
    async (tabId: string) => {
      const paneId = paneState.rootPaneId;
      if (!paneId) return;
      const pane = paneState.panes.find((p) => p.id === paneId);
      const oldActiveTabId = pane?.activeTabId;
      const next = switchTabInPane(paneState, paneId, tabId);
      await writePaneState(next);
      if (oldActiveTabId !== tabId) {
        await updateWindowState((ws) => {
          const now = Date.now();
          for (const s of ws.sessions) {
            if (s.id === oldActiveTabId) s.lastViewedAt = now;
            if (s.id === tabId) s.lastViewedAt = null;
          }
        });
      }
    },
    [paneState, writePaneState, updateWindowState],
  );

  const handleCloseTab = useCallback(
    async (tabId: string) => {
      const paneId = paneState.rootPaneId;
      if (!paneId) return;
      const confirmed = await rpc.window.confirm({
        title: "Close chat?",
        message: "You can always re-open this chat later.",
        confirmLabel: "Close",
        windowId: windowId!,
      });
      if (!confirmed) return;
      await removeSession(tabId);
      const next = closeTabInPane(paneState, paneId, tabId);
      await writePaneState(next);
    },
    [paneState, removeSession, writePaneState],
  );

  const handleCloseTabQuiet = useCallback(
    async (tabId: string) => {
      const paneId = paneState.rootPaneId;
      if (!paneId) return;
      await removeSession(tabId);
      const next = closeTabInPane(paneState, paneId, tabId);
      await writePaneState(next);
    },
    [paneState, removeSession, writePaneState],
  );

  const handleTabContextMenu = useCallback(
    async (tabId: string) => {
      const paneId = paneState.rootPaneId;
      if (!paneId) return;
      const result = await rpc.window.showContextMenu([
        { id: "close", label: "Close" },
        { id: "move-to-new-window", label: "Move to New Window" },
      ]);
      if (result === "close") {
        await handleCloseTab(tabId);
      } else if (result === "move-to-new-window") {
        const next = closeTabInPane(paneState, paneId, tabId);
        await writePaneState(next);
        await rpc.window.moveTabToNewWindow({
          sourceWindowId: windowId!,
          sessionId: tabId,
        });
      }
    },
    [windowId, handleCloseTab, rpc, paneState, writePaneState],
  );

  const handleTabTearOff = useCallback(
    async (
      tabId: string,
      screenX: number,
      screenY: number,
    ): Promise<string | null> => {
      const paneId = paneState.rootPaneId;
      if (!paneId) return null;
      const next = closeTabInPane(paneState, paneId, tabId);
      writePaneState(next);
      const result = await rpc.window.beginTabTearOff({
        sourceWindowId: windowId!,
        sessionId: tabId,
        screenX,
        screenY,
      });
      return result?.previewWindowId ?? null;
    },
    [windowId, paneState, writePaneState, rpc],
  );

  const handleNewGlobal = useCallback(async () => {
    if (paneState.rootPaneId) {
      await handleNewTab();
    } else {
      const sessionId = await createAgentAndSession();
      const initial = initPaneState([sessionId], sessionId);
      await writePaneState(initial);
    }
  }, [paneState, handleNewTab, createAgentAndSession, writePaneState]);

  const handleLoadAgent = useCallback(
    async (agentId: string) => {
      const sessionId = await createSessionForAgent(agentId);
      if (paneState.rootPaneId) {
        const paneId = paneState.rootPaneId;
        const pane = paneState.panes.find((p) => p.id === paneId);
        const oldActiveTabId = pane?.activeTabId;
        const next = addTabToPane(paneState, paneId, sessionId);
        await writePaneState(next);
        if (oldActiveTabId) {
          await updateWindowState((ws) => {
            const s = ws.sessions.find((s) => s.id === oldActiveTabId);
            if (s) s.lastViewedAt = Date.now();
          });
        }
      } else {
        const initial = initPaneState([sessionId], sessionId);
        await writePaneState(initial);
      }
    },
    [paneState, createSessionForAgent, writePaneState, updateWindowState],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "p") {
        e.preventDefault();
        setSettingsSection("registry");
        setSettingsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const hasTabs = paneState.panes.some(
    (p) => p.type === "leaf" && p.tabIds.length > 1,
  );

  const handleRequestReview = useCallback((entries: ReviewFileEntry[]) => {
    setSettingsOpen(false);
    setReviewEntries(entries);
  }, []);

  const rootFocusRef = useRef<HTMLDivElement>(null);
  useFocusOnRequest("orchestrator", () => {
    // Blur whatever iframe currently has focus, then focus the orchestrator
    // shell root. The root has tabIndex=-1 so it can receive focus
    // programmatically without appearing in the normal tab order.
    (document.activeElement as HTMLElement | null)?.blur?.();
    rootFocusRef.current?.focus();
  });

  return (
    <div
      ref={rootFocusRef}
      tabIndex={-1}
      className="flex h-full flex-col bg-[#F4F4F4] outline-none"
    >
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialSection={settingsSection}
        onRequestReview={handleRequestReview}
      />
      {reviewEntries && (
        <ReviewMode
          entries={reviewEntries}
          onClose={() => setReviewEntries(null)}
        />
      )}
      <ErrorBoundary
        scope="title-bar"
        fallback={({ error, reset }) => (
          <TitleBarErrorFallback
            error={error}
            onReset={reset}
            hasTabs={hasTabs}
          />
        )}
      >
        <TitleBar
          agents={agents}
          sessions={sessions}
          hasTabs={hasTabs}
          onSettings={() => setSettingsOpen(true)}
          onNew={handleNewGlobal}
          onLoadAgent={handleLoadAgent}
        />
      </ErrorBoundary>
      <div className="relative flex-1 min-h-0">
        <ErrorBoundary
          scope="tabs"
          fallback={({ error, reset }) => (
            <FullErrorFallback error={error} onReset={reset} />
          )}
        >
          {(() => {
            const rootPane = paneState.panes.find(
              (p) => p.id === paneState.rootPaneId && p.type === "leaf",
            );
            if (rootPane) {
              return (
                <LeafPane
                  pane={rootPane}
                  agents={agents}
                  sessions={sessions}
                  registryMap={registryMap}
                  wsPort={wsPort}
                  windowId={windowId!}
                  onSwitchTab={handleSwitchTab}
                  onCloseTab={handleCloseTab}
                  onCloseTabQuiet={handleCloseTabQuiet}
                  onTabContextMenu={handleTabContextMenu}
                  onTabTearOff={handleTabTearOff}
                  onNewTab={handleNewTab}
                />
              );
            }
            return (
              <div className="flex h-full items-center justify-center text-neutral-400 text-xs">
                <button
                  onClick={handleNewGlobal}
                  className="px-3 py-1.5 rounded bg-neutral-200 hover:bg-neutral-300 text-neutral-600 transition-colors"
                >
                  + New Chat
                </button>
              </div>
            );
          })()}
        </ErrorBoundary>
      </div>
    </div>
  );
}

function ConnectedApp({
  connection,
}: {
  connection: Extract<WsConnectionState, { status: "connected" }>;
}) {
  return (
    <RpcProvider value={connection.rpc}>
      <EventsProvider value={connection.events}>
        <KyjuClientProvider value={connection.kyjuClient}>
          <KyjuProvider
            client={connection.kyjuClient}
            replica={connection.replica}
          >
            <ShortcutForwarderProvider windowId={windowId!}>
              <OrchestratorContent />
            </ShortcutForwarderProvider>
          </KyjuProvider>
        </KyjuClientProvider>
      </EventsProvider>
    </RpcProvider>
  );
}

export function App() {
  const connection = useWsConnection();

  if (connection.status === "connecting") {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500 text-xs"></div>
    );
  }

  if (connection.status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-red-400 text-xs">
        {connection.error}
      </div>
    );
  }

  return (
    <ErrorBoundary
      scope="root"
      fallback={({ error, reset }) => (
        <FullErrorFallback error={error} onReset={reset} />
      )}
    >
      <ConnectedApp connection={connection} />
    </ErrorBoundary>
  );
}
