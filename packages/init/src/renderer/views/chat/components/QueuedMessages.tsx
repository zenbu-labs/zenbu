import { useState } from "react"

type QueuedMessagesProps = {
  messages: Array<{ id: string; content: string }>
  onRemove?: (id: string) => void
  onClear?: () => void
}

export function QueuedMessages({
  messages,
  onRemove,
  onClear,
}: QueuedMessagesProps) {
  const [expanded, setExpanded] = useState(false)

  if (messages.length === 0) return null

  return (
    <div className="border-t border-neutral-300 bg-neutral-50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-left"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 animate-pulse-subtle">
          {messages.length} queued
        </span>
        <svg
          className={`h-3 w-3 text-neutral-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex-1" />
        {onClear && messages.length > 1 && (
          <span
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="text-[10px] text-neutral-500 hover:text-neutral-700"
          >
            Clear all
          </span>
        )}
      </button>
      {expanded && (
        <div className="flex flex-col gap-1 px-4 pb-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-center gap-2 rounded bg-white px-2.5 py-1.5 border border-neutral-200"
            >
              <span className="flex-1 truncate text-xs text-neutral-500">
                {msg.content}
              </span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(msg.id)}
                  className="shrink-0 text-neutral-400 hover:text-neutral-600"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
