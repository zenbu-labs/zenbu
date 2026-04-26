import { useCallback, useEffect, useMemo, useState } from "react"
import {
  RpcProvider,
  EventsProvider,
  KyjuClientProvider,
  useWsConnection,
  useRpc,
} from "@/lib/ws-connection"
import {
  KyjuProvider,
} from "@/lib/kyju-react"
import type { WsConnectionState } from "@/lib/ws-connection"
import { useDragRegion } from "@/lib/drag-region"
import { RegistryTabs } from "./RegistrySidebar"
import { PluginList } from "./PluginList"
import { RegistryDetail } from "./RegistryDetail"
import { PluginUpdateModal, type PendingUpdate } from "./PluginUpdateModal"

/**
 * Canonical entry shape the screen operates on, projected out of
 * `rpc.registry.getRegistry()`. Kept loose on purpose — the RPC type
 * isn't imported here to avoid the kernel→plugin type coupling pain.
 */
export type PluginEntry = {
  name: string
  title?: string
  description: string
  repo: string
  installed: boolean
  enabled: boolean
  local: boolean
  manifestPath: string | null
  installPath: string
  /**
   * Absolute URL (http://localhost:<wsPort>/plugin-screenshot/<name>/<path>
   * for installed plugins, or a raw GitHub URL for registry-listed remote
   * plugins). Undefined when the plugin doesn't ship one — the card falls
   * back to an initial-letter gradient tile.
   */
  screenshot?: string
}

export type RepoInfo = {
  stars: number
  forks: number
  defaultBranch: string
  updatedAt: string
  htmlUrl: string
  description: string
  ownerLogin: string
}

export type ReadmeState = { content: string } | { error: string }

export type Activity = {
  kind: "install" | "update" | "uninstall"
  startedAt: number
  log: string[]
  error?: string
  done?: boolean
}

export type DiscoverKey = "all" | "installed" | "updates" | "local"

function PluginsScreen() {
  const rpc = useRpc()

  const [listing, setListing] = useState<{
    source: "remote" | "local"
    entries: PluginEntry[]
    warning?: string
  } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [discover, setDiscover] = useState<DiscoverKey>("all")
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const [repoInfoByName, setRepoInfoByName] = useState<
    Record<string, RepoInfo>
  >({})
  const [readmeByName, setReadmeByName] = useState<
    Record<string, ReadmeState>
  >({})
  const [activityByName, setActivityByName] = useState<
    Record<string, Activity>
  >({})
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(
    null,
  )

  const refetch = useCallback(async () => {
    try {
      const r = await rpc.registry.getRegistry()
      if (r.ok) {
        setListing(r.listing)
        setLoadError(null)
      } else {
        setLoadError(r.error)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }, [rpc])

  useEffect(() => {
    refetch()
  }, [refetch])


  const entryByName = useMemo(() => {
    const m = new Map<string, PluginEntry>()
    for (const e of listing?.entries ?? []) m.set(e.name, e)
    return m
  }, [listing])

  const selected = selectedName ? entryByName.get(selectedName) ?? null : null

  // Lazy fetch repo info + README for the selected entry (once per session).
  useEffect(() => {
    if (!selected?.repo) return
    if (repoInfoByName[selected.name]) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await rpc.registry.getRepoInfo({ repo: selected.repo })
        if (cancelled) return
        if (r.ok) {
          setRepoInfoByName((prev) => ({ ...prev, [selected.name]: r.info }))
        }
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [rpc, selected?.name, selected?.repo, repoInfoByName])

  useEffect(() => {
    if (!selected?.repo) return
    if (readmeByName[selected.name]) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await rpc.registry.getRepoReadme({ repo: selected.repo })
        if (cancelled) return
        setReadmeByName((prev) => ({
          ...prev,
          [selected.name]: r.ok
            ? { content: r.content }
            : { error: r.error },
        }))
      } catch (err) {
        if (cancelled) return
        setReadmeByName((prev) => ({
          ...prev,
          [selected.name]: {
            error: err instanceof Error ? err.message : String(err),
          },
        }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [rpc, selected?.name, selected?.repo, readmeByName])

  // ─── actions ────────────────────────────────────────────────────────

  const beginActivity = (name: string, kind: Activity["kind"]) => {
    setActivityByName((prev) => ({
      ...prev,
      [name]: { kind, startedAt: Date.now(), log: [], done: false },
    }))
  }
  const appendLog = (name: string, lines: string[]) => {
    setActivityByName((prev) => {
      const cur = prev[name]
      if (!cur) return prev
      return {
        ...prev,
        [name]: { ...cur, log: [...cur.log, ...lines].slice(-500) },
      }
    })
  }
  const endActivity = (name: string, err?: string) => {
    setActivityByName((prev) => {
      const cur = prev[name]
      if (!cur) return prev
      return { ...prev, [name]: { ...cur, done: true, error: err } }
    })
  }

  const install = useCallback(
    async (entry: PluginEntry) => {
      beginActivity(entry.name, "install")
      try {
        const r = await rpc.registry.installFromRegistry({
          name: entry.name,
          title: entry.title,
          description: entry.description,
          repo: entry.repo,
        })
        appendLog(entry.name, r.log ?? [])
        if (!r.ok) endActivity(entry.name, r.error)
        else endActivity(entry.name)
      } catch (err) {
        endActivity(entry.name, err instanceof Error ? err.message : String(err))
      }
      await refetch()
    },
    [rpc, refetch],
  )

  const toggle = useCallback(
    async (entry: PluginEntry, enabled: boolean) => {
      if (!entry.manifestPath) return
      try {
        await rpc.installer.togglePlugin(entry.manifestPath, enabled)
      } catch (err) {
        console.error("[plugins] togglePlugin failed:", err)
      }
      await refetch()
    },
    [rpc, refetch],
  )

  const pullUpdates = useCallback(
    async (entry: PluginEntry) => {
      beginActivity(entry.name, "update")
      try {
        const r = await rpc.gitUpdates.pullAndInstall({ plugin: entry.name })
        if (r.log) appendLog(entry.name, r.log)
        if (r.ok) {
          endActivity(entry.name)
          if (r.pending) {
            setPendingUpdate({ plugin: r.plugin ?? entry.name, version: r.version })
          }
        } else {
          endActivity(entry.name, r.error ?? "pullAndInstall failed")
        }
      } catch (err) {
        endActivity(entry.name, err instanceof Error ? err.message : String(err))
      }
      await refetch()
    },
    [rpc, refetch],
  )

  const uninstall = useCallback(
    async (entry: PluginEntry, deleteFiles: boolean) => {
      beginActivity(entry.name, "uninstall")
      try {
        const r = await rpc.registry.uninstallPlugin({
          name: entry.name,
          deleteFiles,
        })
        if (!r.ok) endActivity(entry.name, r.error)
        else endActivity(entry.name)
      } catch (err) {
        endActivity(entry.name, err instanceof Error ? err.message : String(err))
      }
      await refetch()
    },
    [rpc, refetch],
  )

  const installFromUrl = useCallback(
    async (repo: string) => {
      const name = deriveNameFromRepoUrl(repo)
      if (!name) {
        setLoadError(`Could not parse a plugin name from ${repo}`)
        return
      }
      beginActivity(name, "install")
      try {
        const r = await rpc.registry.installFromRegistry({
          name,
          description: "",
          repo,
        })
        appendLog(name, r.log ?? [])
        if (!r.ok) endActivity(name, r.error)
        else {
          endActivity(name)
          setSelectedName(name)
        }
      } catch (err) {
        endActivity(name, err instanceof Error ? err.message : String(err))
      }
      await refetch()
    },
    [rpc, refetch],
  )

  const counts = useMemo<Record<DiscoverKey, number>>(() => {
    const entries = listing?.entries ?? []
    return {
      all: entries.length,
      installed: entries.filter((e) => e.installed).length,
      updates: 0,
      local: entries.filter((e) => e.local).length,
    }
  }, [listing])

  return (
    <div className="flex h-full w-full flex-col">
      <TitleBar />
      <RegistryTabs
        counts={counts}
        discover={discover}
        onDiscover={setDiscover}
      />
      <div className="flex-1 min-h-0 flex">
        <PluginList
          listing={listing}
          loadError={loadError}
          search={search}
          onSearch={setSearch}
          discover={discover}
          selectedName={selectedName}
          onSelect={setSelectedName}
          activityByName={activityByName}
          onInstallFromUrl={installFromUrl}
          expanded={!selected}
        />
        {selected && (
          <div className="flex-1 min-w-0 min-h-0 p-2">
            <div
              className="relative h-full w-full overflow-hidden"
              style={{
                background: "var(--card)",
                borderRadius: 10,
                border: "1px solid var(--zenbu-panel-border)",
              }}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedName(null)}
                className="pv-icon absolute top-2 right-2 z-10 flex items-center justify-center rounded-md"
                style={{ width: 24, height: 24, color: "#525252" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <RegistryDetail
                entry={selected}
                repoInfo={repoInfoByName[selected.name]}
                readme={readmeByName[selected.name]}
                activity={activityByName[selected.name]}
                onInstall={install}
                onToggle={toggle}
                onPullUpdates={pullUpdates}
                onUninstall={uninstall}
              />
            </div>
          </div>
        )}
      </div>
      <PluginUpdateModal
        pending={pendingUpdate}
        onResolved={() => setPendingUpdate(null)}
      />
    </div>
  )
}

function TitleBar() {
  // Invisible drag strip — keeps the chat-title-bar drag UX without a label.
  const dragRef = useDragRegion<HTMLDivElement>()
  return <div ref={dragRef} className="shrink-0" style={{ height: 18 }} />
}

function deriveNameFromRepoUrl(url: string): string | null {
  // e.g. https://github.com/owner/plugin-name(.git)?
  const m = url.match(/([^/:]+?)(?:\.git)?\/?$/)
  if (!m) return null
  return m[1] ?? null
}

function ConnectedApp({
  connection,
}: {
  connection: Extract<WsConnectionState, { status: "connected" }>
}) {
  return (
    <RpcProvider value={connection.rpc}>
      <EventsProvider value={connection.events}>
        <KyjuClientProvider value={connection.kyjuClient}>
          <KyjuProvider
            client={connection.kyjuClient}
            replica={connection.replica}
          >
            <PluginsScreen />
          </KyjuProvider>
        </KyjuClientProvider>
      </EventsProvider>
    </RpcProvider>
  )
}

export function App() {
  const connection = useWsConnection()
  if (connection.status === "connecting") return <div className="h-full" />
  if (connection.status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-red-500 text-xs">
        {connection.error}
      </div>
    )
  }
  return <ConnectedApp connection={connection} />
}
