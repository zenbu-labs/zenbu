import { useState, useCallback, useEffect } from "react"
import type { FuzzConfig } from "../../shared/schema"
import { useRpc } from "../lib/use-control-connection"

const PROB_SLIDERS: { key: keyof FuzzConfig; label: string }[] = [
  { key: "dropChunkProbability", label: "Drop Chunk %" },
  { key: "errorProbability", label: "Error %" },
  { key: "partialChunkProbability", label: "Partial Chunk %" },
]

export function FuzzConfigPanel() {
  const rpc = useRpc()
  const [fuzz, setFuzz] = useState<FuzzConfig>({
    enabled: false,
    randomDelayRange: [0, 0],
    dropChunkProbability: 0,
    errorProbability: 0,
    partialChunkProbability: 0,
  })

  const loadFuzz = useCallback(async () => {
    try {
      const result = await rpc.getFuzzConfig()
      setFuzz(result)
    } catch {}
  }, [rpc])

  useEffect(() => { loadFuzz() }, [loadFuzz])

  const toggle = useCallback(async () => {
    const updated = { ...fuzz, enabled: !fuzz.enabled }
    setFuzz(updated)
    await rpc.setFuzzConfig({ enabled: updated.enabled })
  }, [rpc, fuzz])

  const updateField = useCallback(
    async (key: keyof FuzzConfig, value: number) => {
      setFuzz((prev) => ({ ...prev, [key]: value }))
      await rpc.setFuzzConfig({ [key]: value })
    },
    [rpc],
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
          {PROB_SLIDERS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs text-neutral-600">
                <span>{label}</span>
                <span className="font-mono">{((fuzz[key] as number) * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={fuzz[key] as number}
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
