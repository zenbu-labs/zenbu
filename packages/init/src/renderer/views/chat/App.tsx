import { Component, type ErrorInfo, type ReactNode, useRef, useState } from "react";
import {
  useWsConnection,
  RpcProvider,
  EventsProvider,
  KyjuClientProvider,
} from "../../lib/ws-connection";
import { KyjuProvider } from "../../lib/kyju-react";
import type { WsConnectionState } from "../../lib/ws-connection";
import { ChatDisplay } from "./ChatDisplay";
import { ComposerPanel } from "./ComposerPanel";
import { MinimapContent } from "./components/MinimapContent";

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
    <div className="flex h-full items-center justify-center bg-[#F4F4F4] p-8">
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

function ChatContent() {
  const scrollToBottomRef = useRef<(() => void) | null>(null);

  if (isMinimap) {
    return <MinimapContent agentId={agentId} />
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-[#F4F4F4] relative">
      <ExplosionTrap />
      <ChatDisplay agentId={agentId} scrollToBottomRef={scrollToBottomRef} />
      <ComposerPanel agentId={agentId} scrollToBottom={() => scrollToBottomRef.current?.()} />
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
      <div className="flex h-full items-center justify-center text-neutral-400 text-sm">
        
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
