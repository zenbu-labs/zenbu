import { app } from "electron"
import electronUpdater from "electron-updater"

const { autoUpdater } = electronUpdater

const CHECK_INTERVAL_MS = 30 * 60_000
let initialized = false

export function initUpdater(): void {
  if (initialized) return
  if (!app.isPackaged) return
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on("checking-for-update", () => console.log("[updater] checking"))
  autoUpdater.on("update-available", (info) => console.log("[updater] available:", info.version))
  autoUpdater.on("update-not-available", () => console.log("[updater] up to date"))
  autoUpdater.on("download-progress", (p) =>
    console.log(`[updater] ${p.percent.toFixed(1)}% kkk(${(p.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s)`),
  )
  autoUpdater.on("update-downloaded", (info) =>
    console.log("[updater] downloaded:", info.version, "— will install on next quit"),
  )
  autoUpdater.on("error", (err) => {
    if (err?.message?.includes("No published versions on GitHub")) {
      console.log("[updater] no published releases yet")
      return
    }
    console.error("[updater] error:", err)
  })

  // checkForUpdates() both rejects AND emits "error" — swallow the rejection here
  // so the error listener is the single log site (and to avoid an unhandled rejection).
  const check = () => autoUpdater.checkForUpdates().catch(() => {})
  setTimeout(check, 5_000)
  setInterval(check, CHECK_INTERVAL_MS)
}
