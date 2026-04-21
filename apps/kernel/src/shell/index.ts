import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { register as registerLoader } from "node:module";
import { app, BaseWindow, BrowserWindow, ipcMain } from "electron";
import { closeAllWatchers } from "dynohot/pause";
import { readConfig, addPlugin, CONFIG_PATH } from "./config";
import { initUpdater } from "./updater";
import { bootstrapEnv } from "./env-bootstrap";
import { detectPreflight, triggerXcodeCliInstall } from "./preflight";

const PLUGINS_DIR = path.join(os.homedir(), ".zenbu", "plugins");
const KERNEL_MANIFEST = "packages/init/zenbu.plugin.json";

// ----- File logging -----
//
// In dev mode a relaunched Electron process is detached from the terminal
// that started `pnpm dev`, so stdout/stderr is invisible. Mirror every
// `console.log` / `console.error` / `console.warn` call to a rolling
// log file so we can `tail -F` it while testing the relaunch flow.
//
// Also captures `uncaughtException` / `unhandledRejection` so a crashed
// renderer / main-process exception is recoverable from the log.

/**
 * 
 * ah why are we doing this in the shell
 */
(() => {
  try {
    const internalDir = path.join(os.homedir(), ".zenbu", ".internal");
    fs.mkdirSync(internalDir, { recursive: true });
    const logPath = path.join(internalDir, "kernel.log");
    const stream = fs.createWriteStream(logPath, { flags: "a" });
    const banner =
      `\n\n===== kernel boot pid=${process.pid} ${new Date().toISOString()} =====\n` +
      `argv: ${JSON.stringify(process.argv)}\n` +
      `cwd:  ${process.cwd()}\n\n`;
    stream.write(banner);

    const tee = (orig: (...a: any[]) => void, level: string) =>
      (...args: any[]) => {
        try {
          const line = args
            .map((a) =>
              typeof a === "string"
                ? a
                : a instanceof Error
                ? `${a.stack ?? a.message}`
                : (() => {
                    try {
                      return JSON.stringify(a);
                    } catch {
                      return String(a);
                    }
                  })(),
            )
            .join(" ");
          stream.write(`[${level}] ${line}\n`);
        } catch {}
        orig(...args);
      };
    console.log = tee(console.log.bind(console), "log");
    console.error = tee(console.error.bind(console), "err");
    console.warn = tee(console.warn.bind(console), "warn");

    process.on("uncaughtException", (err) => {
      try {
        stream.write(`[uncaught] ${err.stack ?? err.message}\n`);
      } catch {}
    });
    process.on("unhandledRejection", (reason) => {
      try {
        const msg =
          reason instanceof Error ? reason.stack ?? reason.message : String(reason);
        stream.write(`[unhandled-rejection] ${msg}\n`);
      } catch {}
    });

    console.log(`[shell] logging to ${logPath}`);
  } catch (err) {
    // Don't let a logging failure block startup.
    console.error("[shell] file logging setup failed:", err);
  }
})();

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function findProjectRoot(manifestPath: string): string {
  let dir = path.dirname(path.resolve(manifestPath));
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  return path.dirname(path.resolve(manifestPath));
}

function findTsconfig(manifestPath: string): string | false {
  let dir = path.dirname(manifestPath);
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, "tsconfig.json");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return false;
}

function needsBootstrapper(): boolean {
  const pluginDir = path.join(PLUGINS_DIR, "zenbu");
  if (!fs.existsSync(pluginDir)) return true;
  // The bootstrapper is responsible for ensuring both prerequisites that the
  // rest of the stack assumes: the cached bun binary and the repo's
  // node_modules. setup.ts handles everything else but needs bun to run.
  const bunBin = path.join(
    os.homedir(),
    "Library",
    "Caches",
    "Zenbu",
    "bin",
    "bun",
  );
  if (!fs.existsSync(bunBin)) return true;
  if (!fs.existsSync(path.join(pluginDir, "node_modules"))) return true;
  return false;
}

app.whenReady().then(async () => {
  try {
    console.log("[shell] app ready");

    const bootstrap = bootstrapEnv();
    console.log("[shell] env bootstrapped", {
      cacheRoot: bootstrap.paths.cacheRoot,
      needsToolchainDownload: bootstrap.needsToolchainDownload,
    });

    const preflight = detectPreflight();
    console.log("[shell] preflight:", preflight);

    const setupWindowOpts = {
      width: 440,
      height: 320,
      resizable: false,
      titleBarStyle: "hidden" as const,
      trafficLightPosition: { x: 12, y: 12 },
      webPreferences: { nodeIntegration: true, contextIsolation: false },
    };

    ipcMain.on("zenbu:quit", () => {
      app.exit(0);
    });

    if (preflight.runningFromDmg) {
      console.log(
        "[shell] running from DMG, showing move-to-applications screen",
      );
      const win = new BrowserWindow(setupWindowOpts);
      win.loadFile(path.join(app.getAppPath(), "src/setup/preflight-dmg.html"));
      return;
    }

    if (!preflight.xcodeCliInstalled) {
      console.log("[shell] xcode CLI tools missing, showing install screen");
      const win = new BrowserWindow(setupWindowOpts);
      win.loadFile(
        path.join(app.getAppPath(), "src/setup/preflight-xcode.html"),
      );
      ipcMain.once("zenbu:trigger-xcode-install", () =>
        triggerXcodeCliInstall(),
      );
      ipcMain.handle("zenbu:poll-xcode", () => {
        const p = detectPreflight();
        return {
          installed: p.xcodeCliInstalled,
          developerDir: p.xcodeDeveloperDir,
        };
      });
      ipcMain.once("zenbu:xcode-ready-relaunch", () => {
        app.relaunch();
        app.exit();
      });
      return;
    }

    // The setup window is gated on needsBootstrapper() ONLY (missing plugin
    // dir or node_modules) — NOT on toolchain readiness. Existing users whose
    // ~/Library/Caches/Zenbu/bin is empty still boot normally; they can run
    // `zen doctor` to download the isolated toolchain when they want the
    // zen CLI. Forcing the setup window on launch caused pnpm to rebuild
    // its store from scratch under the isolated XDG vars, 100% CPU hang.
    if (needsBootstrapper()) {
      console.log("[shell] needs setup, showing bootstrapper");
      const win = new BrowserWindow(setupWindowOpts);
      win.loadFile(path.join(app.getAppPath(), "src/setup/index.html"));
      ipcMain.on("relaunch", () => {
        app.relaunch();
        app.exit();
      });
      return;
    }

    initUpdater();

    let config = readConfig();
    console.log("[shell] config:", JSON.stringify(config));

    if (config.plugins.length === 0) {
      const kernelManifest = path.join(PLUGINS_DIR, "zenbu", KERNEL_MANIFEST);
      console.log(
        "[shell] no plugins in config, checking for kernel at",
        kernelManifest,
      );
      if (fs.existsSync(kernelManifest)) {
        addPlugin(kernelManifest);
        config = readConfig();
        console.log("[shell] added kernel manifest to config");
      } else {
        console.log("[shell] kernel manifest not found!");
      }
    }

    if (config.plugins.length === 0) {
      console.log("[shell] no plugins to load");
      return;
    }

    const firstPlugin = config.plugins[0];
    const projectRoot = findProjectRoot(firstPlugin);
    const tsconfig = findTsconfig(firstPlugin);

    console.log("[shell] project root:", projectRoot);
    console.log("[shell] tsconfig:", tsconfig);

    // Register zenbu virtual barrel loader (must be before dynohot)
    const loaderHooksPath = pathToFileURL(
      path.join(app.getAppPath(), "src/shell/zenbu-loader-hooks.js"),
    ).href;
    console.log("[shell] registering zenbu loader from", loaderHooksPath);
    registerLoader(loaderHooksPath);
    console.log("[shell] zenbu loader registered");

    // Register @testbu alias loader
    const aliasLoaderPath = pathToFileURL(
      path.join(app.getAppPath(), "src/shell/alias-loader-hooks.js"),
    ).href;
    registerLoader(aliasLoaderPath);
    console.log("[shell] alias loader registered");

    const { register: registerTsx } = await import("tsx/esm/api");
    registerTsx({ tsconfig });
    console.log("[shell] tsx registered");

    await import("@zenbu/advice/node");
    console.log("[shell] advice registered");

    const { register: registerDynohot } = await import("dynohot/register");
    registerDynohot({ ignore: /[/\\]node_modules[/\\]/ });
    console.log("[shell] dynohot registered");

    process.chdir(projectRoot);
    console.log("[shell] cwd:", process.cwd());

    const url = `zenbu:plugins?config=${encodeURIComponent(CONFIG_PATH)}`;
    console.log("[shell] loading plugins from config:", CONFIG_PATH);
    try {
      // dynohot wraps hot-imported modules in a controller that defers execution.
      // The module body won't run until we call controller.main().
      // See: packages/dynohot/loader/loader.ts "Main entrypoint shim"
      const mod = await import(url, { with: { hot: "import" } });
      if (typeof mod.default === "function") {
        const controller = mod.default();
        if (controller && typeof controller.main === "function") {
          console.log("[shell] evaluating plugin root via controller.main()");
          await controller.main();
        }
      }
      console.log("[shell] plugins loaded from config");
    } catch (err) {
      console.error(
        "[shell] failed to load plugins from config:",
        CONFIG_PATH,
        err,
      );
    }

    const runtime = (globalThis as any).__zenbu_service_runtime__;
    if (runtime) {
      console.log("[shell] waiting for runtime...");
      await runtime.whenIdle();
      console.log("[shell] runtime settled");
    } else {
      console.log("[shell] warning: no runtime found after loading services");
    }

    ipcMain.on("relaunch", () => {
      // Schedule a relaunch after the natural quit finishes, then trigger
      // `app.quit()` which lands in our `before-quit` handler and runs the
      // two-phase shutdown → Electron naturally terminates → relaunch
      // fires. Don't short-circuit the shutdown here.
      //
      // `args: [app.getAppPath()]` is required in dev mode to avoid
      // "Unable to find Electron app at …" dialogs — see git-updates.ts.
      app.relaunch({ args: [app.getAppPath()] });
      app.quit();
    });

    let shutdownState: "idle" | "running" | "ready" = "idle";
/**
 * this needs to be moved out of the hsell
 */
    app.on("before-quit", (e) => {
      // Two-phase quit:
      //   1. First event: state=idle. We `preventDefault()` to stop
      //      Electron tearing down NOW, kick off the async shutdown, and
      //      when it completes re-call `app.quit()`.
      //   2. Re-entry: state=ready. We DON'T preventDefault so Electron
      //      proceeds with its normal quit cycle. By now every service is
      //      stopped and every fs watcher is closed, so FSEvents won't
      //      fire into the dying isolate (→ napi/SIGABRT).
      // If we skipped step 1 (i.e. let Electron quit while our async
      // shutdown was mid-flight), the V8 isolate would die while
      // ReloaderService's Vite dev servers still had chokidar + fsevents
      // watchers armed, and the next fsevents dispatch would crash the
      // process.
      if (shutdownState === "ready") return;
      e.preventDefault();
      if (shutdownState === "running") return;
      shutdownState = "running";

      console.log("[shell] shutting down...");
      for (const win of BaseWindow.getAllWindows()) {
        (win as any).__zenbu_on_close = null;
        (win as any).__zenbu_on_closed = null;
      }

      const finalize = () => {
        try {
          closeAllWatchers();
        } catch (err) {
          console.error("[shell] closeAllWatchers failed:", err);
        }
        // Yield once so any FSEvents/dispatch callbacks queued before
        // watcher.close() ran get delivered into the now-closed watchers
        // (where they're dropped) instead of racing Electron's final
        // unwind. Without this drain, a late fsevents dispatch can fire
        // during V8 isolate teardown → napi assertion → SIGABRT →
        // macOS shows "Zenbu quit unexpectedly" after a clean relaunch.
        setImmediate(() => {
          shutdownState = "ready";
          app.quit();
        });
      };

      const r = (globalThis as any).__zenbu_service_runtime__;
      if (r) {
        r.shutdown()
          .then(finalize)
          .catch((err: any) => {
            console.error("[shell] runtime.shutdown failed:", err);
            finalize();
          });
      } else {
        finalize();
      }
    });

    console.log(`\n  Plugins: ${config.plugins.length} loaded`);
  } catch (error) {
    console.error("[shell] failed to start", error);
    app.exit(1);
  }
});
