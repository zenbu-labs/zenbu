import { useState } from "react"
import { createKyjuReact } from "@zenbu/kyju/react"
import type { MockAgentSchema } from "../shared/schema"
import {
  useControlConnection,
  RpcProvider,
  DbProvider,
  SendPromptProvider,
  type ControlConnectionState,
} from "./lib/use-control-connection"
import { StreamingConfigPanel } from "./panels/StreamingConfigPanel"
import { FuzzConfigPanel } from "./panels/FuzzConfigPanel"
import { ScenarioPanel } from "./panels/ScenarioPanel"
import { EventViewer } from "./panels/EventViewer"
import { AgentStatePanel } from "./panels/AgentState"
import { TestPromptPanel } from "./panels/TestPrompt"

export const mockKyju = createKyjuReact<MockAgentSchema>()

const TABS = [
  { id: "control", label: "Control" },
  { id: "events", label: "Events" },
  { id: "state", label: "State" },
] as const

type TabId = (typeof TABS)[number]["id"]

function DevtoolsContent() {
  const [activeTab, setActiveTab] = useState<TabId>("control")

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* Title bar */}
      <div
        className="h-9 flex items-center shrink-0 border-b border-neutral-200 bg-white"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="pl-20" />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-2 py-1 bg-white border-b border-neutral-200 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              activeTab === tab.id
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "control" && (
          <div className="h-full overflow-y-auto p-4 space-y-6">
            <TestPromptPanel />
            <hr className="border-neutral-200" />
            <StreamingConfigPanel />
            <hr className="border-neutral-200" />
            <FuzzConfigPanel />
            <hr className="border-neutral-200" />
            <ScenarioPanel />
          </div>
        )}
        {activeTab === "events" && <EventViewer />}
        {activeTab === "state" && <AgentStatePanel />}
      </div>
    </div>
  )
}

function ConnectedApp({
  connection,
}: {
  connection: Extract<ControlConnectionState, { status: "connected" }>
}) {
  return (
    <RpcProvider value={connection.rpc}>
      <DbProvider value={connection.db}>
        <SendPromptProvider value={connection.sendPrompt}>
          <mockKyju.KyjuProvider
            client={connection.db}
            replica={connection.replica}
          >
            <DevtoolsContent />
          </mockKyju.KyjuProvider>
        </SendPromptProvider>
      </DbProvider>
    </RpcProvider>
  )
}

export function App() {
  const connection = useControlConnection()

  if (connection.status === "connecting") {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500 text-sm">
        Connecting to agent...
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
