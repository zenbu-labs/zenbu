import type { SimulationContext } from "./engine.ts"
import type { ScenarioStep } from "../../shared/schema.ts"

type PlanStep = Extract<ScenarioStep, { type: "plan" }>

export async function emitPlan(
  ctx: SimulationContext,
  step: PlanStep,
): Promise<void> {
  const { conn, sessionId } = ctx

  conn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: "plan",
      entries: step.entries,
    },
  })
}
