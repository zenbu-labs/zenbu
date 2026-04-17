import type { PlanEntry } from "../lib/materialize"

function PlanCheckbox({ status }: { status: string }) {
  if (status === "in_progress") {
    return (
      <span className="relative h-3.5 w-3.5 shrink-0 rounded-[3px] border border-neutral-400">
        <span className="absolute inset-0 rounded-[3px] border border-transparent border-t-neutral-700 animate-spin-slow" />
      </span>
    )
  }
  if (status === "completed") {
    return (
      <span className="h-3.5 w-3.5 shrink-0 rounded-[3px] bg-neutral-700 flex items-center justify-center">
        <svg
          className="h-2.5 w-2.5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (status === "failed") {
    return (
      <span className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-red-400 flex items-center justify-center">
        <svg
          className="h-2.5 w-2.5 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    )
  }
  return <span className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-neutral-300" />
}

export function PlanCard({ entries }: { entries: PlanEntry[] }) {
  return (
    <div className="w-full">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1.5">
        Plan
      </div>
      <div className="flex flex-col">
        {entries.map((entry, i) => (
          <label
            key={i}
            className="flex items-start gap-2.5 py-1 cursor-default"
          >
            <span className="mt-[3px]">
              <PlanCheckbox status={entry.status} />
            </span>
            <span
              className={
                "text-[13px] leading-[1.45] " +
                (entry.status === "completed"
                  ? "text-neutral-400 line-through"
                  : entry.status === "in_progress"
                    ? "text-neutral-900 font-medium"
                    : entry.status === "failed"
                      ? "text-red-600"
                      : "text-neutral-700")
              }
            >
              {entry.content}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
