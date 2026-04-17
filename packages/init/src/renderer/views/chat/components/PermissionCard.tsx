type PermissionOption = {
  optionId: string
  label: string
  kind: "allow_once" | "allow_always" | "reject_once" | "reject_always"
}

type PermissionCardProps = {
  title: string
  kind: string
  description: string
  options: PermissionOption[]
  onSelect: (optionId: string) => void
}

function optionStyle(kind: PermissionOption["kind"]) {
  if (kind === "reject_once" || kind === "reject_always") {
    return "text-red-500 border-neutral-300 hover:bg-neutral-100"
  }
  return "text-neutral-700 border-neutral-300 hover:bg-neutral-100"
}

export function PermissionCard({
  title,
  description,
  options,
  onSelect,
}: PermissionCardProps) {
  return (
    <div className="w-full rounded border border-neutral-300 overflow-hidden">
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-medium text-neutral-700 truncate">
            {title}
          </span>
          <span className="ml-auto text-sm text-neutral-500">
            Waiting
          </span>
        </div>
        <p className="text-sm text-neutral-500 leading-relaxed mb-3">
          {description}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {options.map((option) => (
            <button
              key={option.optionId}
              type="button"
              onClick={() => onSelect(option.optionId)}
              className={`rounded border px-3 py-1 text-sm font-medium ${optionStyle(option.kind)}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
