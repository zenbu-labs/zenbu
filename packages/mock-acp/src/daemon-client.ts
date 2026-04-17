import WebSocket from "ws"
import { connectRpc } from "@zenbu/zenrpc"
import type { RegistryRouter, AgentRegistryEntry } from "./registry.ts"
import type { RouterProxy } from "@zenbu/zenrpc"
import { ensureDaemon, getDaemonPort } from "./registry.ts"

export type DaemonConnection = {
  rpc: RouterProxy<RegistryRouter>
  close: () => void
}

export async function connectToDaemon(): Promise<DaemonConnection> {
  const port = await ensureDaemon()
  const url = `ws://127.0.0.1:${port}`

  const ws = new WebSocket(url)

  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve())
    ws.on("error", (err) => reject(err))
  })

  const { server: rpc } = await connectRpc<RegistryRouter>({
    version: "0",
    send: (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ ch: "rpc", data }))
      }
    },
    subscribe: (cb) => {
      const handler = (raw: WebSocket.RawData) => {
        const msg = JSON.parse(String(raw))
        if (msg.ch === "rpc") cb(msg.data)
      }
      ws.on("message", handler)
      return () => ws.off("message", handler)
    },
  })

  return {
    rpc,
    close: () => ws.close(),
  }
}

export type AgentRegistration = {
  id: string
  stopHeartbeat: () => void
  unregister: () => Promise<void>
  updateStatus: (status: string) => Promise<void>
}

export async function registerWithDaemon(opts: {
  controlPort: number
  cwd: string
  status?: string
}): Promise<AgentRegistration> {
  const conn = await connectToDaemon()

  const result = await conn.rpc.register({
    pid: process.pid,
    controlPort: opts.controlPort,
    startedAt: Date.now(),
    cwd: opts.cwd,
    status: opts.status ?? "ready",
  })

  const id = (result as any)?.data?.id ?? (result as any)?.id

  // Start heartbeat
  const timer = setInterval(async () => {
    try {
      await conn.rpc.heartbeat(id)
    } catch {
      // Daemon may have restarted - stop heartbeat
      clearInterval(timer)
    }
  }, 5000)

  return {
    id,
    stopHeartbeat: () => clearInterval(timer),
    unregister: async () => {
      clearInterval(timer)
      try { await conn.rpc.unregister(id) } catch {}
      conn.close()
    },
    updateStatus: async (status: string) => {
      try { await conn.rpc.updateStatus(id, { status }) } catch {}
    },
  }
}
