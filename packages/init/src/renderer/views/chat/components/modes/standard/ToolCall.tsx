import type { ToolCallProps } from "../../../lib/chat-components"
import { ToolCallCard } from "../../ToolCallCard"

export function ToolCall(props: ToolCallProps) {
  return <div className="px-3"><ToolCallCard {...props} /></div>
}
