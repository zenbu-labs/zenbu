import { app } from "electron"
import { Service, runtime } from "../runtime"

export class RuntimeControlService extends Service {
  static key = "runtime"
  static deps = {}

  evaluate() {}

  async reload(): Promise<{ ok: true }> {
    // Fire and forget — awaiting here would hang because reloadAll tears down
    // the very transport (http/server/rpc) carrying this response. The frontend
    // will see the WS drop and reconnect once services are back up.
    queueMicrotask(() => {
      runtime.reloadAll().catch((e) => {
        console.error("[runtime-control] reloadAll failed:", e)
      })
    })
    return { ok: true }
  }

  /**
   * Quit the electron process and relaunch. Used after a plugin's setup.ts
   * modifies `node_modules` in a way that the current process can't hot-pick
   * up (new dep versions); the UI surfaces a Relaunch button that calls this.
   */
  async quitAndRelaunch(): Promise<{ ok: true }> {
    // Fire and forget — once we kick off relaunch the transport dies.
    queueMicrotask(() => {
      app.relaunch()
      app.exit(0)
    })
    return { ok: true }
  }
}

runtime.register(RuntimeControlService, (import.meta as any).hot)
