import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { useWsConnection, RpcProvider, KyjuClientProvider } from "../../lib/ws-connection"
import type { WsConnectionState } from "../../lib/ws-connection"
import { KyjuProvider } from "../../lib/kyju-react"
import { useRpc } from "../../lib/providers"
import { createKyjuReact } from "@zenbu/kyju/react"
import type { MockAgentSchema } from "../../../../shared/schema"

const mockKyju = createKyjuReact<MockAgentSchema>()

function PromptTesterInner() {
  const rpc = useRpc()
  const { items: events } = mockKyju.useCollection((c) => c.events)
  const agentState = mockKyju.useDb((root) => root.agentState)
  const [prompt, setPrompt] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.timestamp - b.timestamp),
    [events],
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [sortedEvents.length])

  const handleCancel = useCallback(async () => {
    await rpc.cancel()
  }, [rpc])

  const isPrompting = agentState === "prompting"

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sortedEvents.length === 0 ? (
          <div className="text-xs text-neutral-400 text-center mt-12">
            Events from the mock agent will appear here.
            <br />
            Send a prompt from the desktop app or use a scenario to test.
          </div>
        ) : (
          sortedEvents.map((event, i) => {
            const isUser = event.direction === "received"
            return (
              <div
                key={i}
                className={`text-xs p-2 rounded ${
                  isUser
                    ? "bg-blue-50 border border-blue-200"
                    : "bg-neutral-50 border border-neutral-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-medium ${
                      isUser ? "text-blue-600" : "text-neutral-600"
                    }`}
                  >
                    {isUser ? "Received" : "Emitted"}
                  </span>
                  <span className="text-neutral-400 font-mono">
                    {event.updateType}
                  </span>
                  <span className="text-neutral-300 ml-auto font-mono">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="font-mono text-xs whitespace-pre-wrap text-neutral-700 max-h-32 overflow-y-auto">
                  {typeof event.data === "string"
                    ? event.data
                    : JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-neutral-200 p-3 bg-white">
        {isPrompting && (
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-yellow-600 font-medium">
              Agent is processing...
            </span>
            <button
              onClick={handleCancel}
              className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="text-xs text-neutral-400 text-center">
          Send prompts to the mock agent from the desktop app.
          <br />
          This view shows the event stream in real-time.
        </div>
      </div>
    </div>
  )
}

function PromptTesterContent({
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
      <PromptTesterInner />
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
          <PromptTesterContent connection={connection} />
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
