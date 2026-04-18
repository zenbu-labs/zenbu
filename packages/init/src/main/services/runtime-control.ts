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
}

runtime.register(RuntimeControlService, (import.meta as any).hot)
