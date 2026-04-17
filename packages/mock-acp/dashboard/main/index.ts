import { app, BaseWindow } from "electron"
import { Effect, Layer, ManagedRuntime } from "effect"
import electronContextMenu from "electron-context-menu"
import { DbService } from "./services/db"
import { HttpService } from "./services/http"
import { MockAgentConnectionService } from "./services/mock-agent-connection"
import { RpcService } from "./services/rpc"
import { WindowService } from "./services/window"

app.on("web-contents-created", (_event, contents) => {
  electronContextMenu({ window: contents, showInspectElement: true })
})

/**
 * Service DAG:
 *
 * RpcService, WindowService (top-level, depend on everything below)
 *   ↓
 * MockAgentConnectionService (connects to mock agent WS)
 *   ↓
 * DbService (dashboard's own Kyju DB)
 *   ↓
 * HttpService (HTTP + WS server, leaf)
 */
const AppLive = Layer.mergeAll(
  RpcService.Default,
  WindowService.Default,
).pipe(
  Layer.provideMerge(MockAgentConnectionService.Default),
  Layer.provideMerge(DbService.Default),
  Layer.provideMerge(HttpService.Default),
)

let runtime: ManagedRuntime.ManagedRuntime<any, never> | null = null

app.whenReady().then(async () => {
  const t0 = performance.now()
  console.log("[dashboard] app ready, building runtime...")
  runtime = ManagedRuntime.make(AppLive)
  console.log(`[dashboard] runtime created (${(performance.now() - t0).toFixed(1)}ms)`)

  const [windowService, httpService] = await Promise.all([
    runtime.runPromise(WindowService),
    runtime.runPromise(HttpService),
  ])
  console.log(`[dashboard] services initialized (${(performance.now() - t0).toFixed(1)}ms)`)

  if (process.env.ELECTRON_RENDERER_URL) {
    const base = process.env.ELECTRON_RENDERER_URL.replace(/\/$/, "")
    console.log(`\n  Dashboard: ${base}/orchestrator/index.html?wsPort=${httpService.port}\n`)
  }

  Effect.runSync(windowService.createAppWindow)
  console.log(`[dashboard] window created (${(performance.now() - t0).toFixed(1)}ms)`)
})

app.on("activate", async () => {
  if (BaseWindow.getAllWindows().length === 0 && runtime) {
    const windowService = await runtime.runPromise(WindowService)
    Effect.runSync(windowService.createAppWindow)
  }
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("before-quit", async () => {
  if (runtime) {
    await runtime.dispose()
    runtime = null
  }
})

console.log(
  `[dashboard] loaded (${process.env.ELECTRON_RENDERER_URL ? "dev" : "prod"})`,
)
