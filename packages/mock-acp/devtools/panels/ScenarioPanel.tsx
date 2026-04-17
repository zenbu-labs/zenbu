import { useState, useCallback, useEffect } from "react"
import type { Scenario } from "../../shared/schema"
import { useRpc } from "../lib/use-control-connection"

type ScenarioList = {
  custom: Scenario[]
  builtin: Scenario[]
  activeId: string
}

export function ScenarioPanel() {
  const rpc = useRpc()
  const [scenarios, setScenarios] = useState<ScenarioList>({
    custom: [],
    builtin: [],
    activeId: "",
  })

  const load = useCallback(async () => {
    try {
      const result = await rpc.listScenarios()
      setScenarios(result)
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
        {allScenarios.map((s) => (
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
