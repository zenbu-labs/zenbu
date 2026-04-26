import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useWsConnection,
  RpcProvider,
  EventsProvider,
  KyjuClientProvider,
} from "../../lib/ws-connection";
import { KyjuProvider, useCollection, useDb } from "../../lib/kyju-react";
import { useKyjuClient } from "../../lib/providers";
import { useDragRegion } from "../../lib/drag-region";
import type { WsConnectionState } from "../../lib/ws-connection";
import { ChatDisplay } from "./ChatDisplay";
import { ComposerPanel } from "./ComposerPanel";
import { MinimapContent } from "./components/MinimapContent";
import type { ExpectedVisibleMessage } from "./lib/chat-invariants";

class ChatErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[chat-view] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onReset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const [showStack, setShowStack] = useState(false);

  return (
    <div className="flex h-full items-center justify-center bg-(--zenbu-panel) p-8">
      <div className="flex max-w-lg flex-col gap-3 rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-red-600">Something went wrong</div>
        <div className="text-xs text-neutral-600 font-mono break-all">{error.message}</div>
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

const searchParams = new URLSearchParams(window.location.search);
const agentId = searchParams.get("agentId") ?? "";
const windowId = searchParams.get("windowId") ?? "";
const isMinimap = searchParams.get("minimap") === "true";

let triggerExplosion: (() => void) | null = null;
(window as any).explode = () => {
  if (triggerExplosion) triggerExplosion();
  else console.warn("[chat-view] No explosion hook mounted yet");
};

function ExplosionTrap() {
  const [explode, setExplode] = useState(false);
  triggerExplosion = () => setExplode(true);
  if (explode) throw new Error("Manual explosion triggered from console");
  return null;
}

const CHAT_TITLE_BAR_HEIGHT = 36;
const CHAT_TITLE_FADE_HEIGHT = 16;

function ChatContent() {
  const scrollToBottomRef = useRef<(() => void) | null>(null);
  const expectedVisibleMessageRef = useRef<ExpectedVisibleMessage | null>(null);

  if (isMinimap) {
    return <MinimapContent agentId={agentId} />
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-(--zenbu-panel) relative">
      <ExplosionTrap />
      <ChatTitleBar />
      <div className="relative flex flex-1 min-h-0 min-w-0 flex-col">
        <ChatDisplay
          agentId={agentId}
          scrollToBottomRef={scrollToBottomRef}
          debugExpectedVisibleMessageRef={expectedVisibleMessageRef}
        />
        {/* Scroll-fade band: a thin gradient just below the title bar so
            content scrolling up dissolves into the chrome rather than
            slamming into the opaque title bar. Pointer-events:none keeps
            it click-through. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 top-0"
          style={{
            height: CHAT_TITLE_FADE_HEIGHT,
            background:
              "linear-gradient(to bottom, var(--zenbu-panel), color-mix(in srgb, var(--zenbu-panel) 0%, transparent))",
            zIndex: 5,
          }}
        />
        <ComposerPanel
          agentId={agentId}
          scrollToBottom={() => scrollToBottomRef.current?.()}
          debugExpectedVisibleMessageRef={expectedVisibleMessageRef}
        />
      </div>
    </div>
  );
}

function ChatTitleBar() {
  const client = useKyjuClient();
  const dragRef = useDragRegion<HTMLDivElement>();
  const agent = useDb((root) =>
    root.plugin.kernel.agents.find((a) => a.id === agentId),
  );
  const { items: events } = useCollection(agent?.eventLog);
  const sidebarOpen = useDb((root) => {
    const map = root.plugin.kernel.sidebarOpenByWindow;
    const v = map?.[windowId];
    return typeof v === "boolean" ? v : true;
  });

  const lastUserPrompt = useMemo(() => {
    let text: string | undefined;
    for (const e of events) {
      if (e?.data?.kind === "user_prompt") text = e.data.text;
    }
    return text;
  }, [events]);

  const title = agent?.title;
  const summary =
    title?.kind === "set"
      ? title.value
      : title?.kind === "generating"
        ? "…"
        : lastUserPrompt?.replace(/\s+/g, " ").trim() || "";
  const cwd =
    typeof agent?.metadata?.cwd === "string" ? agent.metadata.cwd : "";
  const project = cwd ? cwd.split("/").filter(Boolean).pop() || cwd : "";

  const toggleSidebar = useCallback(() => {
    const map = client.plugin.kernel.sidebarOpenByWindow.read() ?? {};
    const current =
      typeof map[windowId] === "boolean" ? map[windowId] : true;
    client.plugin.kernel.sidebarOpenByWindow.set({
      ...map,
      [windowId]: !current,
    });
  }, [client]);

  return (
    <div
      className="shrink-0 flex items-center bg-(--zenbu-panel) relative z-10"
      style={{
        height: CHAT_TITLE_BAR_HEIGHT,
        paddingLeft: sidebarOpen ? 0 : 8,
        paddingRight: 8,
      }}
    >
      {!sidebarOpen && (
        <button
          type="button"
          onClick={toggleSidebar}
          title="Show sidebar"
          className="inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-(--zenbu-control-hover) cursor-pointer shrink-0"
          style={{ width: 24, height: 24, marginRight: 8 }}
        >
          <SidebarToggleIcon />
        </button>
      )}
      <div
        ref={dragRef}
        className="flex-1 min-w-0 self-stretch flex items-center"
        style={{ paddingLeft: sidebarOpen ? 12 : 0 }}
      >
        <div
          className="min-w-0 flex items-baseline gap-1.5 text-[12px] text-muted-foreground"
          style={{
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {project && (
            <>
              <span className="text-foreground shrink-0" title={cwd}>
                {project}
              </span>
              <span className="text-muted-foreground shrink-0">/</span>
            </>
          )}
          <span
            className="text-muted-foreground"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              opacity: title?.kind === "generating" ? 0.5 : 1,
            }}
            title={summary}
          >
            {summary}
          </span>
        </div>
      </div>
    </div>
  );
}

function SidebarToggleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
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
            <ChatContent />
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
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        
      </div>
    );
  }

  if (connection.status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-red-400 text-sm">
        {connection.error}
      </div>
    );
  }

  return (
    <ChatErrorBoundary>
      <ConnectedApp connection={connection} />
    </ChatErrorBoundary>
  );
}
