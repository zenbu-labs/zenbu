import { useState, useCallback, useEffect } from "react"
import { useWsConnection, RpcProvider, KyjuClientProvider } from "../../lib/ws-connection"
import type { WsConnectionState } from "../../lib/ws-connection"
import { KyjuProvider } from "../../lib/kyju-react"
import { useRpc } from "../../lib/providers"

function StreamingConfigPanel() {
  const rpc = useRpc()
  const [config, setConfig] = useState({
    charsPerSecond: 120,
    chunkSize: 5,
    tokensPerSecond: 40,
    thinkingDelayMs: 200,
    toolCallDelayMs: 300,
    interChunkJitter: 0.3,
  })
  const [connected, setConnected] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      const result = await rpc.getStreamingConfig()
      if (result && "_tag" in result && result._tag === "success") {
        setConfig(result.data as any)
        setConnected(true)
      }
    } catch {
      setConnected(false)
    }
  }, [rpc])

  useEffect(() => { loadConfig() }, [loadConfig])

  const updateField = useCallback(
    async (key: string, value: number) => {
      const updated = { ...config, [key]: value }
      setConfig(updated)
      await rpc.updateStreamingConfig({ [key]: value })
    },
    [rpc, config],
  )

  if (!connected) {
    return (
      <div className="p-4 text-neutral-500">
        Not connected to mock agent. Use the connection panel to connect first.
      </div>
    )
  }

  const sliders = [
    { key: "charsPerSecond", label: "Chars/sec", min: 10, max: 500, step: 10 },
    { key: "chunkSize", label: "Chunk Size", min: 1, max: 50, step: 1 },
    { key: "tokensPerSecond", label: "Tokens/sec", min: 5, max: 200, step: 5 },
    { key: "thinkingDelayMs", label: "Thinking Delay (ms)", min: 0, max: 2000, step: 50 },
    { key: "toolCallDelayMs", label: "Tool Call Delay (ms)", min: 0, max: 2000, step: 50 },
    { key: "interChunkJitter", label: "Jitter", min: 0, max: 1, step: 0.05 },
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-700">Streaming Configuration</h3>
      {sliders.map(({ key, label, min, max, step }) => (
        <div key={key} className="space-y-1">
          <div className="flex justify-between text-xs text-neutral-600">
            <span>{label}</span>
            <span className="font-mono">{(config as any)[key]}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={(config as any)[key]}
            onChange={(e) => updateField(key, Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      ))}
    </div>
  )
}

function FuzzConfigPanel() {
  const rpc = useRpc()
  const [fuzz, setFuzz] = useState({
    enabled: false,
    randomDelayRange: [0, 0] as [number, number],
    dropChunkProbability: 0,
    errorProbability: 0,
    partialChunkProbability: 0,
  })

  const loadFuzz = useCallback(async () => {
    try {
      const result = await rpc.getFuzzConfig()
      if (result && "_tag" in result && result._tag === "success") {
        setFuzz(result.data as any)
      }
    } catch {}
  }, [rpc])

  useEffect(() => { loadFuzz() }, [loadFuzz])

  const toggle = useCallback(async () => {
    const updated = { ...fuzz, enabled: !fuzz.enabled }
    setFuzz(updated)
    await rpc.setFuzzConfig({ enabled: updated.enabled })
  }, [rpc, fuzz])

  const updateField = useCallback(
    async (key: string, value: number) => {
      const updated = { ...fuzz, [key]: value }
      setFuzz(updated)
      await rpc.setFuzzConfig({ [key]: value })
    },
    [rpc, fuzz],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">Fuzz Testing</h3>
        <button
          onClick={toggle}
          className={`px-3 py-1 text-xs rounded font-medium ${
            fuzz.enabled
              ? "bg-red-100 text-red-700"
              : "bg-neutral-200 text-neutral-600"
          }`}
        >
          {fuzz.enabled ? "Enabled" : "Disabled"}
        </button>
      </div>
      {fuzz.enabled && (
        <div className="space-y-3">
          {[
            { key: "dropChunkProbability", label: "Drop Chunk %", max: 1, step: 0.05 },
            { key: "errorProbability", label: "Error %", max: 1, step: 0.05 },
            { key: "partialChunkProbability", label: "Partial Chunk %", max: 1, step: 0.05 },
          ].map(({ key, label, max, step }) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs text-neutral-600">
                <span>{label}</span>
                <span className="font-mono">{((fuzz as any)[key] * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={max}
                step={step}
                value={(fuzz as any)[key]}
                onChange={(e) => updateField(key, Number(e.target.value))}
                className="w-full accent-red-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScenarioPanel() {
  const rpc = useRpc()
  const [scenarios, setScenarios] = useState<{
    custom: any[]
    builtin: any[]
    activeId: string
  }>({ custom: [], builtin: [], activeId: "" })

  const load = useCallback(async () => {
    try {
      const result = await rpc.listScenarios()
      if (result && "_tag" in result && result._tag === "success") {
        setScenarios(result.data as any)
      }
    } catch {}
  }, [rpc])

  useEffect(() => { load() }, [load])

  const activate = useCallback(
    async (id: string) => {
      await rpc.activateScenario(id)
      setScenarios((prev) => ({ ...prev, activeId: id }))
    },
    [rpc],
  )

  const deactivate = useCallback(async () => {
    await rpc.activateScenario("")
    setScenarios((prev) => ({ ...prev, activeId: "" }))
  }, [rpc])

  const allScenarios = [...scenarios.builtin, ...scenarios.custom]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">Scenarios</h3>
        {scenarios.activeId && (
          <button
            onClick={deactivate}
            className="px-2 py-0.5 text-xs rounded bg-neutral-200 text-neutral-600"
          >
            Clear
          </button>
        )}
      </div>
      <div className="space-y-1">
        {allScenarios.map((s: any) => (
          <button
            key={s.id}
            onClick={() => activate(s.id)}
            className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
              s.id === scenarios.activeId
                ? "bg-blue-100 text-blue-800 font-medium"
                : "bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200"
            }`}
          >
            <div className="font-medium">{s.name}</div>
            <div className="text-neutral-500 mt-0.5">{s.description}</div>
          </button>
        ))}
        {allScenarios.length === 0 && (
          <div className="text-xs text-neutral-400 text-center py-4">
            No scenarios available
          </div>
        )}
      </div>
    </div>
  )
}

type AgentEntry = {
  id: string
  pid: number
  controlPort: number
  startedAt: number
  lastSeen: number
  cwd: string
  status: string
}

function AgentListPanel() {
  const rpc = useRpc()
  const [agents, setAgents] = useState<AgentEntry[]>([])
  const [connectedId, setConnectedId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    try {
      const result = await rpc.listRegisteredAgents()
      const list = (result as any)?._tag === "success"
        ? (result as any).data
        : Array.isArray(result) ? result : []
      setAgents(list)
    } catch {}
  }, [rpc])

  useEffect(() => {
    rpc.connectToDaemon().catch(() => {})
    refresh()
    const timer = setInterval(refresh, 3000)
    return () => clearInterval(timer)
  }, [rpc, refresh])

  const connectToAgent = useCallback(async (agent: AgentEntry) => {
    setConnecting(agent.id)
    setError("")
    try {
      await rpc.connectToAgent(agent.id)
      setConnectedId(agent.id)
    } catch (err) {
      setError(String(err))
    } finally {
      setConnecting(null)
    }
  }, [rpc])

  const statusColor = (s: string) => {
    if (s === "ready" || s === "idle") return "bg-green-400"
    if (s === "prompting") return "bg-yellow-400"
    if (s === "starting") return "bg-blue-400"
    return "bg-neutral-400"
  }

  const uptime = (t: number) => {
    const s = Math.floor((Date.now() - t) / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m`
    return `${Math.floor(m / 60)}h ${m % 60}m`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">Active Agents</h3>
        <button onClick={refresh} className="text-xs text-neutral-400 hover:text-neutral-600">Refresh</button>
      </div>
      {agents.length === 0 ? (
        <div className="text-xs text-neutral-400 text-center py-6 border border-dashed border-neutral-200 rounded">
          No agents running. Send a message with Mock Agent selected to spawn one.
        </div>
      ) : (
        <div className="space-y-1.5">
          {agents.map((a) => (
            <div
              key={a.id}
              className={`flex items-center gap-2 px-3 py-2 rounded border text-xs ${
                connectedId === a.id ? "border-blue-300 bg-blue-50" : "border-neutral-200 bg-white hover:bg-neutral-50"
              }`}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${statusColor(a.status)}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-neutral-800 truncate">{a.cwd.split("/").pop() || a.cwd}</div>
                <div className="text-neutral-400">PID {a.pid} &middot; :{a.controlPort} &middot; {uptime(a.startedAt)}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 shrink-0">{a.status}</span>
              {connectedId === a.id ? (
                <span className="text-[10px] text-green-600 font-medium shrink-0">Connected</span>
              ) : (
                <button
                  onClick={() => connectToAgent(a)}
                  disabled={connecting === a.id}
                  className="px-2 py-1 rounded bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 shrink-0"
                >
                  {connecting === a.id ? "..." : "Connect"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  )
}

function ManualConnectionPanel() {
  const rpc = useRpc()
  const [url, setUrl] = useState("ws://127.0.0.1:")
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState(false)

  const connect = useCallback(async () => {
    setStatus("connecting")
    setError("")
    try {
      await rpc.connectToMockAgent(url)
      setStatus("connected")
    } catch (err) {
      setError(String(err))
      setStatus("disconnected")
    }
  }, [rpc, url])

  return (
    <div className="space-y-2">
      <button onClick={() => setExpanded(!expanded)} className="text-xs text-neutral-400 hover:text-neutral-600">
        {expanded ? "Hide manual connection" : "Manual connection..."}
      </button>
      {expanded && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://127.0.0.1:9999"
              className="flex-1 px-2 py-1.5 text-xs border border-neutral-300 rounded bg-white"
            />
            <button
              onClick={connect}
              disabled={status === "connecting"}
              className="px-3 py-1.5 text-xs rounded bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              {status === "connecting" ? "..." : "Connect"}
            </button>
          </div>
          {status === "connected" && <div className="text-xs text-green-600 font-medium">Connected</div>}
          {error && <div className="text-xs text-red-500">{error}</div>}
        </div>
      )}
    </div>
  )
}

function ControlPanelContent() {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      <h2 className="text-base font-bold text-neutral-800">Control Panel</h2>
      <AgentListPanel />
      <ManualConnectionPanel />
      <hr className="border-neutral-200" />
      <StreamingConfigPanel />
      <hr className="border-neutral-200" />
      <FuzzConfigPanel />
      <hr className="border-neutral-200" />
      <ScenarioPanel />
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
      <KyjuClientProvider value={connection.kyjuClient}>
        <KyjuProvider client={connection.kyjuClient} replica={connection.replica}>
          <ControlPanelContent />
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
