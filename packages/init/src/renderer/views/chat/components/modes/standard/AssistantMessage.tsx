import { Streamdown } from "streamdown"
import type { AssistantMessageProps } from "../../../lib/chat-components"
import { streamdownProps } from "../../../lib/streamdown-config"

export function AssistantMessage({ content }: AssistantMessageProps) {
  if (!content.trim()) return null

  return (
    <div className="py-1">
      <div className="text-foreground leading-relaxed min-w-0 overflow-hidden px-3">
        <Streamdown {...streamdownProps}>{content}</Streamdown>
      </div>
    </div>
  )
}
