import {
  useWsConnection,
  RpcProvider,
  EventsProvider,
  KyjuClientProvider,
} from "../../lib/ws-connection"
import { KyjuProvider } from "../../lib/kyju-react"
import type { WsConnectionState } from "../../lib/ws-connection"
import { Terminal } from "./Terminal"

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
            <Terminal />
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
      <div className="flex h-full items-center justify-center bg-[#0a0a0a] font-mono text-sm text-neutral-600">
        connecting…
      </div>
    )
  }

  if (connection.status === "error") {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0a] font-mono text-sm text-red-500">
        {connection.error}
      </div>
    )
  }

  return <ConnectedApp connection={connection} />
}
