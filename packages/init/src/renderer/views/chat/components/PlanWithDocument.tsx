import { useState } from "react"
import { Streamdown } from "streamdown"

type PlanDocumentProps = {
  title: string
  content: string
  status?: "pending" | "approved" | "rejected"
  onApprove?: () => void
  onReject?: () => void
  onEdit?: () => void
}

export function PlanDocument({
  title,
  content,
  status = "pending",
  onApprove,
  onReject,
  onEdit,
}: PlanDocumentProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="w-full rounded-lg border border-neutral-300 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50"
      >
        <svg
          className="h-3.5 w-3.5 text-neutral-500 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span className="flex-1 truncate text-xs font-medium text-neutral-700">
          {title}
        </span>
        {status === "pending" && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            Review
          </span>
        )}
        {status === "approved" && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
            Approved
          </span>
        )}
        {status === "rejected" && (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
            Rejected
          </span>
        )}
        <svg
          className={`h-3 w-3 text-neutral-500 transition-transform ${collapsed ? "" : "rotate-90"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!collapsed && (
        <>
          <div className="border-t border-neutral-300 px-4 py-3 max-h-80 overflow-y-auto">
            <div className="text-sm text-neutral-800 leading-relaxed">
              <Streamdown>{content}</Streamdown>
            </div>
          </div>

          {status === "pending" && (onApprove || onReject || onEdit) && (
            <div className="flex items-center gap-2 border-t border-neutral-300 px-3 py-2 bg-neutral-50">
              {onApprove && (
                <button
                  type="button"
                  onClick={onApprove}
                  className="rounded bg-green-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-green-600"
                >
                  Approve
                </button>
              )}
              {onReject && (
                <button
                  type="button"
                  onClick={onReject}
                  className="rounded border border-neutral-300 bg-white px-3 py-1 text-[11px] font-medium text-neutral-500 hover:bg-neutral-100"
                >
                  Reject
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="rounded px-3 py-1 text-[11px] text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
