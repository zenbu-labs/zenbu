import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { WebSocketServer, type WebSocket } from "ws"
import { nanoid } from "nanoid"
import { createDb, type ClientProxy } from "@zenbu/kyju"
import { createRouter } from "@zenbu/kyju/transport"
import { createServer as createRpcServer, createRpcRouter } from "@zenbu/zenrpc"
import { mockAgentSchema, type MockAgentSchema } from "../../shared/schema.ts"
import { migrations } from "../../kyju/index.ts"
import { controlRouter, type ControlRouter } from "./router.ts"
import type { MockAcpConfig } from "../config.ts"
import type { SimulationEngine } from "../simulation/engine.ts"

export type ControlServer = {
  port: number
  db: ClientProxy<MockAgentSchema>
  setEngine: (engine: SimulationEngine) => void
  close: () => void
}

export async function createControlServer(
  config: MockAcpConfig,
): Promise<ControlServer> {
  fs.mkdirSync(config.dbPath, { recursive: true })

  const dbRouter = createRouter()
  const db = await createDb({
    schema: mockAgentSchema,
    migrations,
    path: config.dbPath,
    send: (event) => dbRouter.send(event),
  })

  let engine: SimulationEngine | null = null

  const rpcRouter = createRpcRouter()
  const rpcServer = createRpcServer<ControlRouter>({
    router: () => controlRouter(() => engine, db.client),
    version: "0",
    send: rpcRouter.send,
  })

  const wsDbConnections = new Map<
    string,
    { receive: (event: any) => Promise<void>; close: () => void }
  >()
  const wsRpcConnections = new Map<
    string,
    { receive: (data: string) => void; close: () => void }
  >()

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ status: "ok", name: "mock-acp-control" }))
  })

  const wss = new WebSocketServer({ server })

  wss.on("connection", (ws: WebSocket) => {
    const id = nanoid()
    console.error(`[control] client connected: ${id}`)

    const dbConn = dbRouter.connection({
      send: (event) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ ch: "db", data: event }))
        }
      },
      postMessage: db.postMessage,
    })
    wsDbConnections.set(id, dbConn)

    const rpcConn = rpcRouter.connection({
      send: (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ ch: "rpc", data }))
        }
      },
      postMessage: rpcServer.postMessage,
      removeClient: rpcServer.removeClient,
    })
    wsRpcConnections.set(id, rpcConn)

    ws.on("message", async (raw: Buffer) => {
      const msg = JSON.parse(String(raw))
      if (msg.ch === "db") {
        await dbConn.receive(msg.data)
      } else if (msg.ch === "rpc") {
        rpcConn.receive(msg.data)
      }
    })

    ws.on("close", () => {
      console.error(`[control] client disconnected: ${id}`)
      const dc = wsDbConnections.get(id)
      if (dc) {
        dc.close()
        wsDbConnections.delete(id)
      }
      const rc = wsRpcConnections.get(id)
      if (rc) {
        rc.close()
        wsRpcConnections.delete(id)
      }
    })
  })

  const port = await new Promise<number>((resolve) => {
    server.listen(config.controlPort, "0.0.0.0", () => {
      const addr = server.address()
      const assignedPort = typeof addr === "object" && addr ? addr.port : 0
      resolve(assignedPort)
    })
  })

  await db.client.controlPort.set(port)

  // Write port file so desktop app can discover the control port
  const portFile = path.join(process.cwd(), ".zenbu", "mock-acp", "port")
  fs.mkdirSync(path.dirname(portFile), { recursive: true })
  fs.writeFileSync(portFile, String(port))

  console.error(`[control] server ready on port ${port}`)
  console.error(`[control] db at ${config.dbPath}`)

  return {
    port,
    db: db.client,
    setEngine: (e: SimulationEngine) => {
      engine = e
    },
    close: () => {
      for (const conn of wsDbConnections.values()) conn.close()
      for (const conn of wsRpcConnections.values()) conn.close()
      wss.close()
      server.close()
      try { fs.unlinkSync(portFile) } catch {}
    },
  }
}
