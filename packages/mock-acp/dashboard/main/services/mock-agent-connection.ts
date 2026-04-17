import { Effect } from "effect"
import WebSocket from "ws"
import { connectReplica } from "@zenbu/kyju/transport"
import { connectRpc } from "@zenbu/zenrpc"
import type { ControlRouter } from "../../../src/control/router"
import type { RegistryRouter, AgentRegistryEntry } from "../../../src/registry"
import type { MockAgentSchema } from "../../../shared/schema"
import type { RouterProxy } from "@zenbu/zenrpc"
import type { ClientProxy } from "@zenbu/kyju"
import type { createReplica } from "@zenbu/kyju"
import { HttpService } from "./http"
import { ensureDaemon } from "../../../src/registry"

type Replica = ReturnType<typeof createReplica>

export class MockAgentConnectionService extends Effect.Service<MockAgentConnectionService>()(
  "MockAgentConnectionService",
  {
    scoped: Effect.gen(function* () {
      const httpService = yield* HttpService

      let mockRpc: RouterProxy<ControlRouter> | null = null
      let mockDb: ClientProxy<MockAgentSchema> | null = null
      let mockReplica: Replica | null = null
      let mockWs: WebSocket | null = null

      const connect = async (url: string) => {
        if (mockWs) {
          mockWs.close()
        }

        const ws = new WebSocket(url)
        mockWs = ws

        await new Promise<void>((resolve, reject) => {
          ws.on("open", () => resolve())
          ws.on("error", (err) => reject(err))
        })

        const { server: rpc } = await connectRpc<ControlRouter>({
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

        const {
          client: dbClient,
          replica,
          disconnect: disconnectDb,
        } = await connectReplica<MockAgentSchema>({
          send: (event) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ ch: "db", data: event }))
            }
          },
          subscribe: (cb) => {
            const handler = (raw: WebSocket.RawData) => {
              const msg = JSON.parse(String(raw))
              if (msg.ch === "db") cb(msg.data)
            }
            ws.on("message", handler)
            return () => ws.off("message", handler)
          },
        })

        mockRpc = rpc
        mockDb = dbClient
        mockReplica = replica

        console.log(`[mock-agent-conn] connected to ${url}`)

        return { rpc, db: dbClient, replica, disconnect: disconnectDb }
      }

      // Forward mock agent DB events to renderer clients via ch: "mock-db"
      httpService.onConnected((_id, ws) => {
        ws.on("message", async (raw: Buffer) => {
          const msg = JSON.parse(String(raw))
          if (msg.ch === "mock-db" && mockWs && mockWs.readyState === WebSocket.OPEN) {
            // Renderer wants to talk to mock agent's DB — forward it
            mockWs.send(JSON.stringify({ ch: "db", data: msg.data }))
          }
        })

        // Forward mock agent DB events back to the renderer
        if (mockWs) {
          const forwardHandler = (raw: WebSocket.RawData) => {
            const msg = JSON.parse(String(raw))
            if (msg.ch === "db" && ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ ch: "mock-db", data: msg.data }))
            }
          }
          mockWs.on("message", forwardHandler)
        }
      })

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          if (mockWs) {
            mockWs.close()
            console.log("[mock-agent-conn] disconnected")
          }
        }),
      )

      // ─── Daemon connection for agent discovery ──────────────
      let daemonRpc: RouterProxy<RegistryRouter> | null = null
      let daemonWs: WebSocket | null = null
      let daemonReplica: Replica | null = null
      let daemonClient: ClientProxy<any> | null = null

      const connectToDaemon = async () => {
        const port = await ensureDaemon()
        const url = `ws://127.0.0.1:${port}`

        if (daemonWs) daemonWs.close()
        const ws = new WebSocket(url)
        daemonWs = ws

        await new Promise<void>((resolve, reject) => {
          ws.on("open", () => resolve())
          ws.on("error", (err) => reject(err))
        })

        const { server: rpc } = await connectRpc<RegistryRouter>({
          version: "0",
          send: (data) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ch: "rpc", data }))
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

        const { client: dbClient, replica } = await connectReplica({
          send: (event) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ch: "db", data: event }))
          },
          subscribe: (cb) => {
            const handler = (raw: WebSocket.RawData) => {
              const msg = JSON.parse(String(raw))
              if (msg.ch === "db") cb(msg.data)
            }
            ws.on("message", handler)
            return () => ws.off("message", handler)
          },
        })

        daemonRpc = rpc
        daemonClient = dbClient
        daemonReplica = replica

        // Forward daemon DB events to renderer via "daemon-db" channel
        httpService.onConnected((_id, clientWs) => {
          clientWs.on("message", async (raw: Buffer) => {
            const msg = JSON.parse(String(raw))
            if (msg.ch === "daemon-db" && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ ch: "db", data: msg.data }))
            }
          })

          if (ws.readyState === WebSocket.OPEN) {
            const forwardHandler = (raw: WebSocket.RawData) => {
              const msg = JSON.parse(String(raw))
              if (msg.ch === "db" && clientWs.readyState === clientWs.OPEN) {
                clientWs.send(JSON.stringify({ ch: "daemon-db", data: msg.data }))
              }
            }
            ws.on("message", forwardHandler)
          }
        })

        console.log(`[mock-agent-conn] connected to daemon at ${url}`)
        return { rpc }
      }

      const listRegisteredAgents = async (): Promise<AgentRegistryEntry[]> => {
        if (!daemonRpc) {
          try { await connectToDaemon() } catch { return [] }
        }
        const result = await daemonRpc!.listAgents()
        return (result as any)?.data?.agents ?? (result as any)?.agents ?? []
      }

      const connectToAgent = async (agentId: string) => {
        const agents = await listRegisteredAgents()
        const agent = agents.find((a) => a.id === agentId)
        if (!agent) throw new Error(`Agent ${agentId} not found in registry`)
        const url = `ws://127.0.0.1:${agent.controlPort}`
        return connect(url)
      }

      console.log("[mock-agent-conn] service ready")

      return {
        connect,
        connectToDaemon,
        listRegisteredAgents,
        connectToAgent,
        get rpc() { return mockRpc },
        get db() { return mockDb },
        get replica() { return mockReplica },
        get connected() { return mockWs !== null && mockWs.readyState === WebSocket.OPEN },
        get daemonRpc() { return daemonRpc },
        get daemonConnected() { return daemonWs !== null && daemonWs.readyState === WebSocket.OPEN },
      } as const
    }),
  },
) {}
