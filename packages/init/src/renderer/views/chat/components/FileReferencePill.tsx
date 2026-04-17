const iconCls = "h-3 w-3 shrink-0"

function FileIcon() {
  return (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

export function FileReferencePill({
  fileName,
  filePath,
}: {
  fileName: string
  filePath: string
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-blue-400/20 bg-blue-500/8 px-1 py-px align-bottom text-[11px] font-medium text-blue-600 max-w-[200px]"
      title={filePath}
    >
      <FileIcon />
      <span className="truncate">{fileName}</span>
    </span>
  )
}
