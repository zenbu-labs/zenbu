import { writeFileSync } from "node:fs"
import { connectCli } from "../lib/rpc"

function printUsage() {
  console.log(`
zen browser — inspect and drive the Zenbu browser plugin.

Usage:
  zen browser list                          List all browser instances (one per mounted pane)
  zen browser tabs [--instance <id>]        List tabs in one or every instance
  zen browser screenshot <tabId>
      [--output <file>] [--format png|jpeg]
                                            Capture a screenshot. Without --output, prints data URL.
  zen browser navigate <tabId> <url>        Load a URL in a tab
  zen browser cdp <tabId> <method> [--params '<json>']
                                            Send a raw Chrome DevTools Protocol command
  zen browser help                          Show this help
`)
}

async function withConn<T>(
  fn: (conn: Awaited<ReturnType<typeof connectCli>> & {}) => Promise<T>,
): Promise<T | null> {
  const conn = await connectCli()
  if (!conn) {
    console.error("zen browser: Zenbu is not running (no runtime.json).")
    process.exit(1)
  }
  try {
    return await fn(conn)
  } finally {
    conn.close()
  }
}

export async function runBrowser(argv: string[]) {
  const sub = argv[0]
  const rest = argv.slice(1)

  switch (sub) {
    case "list":
      return cmdList(rest)
    case "tabs":
      return cmdTabs(rest)
    case "screenshot":
      return cmdScreenshot(rest)
    case "navigate":
      return cmdNavigate(rest)
    case "cdp":
      return cmdCdp(rest)
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printUsage()
      return
    default:
      console.error(`zen browser: unknown subcommand "${sub}"`)
      printUsage()
      process.exit(1)
  }
}

async function cmdList(_argv: string[]) {
  await withConn(async (conn) => {
    const { instances } = await (conn.rpc as any)["browser-content"].listInstances()
    if (instances.length === 0) {
      console.log("No browser instances mounted.")
      return
    }
    for (const inst of instances) {
      console.log(
        `${inst.id}  (window=${inst.windowId})  tabs=${inst.tabCount}  active=${inst.activeTabId || "<none>"}`,
      )
    }
  })
}

async function cmdTabs(argv: string[]) {
  const instanceId = getOption(argv, "--instance")
  await withConn(async (conn) => {
    if (instanceId) {
      const { tabs } = await (conn.rpc as any)["browser-content"].listTabs({ instanceId })
      printTabs(instanceId, tabs)
      return
    }
    const { instances } = await (conn.rpc as any)["browser-content"].listInstances()
    for (const inst of instances) printTabs(inst.id, inst.tabs)
  })
}

function printTabs(instanceId: string, tabs: any[]) {
  if (tabs.length === 0) {
    console.log(`[${instanceId}]  (no tabs)`)
    return
  }
  console.log(`[${instanceId}]`)
  for (const t of tabs) {
    const flags: string[] = []
    if (t.active) flags.push("active")
    if (t.loading) flags.push("loading")
    const tag = flags.length > 0 ? `[${flags.join(",")}] ` : ""
    const title = t.title ? ` "${truncate(t.title, 60)}"` : ""
    console.log(`  ${t.id}  ${tag}${t.url}${title}`)
  }
}

async function cmdScreenshot(argv: string[]) {
  const tabId = argv.find((a) => !a.startsWith("--"))
  if (!tabId) {
    console.error("zen browser screenshot: missing <tabId>")
    process.exit(1)
  }
  const output = getOption(argv, "--output")
  const format = (getOption(argv, "--format") ?? "png") as "png" | "jpeg"
  await withConn(async (conn) => {
    const { dataUrl, width, height } = await (conn.rpc as any)[
      "browser-content"
    ].screenshot({ tabId, format })
    if (!dataUrl) {
      console.error(`zen browser screenshot: unknown tab "${tabId}"`)
      process.exit(1)
    }
    if (output) {
      const b64 = dataUrl.replace(/^data:[^;]+;base64,/, "")
      writeFileSync(output, Buffer.from(b64, "base64"))
      console.log(`Wrote ${width}x${height} ${format} to ${output}`)
    } else {
      console.log(dataUrl)
    }
  })
}

async function cmdNavigate(argv: string[]) {
  const positional = argv.filter((a) => !a.startsWith("--"))
  const tabId = positional[0]
  const url = positional[1]
  if (!tabId || !url) {
    console.error("zen browser navigate: usage: navigate <tabId> <url>")
    process.exit(1)
  }
  await withConn(async (conn) => {
    await (conn.rpc as any)["browser-content"].navigate({ tabId, url })
    console.log(`Navigating tab ${tabId} → ${url}`)
  })
}

async function cmdCdp(argv: string[]) {
  const positional = argv.filter((a, i, a2) => {
    if (a.startsWith("--")) return false
    const prev = a2[i - 1]
    return prev !== "--params"
  })
  const tabId = positional[0]
  const method = positional[1]
  if (!tabId || !method) {
    console.error("zen browser cdp: usage: cdp <tabId> <method> [--params '<json>']")
    process.exit(1)
  }
  const paramsRaw = getOption(argv, "--params")
  let params: any = {}
  if (paramsRaw) {
    try {
      params = JSON.parse(paramsRaw)
    } catch (err) {
      console.error("zen browser cdp: --params must be valid JSON")
      process.exit(1)
    }
  }
  await withConn(async (conn) => {
    const result = await (conn.rpc as any)["browser-content"].cdp({
      tabId,
      method,
      params,
    })
    console.log(JSON.stringify(result, null, 2))
  })
}

function getOption(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  if (i === -1 || i === argv.length - 1) return undefined
  return argv[i + 1]
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + "…"
}
