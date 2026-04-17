import type { PlanEntry } from "../lib/materialize"

function PlanStatusIcon({ status }: { status: string }) {
  if (status === "in_progress") {
    return (
      <span className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-neutral-300 border-t-neutral-500 animate-spin-slow" />
    )
  }
  if (status === "completed") {
    return (
      <svg
        className="h-3.5 w-3.5 text-neutral-500 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
        />
      </svg>
    )
  }
  if (status === "failed") {
    return (
      <svg
        className="h-3.5 w-3.5 text-red-500 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    )
  }
  return <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 shrink-0 mx-[3.5px]" />
}

export function PlanCard({ entries }: { entries: PlanEntry[] }) {
  return (
    <div className="w-full rounded border border-neutral-300 px-3 py-2.5">
      <div className="font-medium uppercase tracking-wider text-neutral-500 mb-2">
        Plan
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="mt-0.5">
              <PlanStatusIcon status={entry.status} />
            </div>
            <span
              className={
                entry.status === "completed"
                  ? "text-neutral-500 line-through"
                  : entry.status === "in_progress"
                    ? "text-neutral-800 font-medium"
                    : "text-neutral-500"
              }
            >
              {entry.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
