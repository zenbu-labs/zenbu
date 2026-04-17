#!/usr/bin/env bun

import { spawn } from "node:child_process"
import { resolve, join } from "node:path"
import { homedir } from "node:os"
import { existsSync, readFileSync } from "node:fs"
import { createConnection } from "node:net"

const RUNTIME_JSON = join(homedir(), ".zenbu", ".internal", "runtime.json")
const DB_CONFIG_JSON = join(homedir(), ".zenbu", ".internal", "db.json")

function parseArgs(argv: string[]): {
  agent?: string
  blocking: boolean
  resume: boolean
  verbose: boolean
} {
  let agent: string | undefined
  let blocking = false
  let resume = false
  let verbose = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--blocking") {
      blocking = true
    } else if (arg === "--resume") {
      resume = true
    } else if (arg === "--verbose" || arg === "-v") {
      verbose = true
    } else if (arg === "--agent" && i + 1 < argv.length) {
      agent = argv[++i]
    } else if (arg.startsWith("--agent=")) {
      agent = arg.slice("--agent=".length)
    } else if (!arg.startsWith("-") && agent == null) {
      agent = arg
    }
  }

  return { agent, blocking, resume, verbose }
}

type RuntimeConfig = {
  socketPath: string
  dbPath: string
  pid: number
}

function readRuntimeConfig(): RuntimeConfig | null {
  try {
    if (!existsSync(RUNTIME_JSON)) return null
    const data = JSON.parse(readFileSync(RUNTIME_JSON, "utf-8"))
    if (!data.socketPath || !data.pid) return null
    try {
      process.kill(data.pid, 0)
    } catch {
      return null
    }
    return data
  } catch {
    return null
  }
}

function readDbPath(): string | null {
  try {
    if (!existsSync(DB_CONFIG_JSON)) return null
    const data = JSON.parse(readFileSync(DB_CONFIG_JSON, "utf-8"))
    return data.dbPath ?? null
  } catch {
    return null
  }
}

function sendSocketCommand(
  socketPath: string,
  cmd: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const conn = createConnection(socketPath, () => {
      conn.write(JSON.stringify(cmd) + "\n")
    })
    let buffer = ""
    conn.on("data", (chunk) => {
      buffer += chunk.toString()
      const newlineIdx = buffer.indexOf("\n")
      if (newlineIdx !== -1) {
        const line = buffer.slice(0, newlineIdx)
        conn.end()
        try {
          resolve(JSON.parse(line))
        } catch {
          reject(new Error("Invalid response"))
        }
      }
    })
    conn.on("error", reject)
    conn.setTimeout(3000, () => {
      conn.destroy()
      reject(new Error("Socket timeout"))
    })
  })
}

type AgentRow = {
  id: string
  name: string
  configId: string
  status: string
  lastUserMessageAt?: number
}

function readAgentsFromDb(dbPath: string): AgentRow[] {
  try {
    const rootPath = join(dbPath, "root.json")
    if (!existsSync(rootPath)) return []
    const root = JSON.parse(readFileSync(rootPath, "utf-8"))
    return root?.plugin?.kernel?.agents ?? []
  } catch {
    return []
  }
}

function getLastAgentId(dbPath: string): string | undefined {
  const agents = readAgentsFromDb(dbPath)
  if (agents.length === 0) return undefined
  const sorted = [...agents]
    .filter((a) => a.lastUserMessageAt != null)
    .sort((a, b) => b.lastUserMessageAt! - a.lastUserMessageAt!)
  return sorted[0]?.id
}

async function interactiveResume(config: RuntimeConfig) {
  const agents = readAgentsFromDb(config.dbPath)
  if (agents.length === 0) {
    console.log("No agents found.")
    process.exit(0)
  }

  console.log("\nAvailable agents:\n")
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i]
    console.log(`  ${i + 1}) ${a.name} (${a.configId})`)
  }
  console.log()

  process.stdout.write("Select agent number: ")
  const input = await new Promise<string>((resolve) => {
    let data = ""
    process.stdin.setEncoding("utf-8")
    process.stdin.once("data", (chunk) => {
      data += chunk
      resolve(data.trim())
    })
  })

  const idx = parseInt(input, 10) - 1
  if (isNaN(idx) || idx < 0 || idx >= agents.length) {
    console.error("Invalid selection.")
    process.exit(1)
  }

  const selected = agents[idx]
  console.log(`\nOpening ${selected.name}...`)

  const result = await sendSocketCommand(config.socketPath, {
    cmd: "create-window",
    agentId: selected.id,
  })

  if ((result as any).error) {
    console.error("Error:", (result as any).error)
    process.exit(1)
  }
}

async function main() {
  const { agent, blocking, resume, verbose } = parseArgs(process.argv.slice(2))
  const log = verbose ? (...args: unknown[]) => console.error("[zen]", ...args) : () => {}
  const cwd = process.cwd()
  const config = readRuntimeConfig()

  log("parsed args:", { agent, blocking, resume })
  log("config:", config ? { socketPath: config.socketPath, dbPath: config.dbPath, pid: config.pid } : null)

  if (resume) {
    if (!config) {
      console.error("Zenbu is not running. Start it first.")
      process.exit(1)
    }
    await interactiveResume(config)
    return
  }

  if (config) {
    try {
      const lastAgentId = agent ? undefined : getLastAgentId(config.dbPath)
      log("socket path: agent:", agent, "lastAgentId:", lastAgentId)
      const result = await sendSocketCommand(config.socketPath, {
        cmd: "create-window",
        agent,
        agentId: lastAgentId,
        cwd,
      })
      log("socket result:", result)
      if ((result as any).error) {
        console.error("Error:", (result as any).error)
        process.exit(1)
      }
      return
    } catch (err) {
      log("socket failed, falling through to spawn:", err)
    }
  }

  const arch = process.arch === "x64" ? "mac-x64" : "mac-arm64"
  const root = resolve(import.meta.dir, "../../..")
  const bin = resolve(
    root,
    `apps/kernel/dist/${arch}/Zenbu.app/Contents/MacOS/Zenbu`,
  )

  const electronArgs: string[] = []
  if (agent) {
    electronArgs.push(`--zen-agent=${agent}`)
  } else {
    const dbPath = config?.dbPath ?? readDbPath()
    const lastAgentId = dbPath ? getLastAgentId(dbPath) : undefined
    log("spawn path: dbPath:", dbPath, "lastAgentId:", lastAgentId)
    if (lastAgentId) electronArgs.push(`--zen-agent-id=${lastAgentId}`)
  }
  electronArgs.push(`--zen-cwd=${cwd}`)
  electronArgs.push(`--zen-width=775`)
  log("electronArgs:", electronArgs)
  log("bin:", bin)

  if (blocking) {
    const child = spawn(bin, electronArgs, { stdio: "inherit" })
    process.on("SIGINT", () => child.kill("SIGINT"))
    process.on("SIGTERM", () => child.kill("SIGTERM"))
    child.on("exit", (code, signal) => {
      process.exit(code ?? (signal ? 1 : 0))
    })
  } else {
    const child = spawn(bin, electronArgs, {
      detached: true,
      stdio: "ignore",
    })
    child.unref()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
