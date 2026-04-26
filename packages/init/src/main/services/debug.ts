import * as inspector from "node:inspector/promises"
import { Service, runtime } from "../runtime"

/**
 * On-demand profiling for the kernel main process. Call
 * `rpc.debug.cpuProfileMain(durationMs)` to capture a V8 CPU profile —
 * returns a JSON string you can save as `.cpuprofile` and load into
 * Chrome DevTools → Performance → Load profile.
 *
 * Uses Node's built-in `inspector` module (no extra deps, no
 * `--inspect` flag needed).
 */
export class DebugService extends Service {
  static key = "debug"
  static deps = {}

  async cpuProfileMain(durationMs = 5_000): Promise<string> {
    const session = new inspector.Session()
    session.connect()
    try {
      await session.post("Profiler.enable")
      await session.post("Profiler.start")
      await new Promise<void>((resolve) =>
        setTimeout(resolve, Math.max(100, durationMs)),
      )
      const { profile } = (await session.post("Profiler.stop")) as {
        profile: unknown
      }
      return JSON.stringify(profile)
    } finally {
      try {
        await session.post("Profiler.disable")
      } catch {}
      session.disconnect()
    }
  }

  /**
   * Heap snapshot of the kernel main process as a string. Save as
   * `.heapsnapshot` and load into DevTools → Memory → Load snapshot.
   * Output is MBs — expect a few seconds.
   */
  async heapSnapshotMain(): Promise<string> {
    const session = new inspector.Session()
    session.connect()
    const chunks: string[] = []
    try {
      session.on("HeapProfiler.addHeapSnapshotChunk", (msg) => {
        const chunk = (msg as any)?.params?.chunk
        if (typeof chunk === "string") chunks.push(chunk)
      })
      await session.post("HeapProfiler.enable")
      await session.post("HeapProfiler.takeHeapSnapshot", {
        reportProgress: false,
      })
      return chunks.join("")
    } finally {
      try {
        await session.post("HeapProfiler.disable")
      } catch {}
      session.disconnect()
    }
  }

  /** Useful for debugging platform capabilities (e.g. drag-region support). */
  async versions(): Promise<Record<string, string>> {
    return { ...process.versions } as Record<string, string>
  }

  evaluate() {}
}

runtime.register(DebugService, (import.meta as any).hot)
