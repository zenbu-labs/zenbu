export function StatusIndicator({ status }: { status: string }) {
  if (status === "in_progress") {
    return (
      <span className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-neutral-300 border-t-neutral-500 animate-spin" />
    )
  }
  if (status === "completed") {
    return null
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
  return <span className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-neutral-300 border-t-neutral-500 animate-spin" />
}
