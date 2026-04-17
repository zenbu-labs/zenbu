import { useState, useCallback, useEffect } from "react"
import type { StreamingConfig } from "../../shared/schema"
import { useRpc } from "../lib/use-control-connection"

const SLIDERS: { key: keyof StreamingConfig; label: string; min: number; max: number; step: number }[] = [
  { key: "charsPerSecond", label: "Chars/sec", min: 10, max: 500, step: 10 },
  { key: "chunkSize", label: "Chunk Size", min: 1, max: 50, step: 1 },
  { key: "tokensPerSecond", label: "Tokens/sec", min: 5, max: 200, step: 5 },
  { key: "thinkingDelayMs", label: "Thinking Delay (ms)", min: 0, max: 2000, step: 50 },
  { key: "toolCallDelayMs", label: "Tool Call Delay (ms)", min: 0, max: 2000, step: 50 },
  { key: "interChunkJitter", label: "Jitter", min: 0, max: 1, step: 0.05 },
]

export function StreamingConfigPanel() {
  const rpc = useRpc()
  const [config, setConfig] = useState<StreamingConfig | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      const result = await rpc.getStreamingConfig()
      setConfig(result)
    } catch {}
  }, [rpc])

  useEffect(() => { loadConfig() }, [loadConfig])

  const updateField = useCallback(
    async (key: keyof StreamingConfig, value: number) => {
      setConfig((prev) => prev ? { ...prev, [key]: value } : prev)
      await rpc.updateStreamingConfig({ [key]: value })
    },
    [rpc],
  )

  if (!config) {
    return <div className="text-xs text-neutral-400">Loading config...</div>
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-700">Streaming Configuration</h3>
      {SLIDERS.map(({ key, label, min, max, step }) => (
        <div key={key} className="space-y-1">
          <div className="flex justify-between text-xs text-neutral-600">
            <span>{label}</span>
            <span className="font-mono">{config[key]}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={config[key]}
            onChange={(e) => updateField(key, Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      ))}
    </div>
  )
}
