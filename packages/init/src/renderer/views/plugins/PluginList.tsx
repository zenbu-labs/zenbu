import { useMemo, useState } from "react"
import type { Activity, DiscoverKey, PluginEntry } from "./App"

export function PluginList({
  listing,
  loadError,
  search,
  onSearch,
  discover,
  selectedName,
  onSelect,
  activityByName,
  onInstallFromUrl,
  expanded,
}: {
  listing: {
    source: "remote" | "local"
    entries: PluginEntry[]
    warning?: string
  } | null
  loadError: string | null
  search: string
  onSearch: (v: string) => void
  discover: DiscoverKey
  selectedName: string | null
  onSelect: (name: string) => void
  activityByName: Record<string, Activity>
  onInstallFromUrl: (repo: string) => void
  expanded: boolean
}) {
  const entries = listing?.entries ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (q) {
        const hay = `${e.name} ${e.title ?? ""} ${e.description}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (discover === "installed" && !e.installed) return false
      if (discover === "local" && !e.local) return false
      if (discover === "updates") return false
      return true
    })
  }, [entries, search, discover])

  return (
    <div
      className={`${expanded ? "flex-1 min-w-0" : "shrink-0"} flex flex-col min-h-0`}
      style={
        expanded
          ? { background: "var(--zenbu-panel)" }
          : { width: 360, background: "var(--zenbu-panel)" }
      }
    >
      <div className="shrink-0 px-5 pt-4 pb-3 flex items-center gap-3">
        <div className="relative flex-1">
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search plugins"
            className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-ring"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="shrink-0 px-5 pb-2 text-[12px] text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "plugin" : "plugins"}
      </div>

      {loadError && (
        <div className="px-5 pb-2 text-[12px] text-red-600">{loadError}</div>
      )}
      {listing?.warning && (
        <div className="px-5 pb-2 text-[12px] text-amber-700">
          {listing.warning}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto px-3 pb-3">
        {filtered.map((e) => (
          <PluginCard
            key={e.name}
            entry={e}
            active={selectedName === e.name}
            activity={activityByName[e.name]}
            onClick={() => onSelect(e.name)}
          />
        ))}
        {filtered.length === 0 && !loadError && (
          <div className="px-3 py-10 text-center text-[13px] text-muted-foreground">
            No plugins match your filters.
          </div>
        )}
      </div>

      <InstallFromUrlRow onSubmit={onInstallFromUrl} />
    </div>
  )
}

function PluginCard({
  entry,
  active,
  activity,
  onClick,
}: {
  entry: PluginEntry
  active: boolean
  activity?: Activity
  onClick: () => void
}) {
  const busy = activity && !activity.done
  const status: "installed" | "available" | "local" = entry.local
    ? "local"
    : entry.installed
      ? "installed"
      : "available"
  const author = deriveAuthor(entry.repo)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pv-row w-full text-left rounded-lg px-3 py-3 flex items-start gap-3 mb-1.5 ${
        active ? "is-active" : ""
      }`}
      style={{
        border: active
          ? "1px solid var(--zenbu-panel-border)"
          : "1px solid transparent",
      }}
    >
      {entry.screenshot && <Thumbnail src={entry.screenshot} />}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] font-medium text-foreground">
            {entry.title ?? entry.name}
          </span>
          {author && (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              by {author}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[12px] text-muted-foreground line-clamp-2">
          {entry.description}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2 pl-2">
        {busy && <Spinner />}
        <StatusLabel status={status} />
      </div>
    </button>
  )
}

function Thumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div
      aria-hidden
      className="shrink-0 overflow-hidden rounded-md"
      style={{
        width: 72,
        height: 72,
        background: "var(--card)",
        border: "1px solid var(--zenbu-panel-border)",
      }}
    >
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  )
}

function StatusLabel({
  status,
}: {
  status: "installed" | "available" | "local"
}) {
  const text =
    status === "installed"
      ? "Installed"
      : status === "local"
        ? "Local"
        : "Available"
  return (
    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
      {text}
    </span>
  )
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{
        position: "absolute",
        left: 8,
        top: "50%",
        transform: "translateY(-50%)",
        color: "#9CA3AF",
      }}
    >
      <circle
        cx="11"
        cy="11"
        r="7"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m20 20-3-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "agent-sidebar-spin 0.9s linear infinite" }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function InstallFromUrlRow({ onSubmit }: { onSubmit: (repo: string) => void }) {
  const [value, setValue] = useState("")
  const submit = () => {
    const v = value.trim()
    if (!v) return
    onSubmit(v)
    setValue("")
  }
  // Flush with the rest of the list: same surface color, no top border,
  // no white input box. Feels like another row instead of a docked
  // toolbar.
  return (
    <div className="shrink-0 px-5 py-2.5 flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit()
        }}
        placeholder="Install from GitHub URL…"
        className="flex-1 h-8 rounded-md bg-transparent px-2 text-[12px] text-neutral-800 placeholder:text-neutral-400 outline-none"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim()}
        className="pv-button h-8 px-3 rounded-md text-[12px] text-neutral-600 disabled:opacity-40"
      >
        Install
      </button>
    </div>
  )
}

function deriveAuthor(repo: string): string | null {
  const m = repo.match(/github\.com[/:]([^/]+)\//i)
  return m?.[1] ?? null
}

