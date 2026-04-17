import { Streamdown } from "streamdown"
import type { ThinkingBlockProps } from "../../../lib/chat-components"
import { streamdownProps } from "../../../lib/streamdown-config"

export function ThinkingBlock({ content }: ThinkingBlockProps) {
  return (
    <div className="leading-relaxed text-neutral-500 text-xs min-w-0 overflow-hidden px-3">
      <Streamdown {...streamdownProps}>{content}</Streamdown>
    </div>
  )
}
