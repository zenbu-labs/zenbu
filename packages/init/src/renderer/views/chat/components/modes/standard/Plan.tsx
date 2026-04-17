import type { PlanProps } from "../../../lib/chat-components"
import { PlanCard } from "../../PlanCard"

export function Plan({ entries }: PlanProps) {
  return <div className="px-3"><PlanCard entries={entries} /></div>
}
