import { useWsConnection, RpcProvider, KyjuClientProvider } from "../../lib/ws-connection"
import type { WsConnectionState } from "../../lib/ws-connection"
import { KyjuProvider } from "../../lib/kyju-react"
import { createKyjuReact } from "@zenbu/kyju/react"
import type { MockAgentSchema } from "../../../../shared/schema"

const mockKyju = createKyjuReact<MockAgentSchema>()

const STATES = ["idle", "prompting", "streaming", "cancelled"] as const
const STATE_COLORS: Record<string, string> = {
  idle: "bg-neutral-200 text-neutral-700",
  prompting: "bg-yellow-100 text-yellow-800",
  streaming: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
}

function StateMachine() {
  const agentState = mockKyju.useDb((root) => root.agentState)
  const sessionId = mockKyju.useDb((root) => root.currentSessionId)
  const controlPort = mockKyju.useDb((root) => root.controlPort)
  const streamingConfig = mockKyju.useDb((root) => root.streamingConfig)
  const fuzzConfig = mockKyju.useDb((root) => root.fuzzConfig)

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      <h2 className="text-base font-bold text-neutral-800">Agent State</h2>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
          State Machine
        </h3>
        <div className="flex gap-2">
          {STATES.map((s) => (
            <div
              key={s}
              className={`px-3 py-2 rounded text-xs font-medium ${
                s === agentState
                  ? STATE_COLORS[s] + " ring-2 ring-offset-1 ring-blue-400"
                  : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {s}
            </div>
          ))}
        </div>
        <div className="text-xs text-neutral-500 flex gap-1">
          idle
          <span className="text-neutral-300">&rarr;</span>
          prompting
          <span className="text-neutral-300">&rarr;</span>
          streaming
          <span className="text-neutral-300">&rarr;</span>
          idle
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
          Session Info
        </h3>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <dt className="text-neutral-500">Session ID</dt>
          <dd className="font-mono text-neutral-800">{sessionId || "—"}</dd>
          <dt className="text-neutral-500">Control Port</dt>
          <dd className="font-mono text-neutral-800">{controlPort || "—"}</dd>
          <dt className="text-neutral-500">Current State</dt>
          <dd className="font-mono text-neutral-800">{agentState}</dd>
        </dl>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
          Streaming Config
        </h3>
        {streamingConfig && (
          <pre className="text-xs font-mono bg-neutral-50 p-3 rounded border border-neutral-200 whitespace-pre-wrap">
            {JSON.stringify(streamingConfig, null, 2)}
          </pre>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
          Fuzz Config
        </h3>
        {fuzzConfig && (
          <pre className="text-xs font-mono bg-neutral-50 p-3 rounded border border-neutral-200 whitespace-pre-wrap">
            {JSON.stringify(fuzzConfig, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

function AgentStateContent({
  connection,
}: {
  connection: Extract<WsConnectionState, { status: "connected" }>
}) {
  if (!connection.mockAgentClient || !connection.mockAgentReplica) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500 text-sm">
        Mock agent not connected. Connect from the Control Panel first.
      </div>
    )
  }

  return (
    <mockKyju.KyjuProvider
      client={connection.mockAgentClient}
      replica={connection.mockAgentReplica}
    >
      <StateMachine />
    </mockKyju.KyjuProvider>
  )
}

function ConnectedApp({
  connection,
}: {
  connection: Extract<WsConnectionState, { status: "connected" }>
}) {
  return (
    <RpcProvider value={connection.rpc}>
      <KyjuClientProvider value={connection.kyjuClient}>
        <KyjuProvider client={connection.kyjuClient} replica={connection.replica}>
          <AgentStateContent connection={connection} />
        </KyjuProvider>
      </KyjuClientProvider>
    </RpcProvider>
  )
}

export function App() {
  const connection = useWsConnection()

  if (connection.status === "connecting") {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500 text-sm">
        
      </div>
    )
  }

  if (connection.status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-red-500 text-sm">
        {connection.error}
      </div>
    )
  }

  return <ConnectedApp connection={connection} />
}
