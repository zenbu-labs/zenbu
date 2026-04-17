type MentionPillProps = {
  type: "file" | "command" | "symbol" | "url"
  label: string
  onRemove?: () => void
}

const iconCls = "h-3 w-3 shrink-0"

function TypeIcon({ type }: { type: MentionPillProps["type"] }) {
  switch (type) {
    case "file":
      return (
        <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )
    case "command":
      return (
        <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      )
    case "symbol":
      return (
        <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      )
    case "url":
      return (
        <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      )
  }
}

const colorMap = {
  file: "bg-blue-50 text-blue-700 border-blue-200/60",
  command: "bg-amber-50 text-amber-700 border-amber-200/60",
  symbol: "bg-purple-50 text-purple-700 border-purple-200/60",
  url: "bg-green-50 text-green-700 border-green-200/60",
}

export function MentionPill({ type, label, onRemove }: MentionPillProps) {
  return (
    <span
      className={`group/pill inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium max-w-[200px] ${colorMap[type]}`}
    >
      <TypeIcon type={type} />
      <span className="truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 hidden shrink-0 rounded-sm opacity-60 hover:opacity-100 group-hover/pill:inline-flex"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </span>
  )
}
