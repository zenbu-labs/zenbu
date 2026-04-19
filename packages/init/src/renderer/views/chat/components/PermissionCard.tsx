type PermissionOption = {
  optionId: string
  // ACP's canonical field for the user-facing label — matches
  // @agentclientprotocol/sdk's PermissionOption type.
  name: string
  kind: "allow_once" | "allow_always" | "reject_once" | "reject_always"
}

type PermissionCardProps = {
  title: string
  kind: string
  description: string
  options: PermissionOption[]
  onSelect: (optionId: string) => void
  /** If set, the prompt has already been answered and is rendered as resolved. */
  selectedOptionId?: string
  /** If true, user cancelled without picking an option. */
  cancelled?: boolean
}

function optionStyle(kind: PermissionOption["kind"]) {
  const base =
    "border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100 transition-colors"
  if (kind === "reject_once" || kind === "reject_always") {
    return `text-red-500 ${base}`
  }
  return `text-neutral-700 ${base}`
}

export function PermissionCard({
  title,
  description,
  options,
  onSelect,
  selectedOptionId,
  cancelled,
}: PermissionCardProps) {
  const resolved = selectedOptionId !== undefined || cancelled === true
  const chosenLabel = cancelled
    ? "Cancelled"
    : (options.find((o) => o.optionId === selectedOptionId)?.name ??
      selectedOptionId)

  return (
    <div className="w-full rounded border border-neutral-300 overflow-hidden">
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-medium text-neutral-700 truncate">
            {title}
          </span>
          <span className="ml-auto text-sm text-neutral-500">
            {resolved ? chosenLabel : "Waiting"}
          </span>
        </div>
        <p className="text-sm text-neutral-500 leading-relaxed mb-3">
          {description}
        </p>
        {!resolved && (
          <div className="flex flex-col gap-1.5 w-full">
            {options.map((option) => (
              <button
                key={option.optionId}
                type="button"
                onClick={() => onSelect(option.optionId)}
                className={`w-full rounded border px-3 py-1.5 text-sm font-medium text-left ${optionStyle(option.kind)}`}
              >
                {option.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
