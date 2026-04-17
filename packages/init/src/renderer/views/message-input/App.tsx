import {
  useWsConnection,
  RpcProvider,
  EventsProvider,
  KyjuClientProvider,
} from "../../lib/ws-connection"
import { KyjuProvider } from "../../lib/kyju-react"
import type { WsConnectionState } from "../../lib/ws-connection"
import { ComposerPanel } from "../chat/ComposerPanel"

const agentId = new URLSearchParams(window.location.search).get("agentId") ?? ""

function MessageInputContent() {
  if (!agentId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-400 text-sm">
        <p>No agent ID specified</p>
        <p className="text-xs text-neutral-300">
          Add <code className="bg-neutral-100 px-1 rounded">?agentId=your-agent-id</code> to the URL
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1" />
      <ComposerPanel agentId={agentId} />
    </div>
  )
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
          <KyjuProvider
            client={connection.kyjuClient}
            replica={connection.replica}
          >
            <MessageInputContent />
          </KyjuProvider>
        </KyjuClientProvider>
      </EventsProvider>
    </RpcProvider>
  )
}

export function App() {
  const connection = useWsConnection()

  if (connection.status === "connecting") {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400 text-sm">
        
      </div>
    )
  }

  if (connection.status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-red-400 text-sm">
        {connection.error}
      </div>
    )
  }

  return <ConnectedApp connection={connection} />
}
