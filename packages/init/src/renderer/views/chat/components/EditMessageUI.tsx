import { useState } from "react"

type EditMessageUIProps = {
  originalContent: string
  onSave: (newContent: string) => void
  onCancel: () => void
  saving?: boolean
}

export function EditMessageUI({
  originalContent,
  onSave,
  onCancel,
  saving = false,
}: EditMessageUIProps) {
  const [content, setContent] = useState(originalContent)

  return (
    <div className="rounded-lg border-2 border-blue-300 bg-white overflow-hidden">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={saving}
        className="w-full resize-none bg-white px-4 py-3 text-sm text-neutral-800 leading-relaxed outline-none min-h-[60px] max-h-[200px] disabled:opacity-50"
        rows={Math.min(content.split("\n").length + 1, 8)}
      />
      <div className="flex items-center justify-end gap-2 border-t border-blue-200 px-3 py-2 bg-blue-50">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded px-3 py-1 text-xs text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(content)}
          disabled={saving || content.trim() === ""}
          className="rounded bg-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving && (
            <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin-slow" />
          )}
          Save
        </button>
      </div>
    </div>
  )
}
