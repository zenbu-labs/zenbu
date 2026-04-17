import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { register as registerLoader } from "node:module"
import { app, BaseWindow, BrowserWindow, dialog, ipcMain } from "electron"
import { readConfig, addPlugin, CONFIG_PATH } from "./config"
import { initUpdater } from "./updater"
import { bootstrapEnv } from "./env-bootstrap"
import { detectPreflight, triggerXcodeCliInstall } from "./preflight"

const PLUGINS_DIR = path.join(os.homedir(), ".zenbu", "plugins")
const KERNEL_MANIFEST = "packages/init/zenbu.plugin.json"

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

function findProjectRoot(manifestPath: string): string {
  let dir = path.dirname(path.resolve(manifestPath))
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir
    dir = path.dirname(dir)
  }
  return path.dirname(path.resolve(manifestPath))
}

function findTsconfig(manifestPath: string): string | false {
  let dir = path.dirname(manifestPath)
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, "tsconfig.json")
    if (fs.existsSync(candidate)) return candidate
    dir = path.dirname(dir)
  }
  return false
}

function needsBootstrapper(): boolean {
  const pluginDir = path.join(PLUGINS_DIR, "zenbu")
  if (!fs.existsSync(pluginDir)) return true
  if (!fs.existsSync(path.join(pluginDir, "node_modules"))) return true
  return false
}

app.whenReady().then(async () => {
  try {
    console.log("[shell] app ready")

    const bootstrap = bootstrapEnv()
    console.log("[shell] env bootstrapped", {
      cacheRoot: bootstrap.paths.cacheRoot,
      needsToolchainDownload: bootstrap.needsToolchainDownload,
    })

    const preflight = detectPreflight()
    console.log("[shell] preflight:", preflight)

    const setupWindowOpts = {
      width: 640,
      height: 460,
      titleBarStyle: "hidden" as const,
      trafficLightPosition: { x: 12, y: 12 },
      webPreferences: { nodeIntegration: true, contextIsolation: false },
    }

    if (preflight.runningFromDmg) {
      console.log("[shell] running from DMG, showing move-to-applications screen")
      const win = new BrowserWindow(setupWindowOpts)
      win.loadFile(path.join(app.getAppPath(), "src/setup/preflight-dmg.html"))
      return
    }

    if (!preflight.xcodeCliInstalled) {
      console.log("[shell] xcode CLI tools missing, showing install screen")
      const win = new BrowserWindow(setupWindowOpts)
      win.loadFile(path.join(app.getAppPath(), "src/setup/preflight-xcode.html"))
      ipcMain.once("zenbu:trigger-xcode-install", () => triggerXcodeCliInstall())
      ipcMain.handle("zenbu:poll-xcode", () => {
        const p = detectPreflight()
        return { installed: p.xcodeCliInstalled, developerDir: p.xcodeDeveloperDir }
      })
      ipcMain.once("zenbu:xcode-ready-relaunch", () => { app.relaunch(); app.exit() })
      return
    }

    if (needsBootstrapper() || bootstrap.needsToolchainDownload) {
      console.log("[shell] needs setup, showing bootstrapper")
      const win = new BrowserWindow(setupWindowOpts)
      win.loadFile(path.join(app.getAppPath(), "src/setup/index.html"))
      ipcMain.on("relaunch", () => { app.relaunch(); app.exit() })
      return
    }

    initUpdater()

    let config = readConfig()
    console.log("[shell] config:", JSON.stringify(config))

    if (config.plugins.length === 0) {
      const kernelManifest = path.join(PLUGINS_DIR, "zenbu", KERNEL_MANIFEST)
      console.log("[shell] no plugins in config, checking for kernel at", kernelManifest)
      if (fs.existsSync(kernelManifest)) {
        addPlugin(kernelManifest)
        config = readConfig()
        console.log("[shell] added kernel manifest to config")
      } else {
        console.log("[shell] kernel manifest not found!")
      }
    }

    if (config.plugins.length === 0) {
      console.log("[shell] no plugins to load")
      return
    }

    const firstPlugin = config.plugins[0]
    const projectRoot = findProjectRoot(firstPlugin)
    const tsconfig = findTsconfig(firstPlugin)

    console.log("[shell] project root:", projectRoot)
    console.log("[shell] tsconfig:", tsconfig)

    // Register zenbu virtual barrel loader (must be before dynohot)
    const loaderHooksPath = pathToFileURL(path.join(app.getAppPath(), "src/shell/zenbu-loader-hooks.js")).href
    console.log("[shell] registering zenbu loader from", loaderHooksPath)
    registerLoader(loaderHooksPath)
    console.log("[shell] zenbu loader registered")

    // Register @testbu alias loader
    const aliasLoaderPath = pathToFileURL(path.join(app.getAppPath(), "src/shell/alias-loader-hooks.js")).href
    registerLoader(aliasLoaderPath)
    console.log("[shell] alias loader registered")

    const { register: registerTsx } = await import("tsx/esm/api")
    registerTsx({ tsconfig })
    console.log("[shell] tsx registered")

    await import("@zenbu/advice/node")
    console.log("[shell] advice registered")

    const { register: registerDynohot } = await import("dynohot/register")
    registerDynohot({ ignore: /[/\\]node_modules[/\\]/ })
    console.log("[shell] dynohot registered")

    process.chdir(projectRoot)
    console.log("[shell] cwd:", process.cwd())

    const url = `zenbu:plugins?config=${encodeURIComponent(CONFIG_PATH)}`
    console.log("[shell] loading plugins from config:", CONFIG_PATH)
    try {
      // dynohot wraps hot-imported modules in a controller that defers execution.
      // The module body won't run until we call controller.main().
      // See: packages/dynohot/loader/loader.ts "Main entrypoint shim"
      const mod = await import(url, { with: { hot: "import" } })
      if (typeof mod.default === "function") {
        const controller = mod.default()
        if (controller && typeof controller.main === "function") {
          console.log("[shell] evaluating plugin root via controller.main()")
          await controller.main()
        }
      }
      console.log("[shell] plugins loaded from config")
    } catch (err) {
      console.error("[shell] failed to load plugins from config:", CONFIG_PATH, err)
    }

    const runtime = (globalThis as any).__zenbu_service_runtime__
    if (runtime) {
      console.log("[shell] waiting for runtime...")
      await runtime.whenIdle()
      console.log("[shell] runtime settled")
    } else {
      console.log("[shell] warning: no runtime found after loading services")
    }

    ipcMain.on("relaunch", async () => {
      app.relaunch()
      if (runtime) await runtime.shutdown()
      ;(process as any).reallyExit(0)
    })

    let shuttingDown = false
    const shutdown = () => {
      if (shuttingDown) return
      shuttingDown = true
      console.log("[shell] shutting down...")
      const r = (globalThis as any).__zenbu_service_runtime__
      if (r) {
        r.shutdown().then(() => {
          ;(process as any).reallyExit(0)
        }).catch((err: any) => {
          console.error("[shell] shutdown failed:", err)
          ;(process as any).reallyExit(1)
        })
      } else {
        ;(process as any).reallyExit(0)
      }
    }

    app.on("before-quit", (e) => {
      if (shuttingDown) return
      e.preventDefault()

      const windows = BaseWindow.getAllWindows()
      if (windows.length === 0) {
        shutdown()
        return
      }

      const focusedWin = windows.find(w => w.isFocused()) ?? windows[0]
      dialog.showMessageBox(focusedWin, {
        type: "question",
        message: "Quit Zenbu?",
        detail: "This will close all windows and end any active sessions.",
        buttons: ["Cancel", "Quit"],
        defaultId: 1,
        cancelId: 0,
      }).then((result) => {
        if (result.response === 1) {
          for (const win of BaseWindow.getAllWindows()) {
            (win as any).__zenbu_on_close = null;
            (win as any).__zenbu_on_closed = null;
          }
          shutdown()
        }
      })
    })

    console.log(`\n  Plugins: ${config.plugins.length} loaded`)
  } catch (error) {
    console.error("[shell] failed to start", error)
    app.exit(1)
  }
})
