import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { connectCli } from "../lib/rpc"

function printUsage() {
  console.log(`
Usage:
  zen profile [--duration <ms>] [--out <path>]   CPU profile the kernel main process
  zen profile heap [--out <path>]                Heap snapshot of the kernel main process

Flags:
  --duration <ms>   Profile window length (default 5000)
  --out <path>      Output file (default /tmp/zenbu-<timestamp>.cpuprofile or .heapsnapshot)

Load the result in Chrome DevTools:
  Performance tab → Load profile…   (for .cpuprofile)
  Memory tab → Load snapshot…        (for .heapsnapshot)
`)
}

function parseFlags(argv: string[]): {
  mode: "cpu" | "heap"
  duration: number
  out?: string
} {
  const mode = argv[0] === "heap" ? "heap" : "cpu"
  const rest = mode === "heap" ? argv.slice(1) : argv
  let duration = 5_000
  let out: string | undefined
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a === "--duration") duration = Number(rest[++i])
    else if (a === "--out" || a === "-o") out = rest[++i]
    else if (a === "--help" || a === "-h") {
      printUsage()
      process.exit(0)
    }
  }
  return { mode, duration, out }
}

export async function runProfile(argv: string[]) {
  const { mode, duration, out } = parseFlags(argv)
  const conn = await connectCli()
  if (!conn) {
    console.error("zen profile: app isn't running (no runtime.json)")
    process.exit(1)
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-")
  const defaultExt = mode === "cpu" ? "cpuprofile" : "heapsnapshot"
  const outPath = resolve(out ?? `/tmp/zenbu-${ts}.${defaultExt}`)

  console.log(
    mode === "cpu"
      ? `[profile] sampling main for ${duration}ms…`
      : `[profile] capturing heap snapshot of main…`,
  )
  try {
    const rpc = conn.rpc as any
    const data: string =
      mode === "cpu"
        ? await rpc.debug.cpuProfileMain(duration)
        : await rpc.debug.heapSnapshotMain()
    writeFileSync(outPath, data)
    console.log(
      `[profile] wrote ${data.length.toLocaleString()} bytes → ${outPath}`,
    )
  } catch (err) {
    console.error("[profile] failed:", err)
    process.exitCode = 1
  } finally {
    await conn.close()
  }
}
