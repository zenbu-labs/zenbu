import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import http from "node:http"
import { WebSocketServer, WebSocket } from "ws"
import { nanoid } from "nanoid"
import { createDb, type ClientProxy } from "@zenbu/kyju"
import { createRouter } from "@zenbu/kyju/transport"
import { createServer as createRpcServer, createRpcRouter } from "@zenbu/zenrpc"
import zod from "zod"
import { createSchema, f, type InferSchema } from "@zenbu/kyju/schema"
import { spawn } from "node:child_process"

// ─── Well-known paths ────────────────────────────────────────

const ZENBU_DIR = path.join(os.homedir(), ".zenbu")
const PORT_FILE = path.join(ZENBU_DIR, "daemon-port")
const PID_FILE = path.join(ZENBU_DIR, "daemon-pid")
const DB_PATH = path.join(ZENBU_DIR, "daemon-db")

// ─── Registry Schema ─────────────────────────────────────────

const agentEntrySchema = zod.object({
  id: zod.string(),
  pid: zod.number(),
  controlPort: zod.number(),
  startedAt: zod.number(),
  lastSeen: zod.number(),
  cwd: zod.string(),
  status: zod.string(),
})

export type AgentRegistryEntry = zod.infer<typeof agentEntrySchema>

export const registrySchema = createSchema({
  agents: f.array(agentEntrySchema).default([]),
})

export type RegistrySchema = InferSchema<typeof registrySchema>

// ─── Registry RPC Router ─────────────────────────────────────

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function registryRouter(db: ClientProxy<RegistrySchema>) {
  return {
    register: async (entry: Omit<AgentRegistryEntry, "id" | "lastSeen">) => {
      const root = db.readRoot() as any
      const alive = (root.agents as AgentRegistryEntry[]).filter((a) => isPidAlive(a.pid))
      const id = nanoid()
      const newEntry: AgentRegistryEntry = { ...entry, id, lastSeen: Date.now() }
      await db.agents.set([...alive, newEntry])
      console.error(`[daemon] registered agent ${id} (pid: ${entry.pid}, port: ${entry.controlPort})`)
      return { id }
    },

    unregister: async (agentId: string) => {
      const root = db.readRoot() as any
      await db.agents.set((root.agents as AgentRegistryEntry[]).filter((a) => a.id !== agentId))
      console.error(`[daemon] unregistered agent ${agentId}`)
      return { ok: true }
    },

    updateStatus: async (agentId: string, updates: { status?: string }) => {
      const root = db.readRoot() as any
      await db.agents.set(
        (root.agents as AgentRegistryEntry[]).map((a) =>
          a.id === agentId ? { ...a, ...updates, lastSeen: Date.now() } : a,
        ),
      )
      return { ok: true }
    },

    heartbeat: async (agentId: string) => {
      const root = db.readRoot() as any
      await db.agents.set(
        (root.agents as AgentRegistryEntry[]).map((a) =>
          a.id === agentId ? { ...a, lastSeen: Date.now() } : a,
        ),
      )
      return { ok: true }
    },

    listAgents: async () => {
      const root = db.readRoot() as any
      const all = root.agents as AgentRegistryEntry[]
      const alive = all.filter((a) => isPidAlive(a.pid))
      if (alive.length !== all.length) await db.agents.set(alive)
      return { agents: alive }
    },
  }
}

export type RegistryRouter = ReturnType<typeof registryRouter>

// ─── Daemon Server ───────────────────────────────────────────

export async function startDaemon(): Promise<{ port: number }> {
  fs.mkdirSync(DB_PATH, { recursive: true })

  const dbRouter = createRouter()
  const db = await createDb({
    schema: registrySchema,
    migrations: [],
    path: DB_PATH,
    send: (event) => dbRouter.send(event),
  })

  const rpcRouter = createRpcRouter()
  const rpcServer = createRpcServer<RegistryRouter>({
    router: () => registryRouter(db.client),
    version: "0",
    send: rpcRouter.send,
  })

  const wsConns = new Map<string, { db: { receive: (e: any) => Promise<void>; close: () => void }; rpc: { receive: (d: string) => void; close: () => void } }>()

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ status: "ok", name: "zenbu-daemon" }))
  })

  const wss = new WebSocketServer({ server })

  wss.on("connection", (ws: WebSocket) => {
    const id = nanoid()

    const dbConn = dbRouter.connection({
      send: (event) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ ch: "db", data: event }))
      },
      postMessage: db.postMessage,
    })

    const rpcConn = rpcRouter.connection({
      send: (data) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ ch: "rpc", data }))
      },
      postMessage: rpcServer.postMessage,
      removeClient: rpcServer.removeClient,
    })

    wsConns.set(id, { db: dbConn, rpc: rpcConn })

    ws.on("message", async (raw: Buffer) => {
      const msg = JSON.parse(String(raw))
      if (msg.ch === "db") await dbConn.receive(msg.data)
      else if (msg.ch === "rpc") rpcConn.receive(msg.data)
    })

    ws.on("close", () => {
      const c = wsConns.get(id)
      if (c) { c.db.close(); c.rpc.close(); wsConns.delete(id) }
    })
  })

  const port = await new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      resolve(typeof addr === "object" && addr ? addr.port : 0)
    })
  })

  fs.mkdirSync(ZENBU_DIR, { recursive: true })
  fs.writeFileSync(PORT_FILE, String(port))
  fs.writeFileSync(PID_FILE, String(process.pid))

  console.error(`[daemon] listening on 127.0.0.1:${port} (pid ${process.pid})`)

  const cleanup = () => {
    for (const c of wsConns.values()) { c.db.close(); c.rpc.close() }
    wss.close()
    server.close()
    try { fs.unlinkSync(PORT_FILE) } catch {}
    try { fs.unlinkSync(PID_FILE) } catch {}
  }

  process.on("SIGINT", () => { cleanup(); process.exit(0) })
  process.on("SIGTERM", () => { cleanup(); process.exit(0) })

  return { port }
}

// ─── Daemon Management ───────────────────────────────────────

export function getDaemonPort(): number | null {
  try { return parseInt(fs.readFileSync(PORT_FILE, "utf-8").trim(), 10) }
  catch { return null }
}

export function getDaemonPid(): number | null {
  try { return parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10) }
  catch { return null }
}

export function isDaemonRunning(): boolean {
  const pid = getDaemonPid()
  return pid !== null && isPidAlive(pid)
}

export async function ensureDaemon(): Promise<number> {
  if (isDaemonRunning()) {
    const port = getDaemonPort()
    if (port) return port
  }

  // Spawn daemon as detached child
  const thisFile = new URL(import.meta.url).pathname
  const child = spawn(process.execPath, ["--import", "tsx/esm", thisFile, "--daemon"], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  })
  child.unref()

  // Poll for the port file to appear
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100))
    if (isDaemonRunning()) {
      const port = getDaemonPort()
      if (port) return port
    }
  }

  throw new Error("Failed to start daemon within 5 seconds")
}

export function stopDaemon(): boolean {
  const pid = getDaemonPid()
  if (!pid) return false
  try {
    process.kill(pid, "SIGTERM")
    try { fs.unlinkSync(PORT_FILE) } catch {}
    try { fs.unlinkSync(PID_FILE) } catch {}
    return true
  } catch { return false }
}

// ─── Run as daemon if invoked directly with --daemon ─────────

if (process.argv.includes("--daemon")) {
  startDaemon().catch((err) => {
    console.error("[daemon] failed to start:", err)
    process.exit(1)
  })
}
