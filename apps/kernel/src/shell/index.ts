import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { register as registerLoader } from "node:module";
import { MessageChannel, type MessagePort } from "node:worker_threads";
import { app, BaseWindow, BrowserWindow, WebContentsView, ipcMain } from "electron";
import { closeAllWatchers } from "dynohot/pause";
import { readConfig, addPlugin, CONFIG_PATH } from "./config";
import { initUpdater } from "./updater";
import { bootstrapEnv } from "./env-bootstrap";
import { detectPreflight, triggerXcodeCliInstall } from "./preflight";
import { checkPluginVersions, type Incompatible } from "./version-check";
import { kernelUpdaterBus } from "../../../../packages/init/shared/kernel-updater-bus";
import { bootBus } from "../../../../packages/init/shared/boot-bus";
import {
  trace as traceSpan,
  traceSync as traceSpanSync,
  mark as traceMark,
} from "../../../../packages/init/shared/tracer";
import {
  renderFlameGraph,
  type ServiceSpan,
  type TraceSpan,
  type TraceMark,
} from "./boot-trace";

// Keep in sync with `packages/init/shared/schema/index.ts::MAIN_WINDOW_ID`.
// Hard-coded to avoid the schema's zod/kyju/agent transitive deps in the
// kernel esbuild bundle.
const MAIN_WINDOW_ID = "main";

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

/**
 * Show the kernel upgrade preflight INSIDE the existing boot window by
 * swapping its `loadingView` HTML from `src/boot/index.html` to
 * `src/setup/preflight-kernel-upgrade.html`. Reusing the same window (rather
 * than opening a new `BrowserWindow`) avoids a jarring second window on top
 * of the already-visible boot spinner.
 *
 * Drives the existing `electron-updater` pipeline (via `kernelUpdaterBus`)
 * end-to-end: check → download → install → relaunch.
 *
 * IPC shape:
 *   renderer → main:
 *     zenbu:kernel-upgrade-start    : begin check + auto-download on available
 *     zenbu:kernel-upgrade-install  : run quitAndInstall() after downloaded
 *     zenbu:quit                    : user chose to quit instead
 *   main → renderer:
 *     zenbu:kernel-upgrade-context  : { current, incompatible } (on load)
 *     zenbu:kernel-upgrade-progress : { phase, percent? }
 *     zenbu:kernel-upgrade-error    : { message }
 *     zenbu:kernel-upgrade-ready    : () — download done; renderer auto-installs
 */
function showKernelUpgradeScreen(
  bootWindow: BaseWindow,
  loadingView: WebContentsView,
  incompatible: Incompatible[],
): void {
  // Shrink the boot window to a preflight-sized dialog so the upgrade copy
  // isn't lost in an 800x900 canvas. Re-center while we're at it.
  const display = bootWindow.getBounds();
  const width = 580;
  const height = 440;
  bootWindow.setBounds({
    x: display.x + Math.round((display.width - width) / 2),
    y: display.y + Math.round((display.height - height) / 2),
    width,
    height,
  });

  loadingView.webContents.loadFile(
    path.join(app.getAppPath(), "src/setup/preflight-kernel-upgrade.html"),
  );

  const send = (channel: string, payload: unknown) => {
    if (loadingView.webContents.isDestroyed()) return;
    loadingView.webContents.send(channel, payload);
  };

  // Translate updater bus events into renderer-visible IPC messages.
  const unsubChecking = kernelUpdaterBus.on("updater.checking", () =>
    send("zenbu:kernel-upgrade-progress", { phase: "checking" }),
  );
  const unsubAvailable = kernelUpdaterBus.on(
    "updater.available",
    ({ version }) => {
      send("zenbu:kernel-upgrade-progress", {
        phase: "downloading",
        percent: 0,
        version,
      });
      // Auto-kick the download once an update is confirmed available. The
      // user already opted in by clicking "Update now".
      kernelUpdaterBus.emit("updater.cmd.download", { requestId: "upgrade" });
    },
  );
  const unsubNotAvailable = kernelUpdaterBus.on(
    "updater.not-available",
    ({ currentVersion }) => {
      send("zenbu:kernel-upgrade-error", {
        message: `No newer version available (you're on ${currentVersion}). The installed plugins require a newer kernel that hasn't been released yet.`,
      });
    },
  );
  const unsubProgress = kernelUpdaterBus.on(
    "updater.download-progress",
    ({ percent }) => {
      send("zenbu:kernel-upgrade-progress", {
        phase: "downloading",
        percent: Math.round(percent),
      });
    },
  );
  const unsubDownloaded = kernelUpdaterBus.on(
    "updater.downloaded",
    ({ version }) => {
      send("zenbu:kernel-upgrade-ready", { version });
    },
  );
  const unsubError = kernelUpdaterBus.on("updater.error", ({ message }) => {
    send("zenbu:kernel-upgrade-error", { message });
  });

  // Once the HTML finishes loading, hand it the incompatibility list so it
  // can render the plugin names + versions.
  loadingView.webContents.once("did-finish-load", () => {
    send("zenbu:kernel-upgrade-context", {
      current: app.getVersion(),
      incompatible,
    });
  });

  // Wire renderer commands.
  const onStart = () => {
    kernelUpdaterBus.emit("updater.cmd.check", { requestId: "upgrade" });
  };
  const onInstall = () => {
    kernelUpdaterBus.emit("updater.cmd.install", { requestId: "upgrade" });
  };
  ipcMain.on("zenbu:kernel-upgrade-start", onStart);
  ipcMain.on("zenbu:kernel-upgrade-install", onInstall);

  // Clean up listeners when the boot window closes.
  bootWindow.on("closed", () => {
    ipcMain.removeListener("zenbu:kernel-upgrade-start", onStart);
    ipcMain.removeListener("zenbu:kernel-upgrade-install", onInstall);
    unsubChecking();
    unsubAvailable();
    unsubNotAvailable();
    unsubProgress();
    unsubDownloaded();
    unsubError();
  });
}

app.whenReady().then(async () => {
  try {
    // Optional CPU profile for boot-time diagnosis. Enable with
    // ZENBU_CPU_PROFILE=1. Writes `~/.zenbu/.internal/boot.cpuprofile` on
    // bootBus.ready, parseable by Chrome DevTools or our own analyzer.
    // Started HERE (first thing in whenReady) to capture the whole boot.
    let cpuProfilerSession:
      | { post: (method: string, params?: any) => Promise<any>; disconnect: () => void }
      | null = null;
    if (process.env.ZENBU_CPU_PROFILE === "1") {
      try {
        const inspector = await import("node:inspector/promises");
        const s = new inspector.Session();
        s.connect();
        await s.post("Profiler.enable");
        // Sampling interval in microseconds. Default is 1000µs (1ms) —
        // enough granularity for our ~2-3s plugin-import phase.
        await s.post("Profiler.setSamplingInterval", { interval: 500 });
        await s.post("Profiler.start");
        cpuProfilerSession = s as any;
        console.log("[cpu-prof] started (sampling every 500µs)");
      } catch (err) {
        console.error("[cpu-prof] failed to start:", err);
      }
    }

    // Anchor the boot timeline the moment Electron is ready — everything we do
    // from here forward is attributable. Wire the trace collectors before any
    // `traceSpan`/`mark` so the first events aren't dropped.
    const bootStartedAt = Date.now();
    const pendingStarts = new Map<string, number>();
    const serviceSpans: ServiceSpan[] = [];
    const serviceByKey = new Map<string, ServiceSpan>();
    const rootSpans: TraceSpan[] = [];
    const marks: TraceMark[] = [];

    const unsubSvcStart = bootBus.on("service:start", ({ key, at }) => {
      pendingStarts.set(key, at);
      // Register the span placeholder now so effects that fire DURING
      // `evaluate()` (before `service:end`) can nest under this service.
      if (!serviceByKey.has(key)) {
        const placeholder: ServiceSpan = {
          key,
          startedAt: at,
          endedAt: at,
          durationMs: 0,
          children: [],
        };
        serviceByKey.set(key, placeholder);
        serviceSpans.push(placeholder);
      }
    });
    const unsubSvcEnd = bootBus.on(
      "service:end",
      ({ key, at, durationMs, error }) => {
        pendingStarts.delete(key);
        const existing = serviceByKey.get(key);
        if (existing) {
          existing.endedAt = at;
          existing.durationMs = durationMs;
          if (error) existing.error = error;
        } else {
          const span: ServiceSpan = {
            key,
            startedAt: at - durationMs,
            endedAt: at,
            durationMs,
            error,
            children: [],
          };
          serviceSpans.push(span);
          serviceByKey.set(key, span);
        }
      },
    );
    const unsubTrace = bootBus.on(
      "trace:span",
      ({ parentKey, name, startedAt, durationMs, error, meta }) => {
        const span: TraceSpan = {
          parentKey,
          name,
          startedAt,
          endedAt: startedAt + durationMs,
          durationMs,
          error,
          meta,
        };
        if (parentKey && serviceByKey.has(parentKey)) {
          serviceByKey.get(parentKey)!.children.push(span);
        } else {
          rootSpans.push(span);
        }
      },
    );
    const unsubMark = bootBus.on("trace:mark", ({ name, at, meta }) => {
      marks.push({ name, at, meta });
    });

    console.log("[shell] app ready");

    const bootstrap = traceSpanSync("env-bootstrap", () => bootstrapEnv());
    console.log("[shell] env bootstrapped", {
      cacheRoot: bootstrap.paths.cacheRoot,
      needsToolchainDownload: bootstrap.needsToolchainDownload,
    });

    const preflight = traceSpanSync("preflight", () => detectPreflight());
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
      // app.exit() can hang when electron-updater's ShipIt XPC or a pending
      // download holds the event loop — the user clicks Quit and nothing
      // happens. Force-SIGKILL after a brief grace period so the button is
      // reliable no matter what state the updater is in.
      app.exit(0);
      setTimeout(() => process.kill(process.pid, "SIGKILL"), 500);
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

    // ----- Boot window -----
    //
    // Spawn a BaseWindow immediately with a loading WebContentsView so the
    // launch is visible instantly — Vite + services take multiple seconds
    // before the orchestrator is ready. The init-script announces progress
    // via `bootBus`; we forward every status to the loading view over IPC.
    //
    // Once services evaluate, `BaseWindowService` adopts this window from
    // `globalThis.__zenbu_boot_windows__` (so it doesn't spawn a duplicate),
    // and `WindowService` attaches the orchestrator `WebContentsView` beneath
    // the loading view. On the orchestrator's `did-finish-load`, the loading
    // view is removed → window seamlessly becomes the orchestrator.
    const { bootWindow, loadingView } = traceSpanSync(
      "boot-window-create",
      () => {
        const bootWindow = new BaseWindow({
          width: 800,
          height: 900,
          show: true,
          titleBarStyle: "hidden",
          trafficLightPosition: { x: 12, y: 10 },
          backgroundColor: "#F4F4F4",
        });
        const loadingView = new WebContentsView({
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
          },
        });
        loadingView.setBackgroundColor("#F4F4F4");
        bootWindow.contentView.addChildView(loadingView);
        const layoutLoadingView = () => {
          const { width, height } = bootWindow.getContentBounds();
          loadingView.setBounds({ x: 0, y: 0, width, height });
        };
        layoutLoadingView();
        bootWindow.on("resize", layoutLoadingView);
        loadingView.webContents.loadFile(
          path.join(app.getAppPath(), "src/boot/index.html"),
        );
        return { bootWindow, loadingView };
      },
    );

    // Tag the window so `WindowService.attachView` knows to insert the
    // orchestrator beneath the loading view and swap on did-finish-load.
    (bootWindow as any).__zenbu_loading_view__ = loadingView;

    // Publish for `BaseWindowService` to claim on first evaluate.
    (globalThis as any).__zenbu_boot_windows__ = [
      { windowId: MAIN_WINDOW_ID, win: bootWindow },
    ];

    // Buffer boot messages until the loading view's HTML finishes loading —
    // webContents.send() before did-finish-load silently drops the message.
    type QueuedMsg = { channel: string; payload: unknown };
    let loadingReady = false;
    const pending: QueuedMsg[] = [];
    const send = (channel: string, payload: unknown) => {
      if (loadingView.webContents.isDestroyed()) return;
      if (loadingReady) {
        loadingView.webContents.send(channel, payload);
      } else {
        pending.push({ channel, payload });
      }
    };
    loadingView.webContents.once("did-finish-load", () => {
      traceMark("window-visible");
      loadingReady = true;
      for (const msg of pending) {
        if (loadingView.webContents.isDestroyed()) break;
        loadingView.webContents.send(msg.channel, msg.payload);
      }
      pending.length = 0;
    });

    const unsubStatus = bootBus.on("status", (payload) => {
      send("zenbu:boot-status", payload);
    });
    const unsubError = bootBus.on("error", (payload) => {
      send("zenbu:boot-error", payload);
    });

    const unsubReady = bootBus.on("ready", () => {
      unsubStatus();
      unsubError();
      unsubSvcStart();
      unsubSvcEnd();
      unsubTrace();
      unsubMark();
      unsubReady();

      void (async () => {
        try {
          const loaderStatsArr = await flushLoaders().catch(
            () => [] as LoaderStats[],
          );
          const readyAt = Date.now();
          const totalMs = readyAt - bootStartedAt;
          const trace = {
            bootStartedAt,
            readyAt,
            totalMs,
            serviceSpans,
            rootSpans,
            marks,
            loaderStats: loaderStatsArr,
          };
          const report = renderFlameGraph(trace);
          console.log("\n" + report + "\n");

          const internalDir = path.join(os.homedir(), ".zenbu", ".internal");
          fs.mkdirSync(internalDir, { recursive: true });
          const tracePath = path.join(internalDir, "boot-trace.log");
          const body =
            `===== boot trace pid=${process.pid} ${new Date(readyAt).toISOString()} =====\n` +
            report +
            "\n\n" +
            JSON.stringify(trace, null, 2) +
            "\n";
          fs.writeFileSync(tracePath, body);

          // JSON-only sibling for the perf harness (`scripts/perf-boot.mjs`).
          // The .log file mixes a human-readable report + JSON; the .json file
          // is just the structured payload, easier to parse programmatically.
          const traceJsonPath = path.join(internalDir, "boot-trace.json");
          fs.writeFileSync(traceJsonPath, JSON.stringify(trace, null, 2));

          console.log(`[boot-trace] wrote ${tracePath}`);

          // Stop + dump CPU profile if enabled. Do it BEFORE app.quit() so
          // the inspector session has a chance to flush.
          if (cpuProfilerSession) {
            try {
              const { profile } = await cpuProfilerSession.post(
                "Profiler.stop",
              );
              const profPath = path.join(internalDir, "boot.cpuprofile");
              fs.writeFileSync(profPath, JSON.stringify(profile));
              try {
                cpuProfilerSession.disconnect();
              } catch {}
              console.log(`[cpu-prof] wrote ${profPath}`);
            } catch (err) {
              console.error("[cpu-prof] stop/write failed:", err);
            }
          }

          // Perf harness mode: exit cleanly after writing the trace so a
          // wrapper script can spawn-measure-spawn-measure in a loop.
          if (process.env.ZENBU_PERF_EXIT_ON_READY === "1") {
            console.log("[boot-trace] ZENBU_PERF_EXIT_ON_READY=1 — quitting");
            // setImmediate so the trace write fully flushes + this log lands
            // before Electron's quit cycle yanks the process out from under us.
            setImmediate(() => app.quit());
          }
        } catch (err) {
          console.error("[boot-trace] render/write failed:", err);
        }
      })();
    });

    bootBus.emit("status", { message: "Starting Zenbu…" });

    await traceSpan("init-updater", async () => initUpdater());

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

    // Kernel version compatibility gate. Any plugin manifest with a
    // `requiredVersion` semver range that the current kernel version doesn't
    // satisfy short-circuits boot and swaps the boot window's content for a
    // dedicated upgrade screen. Plugins without the field are treated as
    // compatible.
    const incompatible = checkPluginVersions(config.plugins, app.getVersion());
    if (incompatible.length > 0) {
      console.log(
        `[shell] kernel ${app.getVersion()} is too old for ${incompatible.length} plugin(s); showing upgrade screen`,
      );
      for (const i of incompatible) {
        console.log(`  - ${i.plugin} requires ${i.required}`);
      }
      // initUpdater() is idempotent; we call it here (instead of later) so
      // the `kernelUpdaterBus` subscriptions in `showKernelUpgradeScreen`
      // actually receive events.
      initUpdater();
      showKernelUpgradeScreen(bootWindow, loadingView, incompatible);
      return;
    }

    const firstPlugin = config.plugins[0];
    const projectRoot = findProjectRoot(firstPlugin);
    const tsconfig = findTsconfig(firstPlugin);

    console.log("[shell] project root:", projectRoot);
    console.log("[shell] tsconfig:", tsconfig);

    bootBus.emit("status", { message: "Preparing runtime…" });

    // Loader telemetry: each loader gets a `MessagePort` and accumulates
    // per-hook timing stats. We flush at `bootBus.ready` and render a summary.
    type LoaderStats = {
      name: string;
      resolveCount: number;
      resolveMs: number;
      loadCount: number;
      loadMs: number;
    };
    const loaderPorts: MessagePort[] = [];
    const registerTelemetryLoader = (hooksPath: string) => {
      const { port1, port2 } = new MessageChannel();
      loaderPorts.push(port2);
      port2.unref();
      registerLoader(hooksPath, {
        data: { tracePort: port1 },
        transferList: [port1],
      });
    };
    const flushLoaders = async (timeoutMs = 1000): Promise<LoaderStats[]> => {
      const results = await Promise.all(
        loaderPorts.map(
          (port) =>
            new Promise<LoaderStats | null>((resolve) => {
              const timer = setTimeout(() => resolve(null), timeoutMs);
              port.once("message", (msg: LoaderStats) => {
                clearTimeout(timer);
                resolve(msg);
              });
              port.postMessage("flush");
            }),
        ),
      );
      return results.filter((r): r is LoaderStats => r !== null);
    };

    await traceSpan("loader-register", async () => {
      // Register zenbu virtual barrel loader (must be before dynohot)
      const loaderHooksPath = pathToFileURL(
        path.join(app.getAppPath(), "src/shell/zenbu-loader-hooks.js"),
      ).href;
      registerTelemetryLoader(loaderHooksPath);
      const aliasLoaderPath = pathToFileURL(
        path.join(app.getAppPath(), "src/shell/alias-loader-hooks.js"),
      ).href;
      registerTelemetryLoader(aliasLoaderPath);
    });

    await traceSpan("tsx-register", async () => {
      const { register: registerTsx } = await import("tsx/esm/api");
      registerTsx({ tsconfig });
    });

    await traceSpan("advice-register", async () => {
      // Anchor the advice transform to the kernel's project root. Without
      // this, node-loader falls back to process.cwd(), which may be an
      // ancestor of third-party plugins when launched via `zen --blocking`
      // from a high-up dir — pulling their .ts files into the transform
      // and injecting `@zenbu/advice/runtime` imports they can't resolve.
      process.env.ZENBU_ADVICE_ROOT = projectRoot;
      await import("@zenbu/advice/node");
    });

    await traceSpan("dynohot-register", async () => {
      const { register: registerDynohot } = await import("dynohot/register");
      registerDynohot({ ignore: /[/\\]node_modules[/\\]/ });
    });

    process.chdir(projectRoot);
    console.log("[shell] cwd:", process.cwd());

    // Preload discovery + kickoff. Each plugin may declare a `preload` field
    // pointing to a module with a default async export; the kernel imports it
    // HERE — before plugin-import — so its work overlaps with the ~2s of
    // transform/wrap/eval that plugin-import incurs. Results live on a
    // globalThis-keyed Map and are accessed via `getPreload(name)` (see
    // `packages/init/src/main/preload-get.ts`).
    //
    // Preloads deliberately do NOT pass `{ with: { hot: "import" } }` to
    // import(), so dynohot doesn't wrap them. Reason: dynohot's entrypoint
    // shim owns the "hot:main" slot, and only the plugin root should occupy
    // it. Preloads are kernel-driven code, not hot-reloadable user code.
    const preloads = new Map<string, Promise<unknown>>();
    (globalThis as unknown as { __zenbu_preloads__: Map<string, Promise<unknown>> })
      .__zenbu_preloads__ = preloads;
    await traceSpan("preload-kickoff", async () => {
      for (const manifestPath of config.plugins) {
        let manifest: { name?: string; preload?: string };
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        } catch (err) {
          console.error(`[shell] failed to read manifest ${manifestPath}:`, err);
          continue;
        }
        if (!manifest.name || !manifest.preload) continue;
        const preloadAbs = path.resolve(
          path.dirname(manifestPath),
          manifest.preload,
        );
        const preloadURL = pathToFileURL(preloadAbs).href;
        // `then(m => m.default())` invokes the default-export async function,
        // so the stored Promise resolves to the preload's RESULT, not the
        // module. This matches what consumers see via `getPreload`.
        preloads.set(
          manifest.name,
          import(preloadURL).then(
            (m) => (m.default as () => Promise<unknown>)(),
            (err) => {
              console.error(
                `[shell] preload import failed for ${manifest.name}:`,
                err,
              );
              throw err;
            },
          ),
        );
      }
    });

    bootBus.emit("status", { message: "Loading plugins…" });

    const url = `zenbu:plugins?config=${encodeURIComponent(CONFIG_PATH)}`;
    console.log("[shell] loading plugins from config:", CONFIG_PATH);
    try {
      // dynohot wraps hot-imported modules in a controller that defers execution.
      // The module body won't run until we call controller.main().
      // See: packages/dynohot/loader/loader.ts "Main entrypoint shim"
      const mod = await traceSpan("plugin-import", () =>
        import(url, { with: { hot: "import" } }),
      );
      if (typeof mod.default === "function") {
        const controller = mod.default();
        if (controller && typeof controller.main === "function") {
          await traceSpan("plugin-main", () => controller.main());
        }
      }
    } catch (err) {
      console.error(
        "[shell] failed to load plugins from config:",
        CONFIG_PATH,
        err,
      );
    }

    const runtime = (globalThis as any).__zenbu_service_runtime__;
    if (runtime) {
      bootBus.emit("status", { message: "Starting services…" });
      await traceSpan("runtime-drain", () => runtime.whenIdle());
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

      const finalize = async () => {
        try {
          await closeAllWatchers();
        } catch (err) {
          console.error("[shell] closeAllWatchers failed:", err);
        }
        // Hard-kill ourselves. Every service is torn down, every
        // watcher unsubscribed, every db flushed. Both app.quit() and
        // app.exit() still go through FreeEnvironment → CleanupHandles
        // where @parcel/watcher@2.5.6's napi_async_cleanup_hook has a
        // PromiseRunner::onWorkComplete bug: on env teardown (napi_cancelled),
        // it falls through to error-handling code that calls napi
        // (`napi_get_last_error_info`, `Error::New`) against a dying env →
        // napi_fatal_error → SIGABRT → macOS crash dialog. SIGKILL bypasses
        // FreeEnvironment entirely.
        process.kill(process.pid, "SIGKILL");
      };

      // Hard ceiling: SIGKILL within 2s no matter what runtime.shutdown does.
      // Prevents the race where a slow teardown lets Electron force env
      // teardown before our SIGKILL fires (triggering the upstream bug).
      const hardKillTimer = setTimeout(() => {
        console.warn("[shell] shutdown timed out at 2s — forcing SIGKILL");
        process.kill(process.pid, "SIGKILL");
      }, 2000);

      const r = (globalThis as any).__zenbu_service_runtime__;
      if (r) {
        r.shutdown()
          .then(() => {
            clearTimeout(hardKillTimer);
            return finalize();
          })
          .catch((err: any) => {
            console.error("[shell] runtime.shutdown failed:", err);
            clearTimeout(hardKillTimer);
            finalize();
          });
      } else {
        clearTimeout(hardKillTimer);
        finalize();
      }
    });

    console.log(`\n  Plugins: ${config.plugins.length} loaded`);
  } catch (error) {
    console.error("[shell] failed to start", error);
    app.exit(1);
  }
});
