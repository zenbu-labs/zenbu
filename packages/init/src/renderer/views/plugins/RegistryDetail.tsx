import { useMemo, useState } from "react"
import { Streamdown } from "streamdown"
import { streamdownProps } from "@/views/chat/lib/streamdown-config"
import { useRpc } from "@/lib/providers"
import type { Activity, PluginEntry, ReadmeState, RepoInfo } from "./App"

/**
 * Right column. Uses `PluginEntry` + lazy `RepoInfo` + lazy `ReadmeState`
 * as display inputs; actions bubble up to the parent's state machine.
 *
 * The primary action is context-dependent (one button). Secondary
 * actions live in the overflow menu. Activity log sits at the bottom
 * and survives navigation away + back (state lives in the parent).
 */
export function RegistryDetail({
  entry,
  repoInfo,
  readme,
  activity,
  onInstall,
  onToggle,
  onPullUpdates,
  onUninstall,
}: {
  entry: PluginEntry
  repoInfo?: RepoInfo
  readme?: ReadmeState
  activity?: Activity
  onInstall: (e: PluginEntry) => void
  onToggle: (e: PluginEntry, enabled: boolean) => void
  onPullUpdates: (e: PluginEntry) => void
  onUninstall: (e: PluginEntry, deleteFiles: boolean) => void
}) {
  const rpc = useRpc()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showUninstall, setShowUninstall] = useState(false)

  const primary = useMemo(
    () => derivePrimaryAction(entry, activity),
    [entry, activity],
  )

  const rewrittenReadme = useMemo(() => {
    if (!readme || "error" in readme) return ""
    return rewriteReadmeMedia(readme.content, repoInfo?.htmlUrl ?? entry.repo)
  }, [readme, repoInfo?.htmlUrl, entry.repo])

  const busy = activity && !activity.done

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <Header
        entry={entry}
        repoInfo={repoInfo}
        primary={primary}
        busy={!!busy}
        onPrimary={() => runPrimary(primary.kind, entry, { onInstall, onToggle, onPullUpdates })}
        onToggleMenu={() => setMenuOpen((v) => !v)}
        menuOpen={menuOpen}
        menu={
          <DetailMenu
            entry={entry}
            onClose={() => setMenuOpen(false)}
            onRevealInFinder={async () => {
              setMenuOpen(false)
              try {
                const dir = await rpc.registry.getInstalledPluginDir?.(entry.name)
                if (dir) await rpc.window.openInFinder(dir)
              } catch {}
            }}
            onOpenRepo={async () => {
              setMenuOpen(false)
              if (entry.repo) await rpc.window.openExternal?.(entry.repo)
            }}
            onToggle={() => {
              setMenuOpen(false)
              onToggle(entry, !entry.enabled)
            }}
            onUninstall={() => {
              setMenuOpen(false)
              setShowUninstall(true)
            }}
          />
        }
      />

      <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
        {entry.description && (
          <p className="text-[13px] text-neutral-700 mt-2 mb-4">
            {entry.description}
          </p>
        )}
        <ReadmePane readme={readme} rewritten={rewrittenReadme} />
      </div>

      <ActivityDrawer activity={activity} />

      {showUninstall && (
        <UninstallDialog
          entry={entry}
          onCancel={() => setShowUninstall(false)}
          onConfirm={(deleteFiles) => {
            setShowUninstall(false)
            onUninstall(entry, deleteFiles)
          }}
        />
      )}
    </div>
  )
}

// ── header ─────────────────────────────────────────────────────────

function Header({
  entry,
  repoInfo,
  primary,
  busy,
  onPrimary,
  onToggleMenu,
  menuOpen,
  menu,
}: {
  entry: PluginEntry
  repoInfo?: RepoInfo
  primary: { kind: PrimaryKind; label: string }
  busy: boolean
  onPrimary: () => void
  onToggleMenu: () => void
  menuOpen: boolean
  menu: React.ReactNode
}) {
  const owner =
    repoInfo?.ownerLogin ??
    entry.repo.match(/github\.com\/([^/]+)\/[^/]+/)?.[1]
  return (
    <div className="px-6 pt-6 pb-3 shrink-0 flex items-start gap-4 border-b border-black/5">
      <Avatar name={entry.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-medium text-neutral-900 truncate">
            {entry.title ?? entry.name}
          </span>
          <span className="text-[12px] text-neutral-500 truncate">
            {entry.name}
          </span>
          {entry.local && <Badge tone="amber">Local</Badge>}
          {entry.installed && entry.enabled && !entry.local && (
            <Badge tone="green">Enabled</Badge>
          )}
          {entry.installed && !entry.enabled && !entry.local && (
            <Badge tone="neutral">Disabled</Badge>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-neutral-500">
          {owner && <span>{owner}</span>}
          {repoInfo && <span>· ★ {repoInfo.stars}</span>}
          {repoInfo?.updatedAt && (
            <span>· updated {formatRelative(repoInfo.updatedAt)}</span>
          )}
        </div>
      </div>
      <div className="relative flex items-center gap-1">
        <PrimaryButton
          disabled={busy}
          onClick={onPrimary}
          kind={primary.kind}
        >
          {busy ? "…" : primary.label}
        </PrimaryButton>
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label="More"
          className="pv-icon h-7 w-7 rounded flex items-center justify-center text-neutral-600"
        >
          ⋯
        </button>
        {menuOpen && menu}
      </div>
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  const letter = (name[0] ?? "?").toUpperCase()
  return (
    <div
      className="shrink-0 flex items-center justify-center text-[14px] font-medium text-neutral-700"
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: "var(--zenbu-chrome)",
      }}
    >
      {letter}
    </div>
  )
}

function Badge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "neutral"
  children: React.ReactNode
}) {
  const bg =
    tone === "green"
      ? "rgba(34, 197, 94, 0.14)"
      : tone === "amber"
        ? "rgba(245, 158, 11, 0.16)"
        : "rgba(0, 0, 0, 0.06)"
  const fg =
    tone === "green" ? "#166534" : tone === "amber" ? "#92400e" : "#404040"
  return (
    <span
      className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  )
}

// ── primary action ─────────────────────────────────────────────────

type PrimaryKind = "install" | "enable" | "disable" | "pull" | "disabled"

function derivePrimaryAction(
  entry: PluginEntry,
  activity: Activity | undefined,
): { kind: PrimaryKind; label: string } {
  if (activity && !activity.done) {
    if (activity.kind === "install") return { kind: "disabled", label: "Installing…" }
    if (activity.kind === "update") return { kind: "disabled", label: "Updating…" }
    if (activity.kind === "uninstall") return { kind: "disabled", label: "Removing…" }
  }
  if (!entry.installed) return { kind: "install", label: "Install" }
  if (!entry.enabled) return { kind: "enable", label: "Enable" }
  if (entry.local) return { kind: "disable", label: "Disable" }
  return { kind: "pull", label: "Pull updates" }
}

function runPrimary(
  kind: PrimaryKind,
  entry: PluginEntry,
  handlers: {
    onInstall: (e: PluginEntry) => void
    onToggle: (e: PluginEntry, enabled: boolean) => void
    onPullUpdates: (e: PluginEntry) => void
  },
) {
  if (kind === "install") handlers.onInstall(entry)
  else if (kind === "enable") handlers.onToggle(entry, true)
  else if (kind === "disable") handlers.onToggle(entry, false)
  else if (kind === "pull") handlers.onPullUpdates(entry)
}

function PrimaryButton({
  kind,
  disabled,
  onClick,
  children,
}: {
  kind: PrimaryKind
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const filled = kind === "install" || kind === "enable"
  const classes = filled
    ? "bg-blue-500 text-white hover:bg-blue-600"
    : "border border-black/10 text-neutral-800 hover:bg-black/[0.05]"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || kind === "disabled"}
      className={`h-7 px-3 rounded text-[12px] transition-colors disabled:opacity-50 ${classes}`}
    >
      {children}
    </button>
  )
}

// ── overflow menu ──────────────────────────────────────────────────

function DetailMenu({
  entry,
  onClose,
  onRevealInFinder,
  onOpenRepo,
  onToggle,
  onUninstall,
}: {
  entry: PluginEntry
  onClose: () => void
  onRevealInFinder: () => void
  onOpenRepo: () => void
  onToggle: () => void
  onUninstall: () => void
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden
        style={{ background: "transparent" }}
      />
      <div
        className="absolute right-0 top-[32px] z-50 min-w-[200px] rounded-md border border-black/10 bg-white py-1 text-[12px] shadow-md"
      >
        {entry.repo && (
          <MenuItem onClick={onOpenRepo}>Open on GitHub</MenuItem>
        )}
        {entry.installed && (
          <MenuItem onClick={onRevealInFinder}>Reveal in Finder</MenuItem>
        )}
        {entry.installed && (
          <MenuItem onClick={onToggle}>
            {entry.enabled ? "Disable" : "Enable"}
          </MenuItem>
        )}
        {entry.installed && (
          <MenuItem danger onClick={onUninstall}>
            Uninstall…
          </MenuItem>
        )}
      </div>
    </>
  )
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left hover:bg-black/5 ${
        danger ? "text-red-600" : "text-neutral-800"
      }`}
    >
      {children}
    </button>
  )
}

// ── uninstall confirm ──────────────────────────────────────────────

function UninstallDialog({
  entry,
  onCancel,
  onConfirm,
}: {
  entry: PluginEntry
  onCancel: () => void
  onConfirm: (deleteFiles: boolean) => void
}) {
  const [deleteFiles, setDeleteFiles] = useState(!entry.local)
  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.25)" }}
      onClick={onCancel}
    >
      <div
        className="w-[420px] max-w-[90vw] rounded-lg bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[14px] font-medium mb-2">
          Uninstall {entry.title ?? entry.name}?
        </div>
        <div className="text-[12px] text-neutral-600 mb-3">
          Removes this plugin from your config so it won't load on next
          launch.
          {entry.local &&
            " This looks like a local plugin you're developing — deleting the files is off by default."}
        </div>
        <label className="flex items-center gap-2 text-[12px] mb-4">
          <input
            type="checkbox"
            checked={deleteFiles}
            onChange={(e) => setDeleteFiles(e.target.checked)}
          />
          Also delete files at{" "}
          <code className="text-[11px] text-neutral-600">
            {entry.installPath}
          </code>
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-7 px-3 rounded border border-black/10 text-[12px] hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(deleteFiles)}
            className="h-7 px-3 rounded bg-red-500 text-white text-[12px] hover:bg-red-600"
          >
            Uninstall
          </button>
        </div>
      </div>
    </div>
  )
}

// ── readme ─────────────────────────────────────────────────────────

function ReadmePane({
  readme,
  rewritten,
}: {
  readme?: ReadmeState
  rewritten: string
}) {
  if (!readme) {
    return <div className="text-[12px] text-neutral-400">Loading README…</div>
  }
  if ("error" in readme) {
    return <div className="text-[12px] text-neutral-500">{readme.error}</div>
  }
  return (
    <div className="text-[13px] prose prose-sm max-w-none">
      <Streamdown {...(streamdownProps as any)}>{rewritten}</Streamdown>
    </div>
  )
}

function rewriteReadmeMedia(markdown: string, repoHtmlUrl: string): string {
  const match = repoHtmlUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return markdown
  const [, owner, repo] = match
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/`
  return markdown.replace(
    /!\[([^\]]*)\]\((?!https?:|data:|\/\/)([^)\s]+)\)/g,
    (_full, alt: string, src: string) => {
      const cleaned = src.replace(/^\.?\//, "")
      return `![${alt}](${rawBase}${cleaned})`
    },
  )
}

// ── activity drawer ────────────────────────────────────────────────

function ActivityDrawer({ activity }: { activity?: Activity }) {
  const [open, setOpen] = useState(false)
  if (!activity) return null
  const title =
    activity.kind === "install"
      ? "Install log"
      : activity.kind === "update"
        ? "Update log"
        : "Uninstall log"
  const status = activity.done
    ? activity.error
      ? "Failed"
      : "Done"
    : "Running…"
  return (
    <div className="shrink-0 border-t border-black/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-1.5 text-[11px] text-neutral-600 hover:bg-black/3"
      >
        <span>
          {open ? "▾" : "▸"} {title} — {status}
        </span>
        <span className="text-neutral-400">
          {activity.log.length} line{activity.log.length === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <pre className="max-h-40 overflow-auto px-6 pb-2 text-[11px] font-mono text-neutral-700 whitespace-pre-wrap wrap-break-word">
          {activity.log.join("\n")}
          {activity.error && `\n\nError: ${activity.error}`}
        </pre>
      )}
    </div>
  )
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso)
  if (!t) return iso
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}
