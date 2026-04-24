import { app } from "electron"
import electronUpdater from "electron-updater"
import { kernelUpdaterBus } from "../../../../packages/init/shared/kernel-updater-bus"

const { autoUpdater } = electronUpdater

let initialized = false

/**
 * Bridge electron-updater → kernelUpdaterBus.
 *
 * Design:
 *  - `autoDownload` / `autoInstallOnAppQuit` are OFF. The init-script
 *    service calls `updater.cmd.download` / `updater.cmd.install` in
 *    response to user clicks.
 *  - Autoupdater events are forwarded onto the bus; console.log sinks
 *    stay alongside so log tailing still works.
 *  - A startup check fires 5s after init. Beyond that, checks are
 *    user-initiated via the bus.
 *  - Race safety: the init-script service also calls `cmd.check` from
 *    its `evaluate()`, which re-drives the event sequence after the
 *    bus subscription is live. So nothing is lost if the service
 *    loads after the initial 5s check.
 *  - Dev: when `ZENBU_FAKE_UPDATER=1`, wire a stub that responds to
 *    command events with a canned check → available → downloading →
 *    downloaded sequence, so the renderer UI is exercisable locally.
 */
export function initUpdater(): void {
  if (initialized) return
  initialized = true

  const fake = !app.isPackaged && process.env.ZENBU_FAKE_UPDATER === "1"
  // `ZENBU_UPDATE_FEED_URL` points the real updater at a local HTTP server
  // (see `packages/dev-update-server`). When set, the real code path
  // initializes even in dev mode — lets us end-to-end test the upgrade flow
  // without code-signing or publishing to GitHub.
  const localFeedUrl = process.env.ZENBU_UPDATE_FEED_URL

  if (!app.isPackaged && !fake && !localFeedUrl) {
    // Unpackaged, no fake, no local feed: silently no-op. Service still
    // loads; DB stays at status="idle"; banner hides.
    return
  }

  if (fake) {
    initFakeUpdater()
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  if (localFeedUrl) {
    autoUpdater.setFeedURL({ provider: "generic", url: localFeedUrl })
    // Local builds typically have the same (or lower) version than the
    // running dev app. Let electron-updater install either direction so we
    // can repeatedly test upgrades.
    autoUpdater.allowDowngrade = true
    autoUpdater.disableDifferentialDownload = true
    // In dev the running app is unsigned, so the new bundle will be too.
    // electron-updater's macOS path validates that signatures match — both
    // unsigned is a match (no-op validation). Nothing more needed here.
    console.log(`[updater] using local feed URL: ${localFeedUrl}`)
  }

  autoUpdater.on("checking-for-update", () => {
    console.log("[updater] checking")
    kernelUpdaterBus.emit("updater.checking", { ts: Date.now() })
  })

  autoUpdater.on("update-available", (info) => {
    console.log("[updater] available:", info.version)
    kernelUpdaterBus.emit("updater.available", {
      version: info.version,
      releaseDate: info.releaseDate ?? null,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      ts: Date.now(),
    })
  })

  autoUpdater.on("update-not-available", (info) => {
    console.log("[updater] up to date")
    kernelUpdaterBus.emit("updater.not-available", {
      currentVersion: info?.version ?? app.getVersion(),
      ts: Date.now(),
    })
  })

  autoUpdater.on("download-progress", (p) => {
    console.log(
      `[updater] ${p.percent.toFixed(1)}% (${(p.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s)`,
    )
    kernelUpdaterBus.emit("updater.download-progress", {
      percent: p.percent,
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total,
      ts: Date.now(),
    })
  })

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[updater] downloaded:", info.version)
    kernelUpdaterBus.emit("updater.downloaded", {
      version: info.version,
      ts: Date.now(),
    })
  })

  autoUpdater.on("error", (err) => {
    // A fresh repo with no published releases is not a real error.
    if (err?.message?.includes("No published versions on GitHub")) {
      console.log("[updater] no published releases yet")
      kernelUpdaterBus.emit("updater.not-available", {
        currentVersion: app.getVersion(),
        ts: Date.now(),
      })
      return
    }
    console.error("[updater] error:", err)
    kernelUpdaterBus.emit("updater.error", {
      message: err?.message ?? String(err),
      code: (err as any)?.code ?? null,
      ts: Date.now(),
    })
  })

  kernelUpdaterBus.on("updater.cmd.check", async ({ requestId }) => {
    try {
      await autoUpdater.checkForUpdates()
      ack(requestId, true)
    } catch (err) {
      ack(requestId, false, errorMessage(err))
    }
  })

  kernelUpdaterBus.on("updater.cmd.download", async ({ requestId }) => {
    try {
      await autoUpdater.downloadUpdate()
      ack(requestId, true)
    } catch (err) {
      ack(requestId, false, errorMessage(err))
    }
  })

  kernelUpdaterBus.on("updater.cmd.install", ({ requestId }) => {
    // quitAndInstall is synchronous-ish: it schedules the install and
    // tears the app down. Ack immediately so the caller sees a response
    // before the transport dies.
    try {
      ack(requestId, true)
      autoUpdater.quitAndInstall()
    } catch (err) {
      ack(requestId, false, errorMessage(err))
    }
  })

  // Startup check. The init-script service also triggers a check from
  // its evaluate(), which handles the race where the service loads
  // after this timer fires.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5_000)
}

function ack(requestId: string, ok: boolean, error?: string): void {
  kernelUpdaterBus.emit("updater.cmd.ack", error ? { requestId, ok, error } : { requestId, ok })
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function normalizeReleaseNotes(
  notes: string | Array<{ version: string; note: string | null }> | null | undefined,
): string | null {
  if (!notes) return null
  if (typeof notes === "string") return notes
  return notes
    .map((n) => `${n.version}\n${n.note ?? ""}`)
    .join("\n\n")
    .trim() || null
}

/**
 * Dev-only stub. Responds to bus commands by emitting the canonical
 * sequence so the renderer UI is fully testable without shipping a
 * release. Doesn't touch electron-updater at all.
 */
function initFakeUpdater(): void {
  console.log("[updater] fake mode (ZENBU_FAKE_UPDATER=1)")

  const version = "0.0.0-dev"
  let availableEmitted = false
  let downloadTimer: NodeJS.Timeout | null = null
  let downloaded = false

  const clearDownload = () => {
    if (downloadTimer) {
      clearInterval(downloadTimer)
      downloadTimer = null
    }
  }

  kernelUpdaterBus.on("updater.cmd.check", ({ requestId }) => {
    kernelUpdaterBus.emit("updater.checking", { ts: Date.now() })
    setTimeout(() => {
      kernelUpdaterBus.emit("updater.available", {
        version,
        releaseDate: new Date().toISOString(),
        releaseNotes: "Dev stub release notes.",
        ts: Date.now(),
      })
      availableEmitted = true
      ack(requestId, true)
    }, 500)
  })

  kernelUpdaterBus.on("updater.cmd.download", ({ requestId }) => {
    if (!availableEmitted) {
      ack(requestId, false, "No update to download (fake mode)")
      return
    }
    clearDownload()
    let pct = 0
    const total = 10 * 1024 * 1024
    const perTick = total / 20
    downloadTimer = setInterval(() => {
      pct += 5
      if (pct >= 100) {
        clearDownload()
        kernelUpdaterBus.emit("updater.download-progress", {
          percent: 100,
          bytesPerSecond: perTick * 5,
          transferred: total,
          total,
          ts: Date.now(),
        })
        kernelUpdaterBus.emit("updater.downloaded", { version, ts: Date.now() })
        downloaded = true
        return
      }
      kernelUpdaterBus.emit("updater.download-progress", {
        percent: pct,
        bytesPerSecond: perTick * 5,
        transferred: (pct / 100) * total,
        total,
        ts: Date.now(),
      })
    }, 200)
    ack(requestId, true)
  })

  kernelUpdaterBus.on("updater.cmd.install", ({ requestId }) => {
    if (!downloaded) {
      ack(requestId, false, "Nothing to install (fake mode)")
      return
    }
    ack(requestId, false, "Dev mode: not installing")
    kernelUpdaterBus.emit("updater.error", {
      message: "Dev mode: not installing",
      code: "FAKE_MODE",
      ts: Date.now(),
    })
  })
}
