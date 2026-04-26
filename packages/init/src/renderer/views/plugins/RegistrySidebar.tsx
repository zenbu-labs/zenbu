import type { DiscoverKey } from "./App"

const DISCOVER_ITEMS: { key: DiscoverKey; label: string }[] = [
  { key: "all", label: "Plugins" },
  { key: "installed", label: "Installed" },
  { key: "updates", label: "Updates" },
  { key: "local", label: "Local" },
]

export function RegistryTabs({
  counts,
  discover,
  onDiscover,
}: {
  counts: Record<DiscoverKey, number>
  discover: DiscoverKey
  onDiscover: (k: DiscoverKey) => void
}) {
  return (
    <div
      className="shrink-0 flex items-end gap-0 px-3"
      style={{
        background: "var(--zenbu-panel)",
        borderBottom: "1px solid var(--zenbu-panel-border)",
      }}
    >
      {DISCOVER_ITEMS.map((item) => (
        <Tab
          key={item.key}
          label={item.label}
          count={item.key === "all" ? undefined : counts[item.key]}
          active={discover === item.key}
          onClick={() => onDiscover(item.key)}
        />
      ))}
    </div>
  )
}

function Tab({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex items-center gap-1.5 px-3 py-2 text-[13px] cursor-pointer transition-colors"
      style={{
        color: active ? "var(--foreground)" : "var(--muted-foreground)",
        fontWeight: active ? 500 : 400,
      }}
    >
      <span>{label}</span>
      {count != null && count > 0 && (
        <span
          className="text-[11px] tabular-nums px-1 rounded"
          style={{
            color: active ? "var(--foreground)" : "var(--muted-foreground)",
            background: active ? "var(--zenbu-control-hover)" : "transparent",
            minWidth: 16,
            textAlign: "center",
          }}
        >
          {count}
        </span>
      )}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 right-0 bottom-0"
          style={{
            height: 2,
            background: "var(--foreground)",
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
          }}
        />
      )}
    </button>
  )
}
