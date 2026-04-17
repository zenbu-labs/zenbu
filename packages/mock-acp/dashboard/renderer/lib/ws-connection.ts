import { useEffect, useRef, useState } from "react"
import { connectReplica } from "@zenbu/kyju/transport"
import type { ClientProxy } from "@zenbu/kyju"
import { connectRpc } from "@zenbu/zenrpc"
import type { DashboardSchema } from "../../shared/schema/index"
import type { MockAgentSchema } from "../../../shared/schema"
import type { ServerRouter } from "../../main/router"
import type { RouterProxy } from "@zenbu/zenrpc"
import type { createReplica } from "@zenbu/kyju"

export { RpcProvider, useRpc, KyjuClientProvider, useKyjuClient } from "./providers"

type Replica = ReturnType<typeof createReplica>

export type WsConnectionState =
  | { status: "connecting" }
  | {
      status: "connected"
      rpc: RouterProxy<ServerRouter>
      kyjuClient: ClientProxy<DashboardSchema>
      replica: Replica
      mockAgentClient: ClientProxy<MockAgentSchema> | null
      mockAgentReplica: Replica | null
    }
  | { status: "error"; error: string }

export function useWsConnection(): WsConnectionState {
  const [state, setState] = useState<WsConnectionState>({ status: "connecting" })
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ status: "connecting" })
    cleanupRef.current = null

    const t0 = performance.now()
    const wsPort = new URLSearchParams(window.location.search).get("wsPort")

    if (!wsPort) {
      setState({ status: "error", error: "Missing ?wsPort= in URL" })
      return
    }

    const wsUrl = `ws://127.0.0.1:${wsPort}`
    console.log("[ws-conn] connecting to", wsUrl)

    const ws = new WebSocket(wsUrl)

    ws.onopen = async () => {
      try {
        console.log(`[ws-conn] ws connected (${(performance.now() - t0).toFixed(1)}ms)`)

        const { server: rpc, disconnect: disconnectRpc } =
          await connectRpc<ServerRouter>({
            version: "0",
            send: (data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ ch: "rpc", data }))
              }
            },
            subscribe: (cb) => {
              const handler = (e: MessageEvent) => {
                const msg = JSON.parse(e.data)
                if (msg.ch === "rpc") cb(msg.data)
              }
              ws.addEventListener("message", handler)
              return () => ws.removeEventListener("message", handler)
            },
          })
        console.log(`[ws-conn] rpc connected (${(performance.now() - t0).toFixed(1)}ms)`)

        const {
          client: kyjuClient,
          replica,
          disconnect: disconnectDb,
        } = await connectReplica<DashboardSchema>({
          send: (event) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ ch: "db", data: event }))
            }
          },
          subscribe: (cb) => {
            const handler = (e: MessageEvent) => {
              const msg = JSON.parse(e.data)
              if (msg.ch === "db") cb(msg.data)
            }
            ws.addEventListener("message", handler)
            return () => ws.removeEventListener("message", handler)
          },
        })
        console.log(`[ws-conn] kyju connected (${(performance.now() - t0).toFixed(1)}ms)`)

        if (cancelled) {
          await disconnectDb()
          disconnectRpc()
          ws.close()
          return
        }

        cleanupRef.current = () => {
          cancelled = true
          disconnectDb()
          disconnectRpc()
          ws.close()
        }

        // Don't block on mock-db — connect it lazily in the background
        // The mock agent may not be connected yet
        console.log(`[ws-conn] fully connected (${(performance.now() - t0).toFixed(1)}ms)`)
        setState({
          status: "connected",
          rpc,
          kyjuClient,
          replica,
          mockAgentClient: null,
          mockAgentReplica: null,
        })
      } catch (err) {
        if (!cancelled) {
          setState({ status: "error", error: String(err) })
        }
      }
    }

    ws.onerror = (err) => {
      if (!cancelled) {
        setState({ status: "error", error: String(err) })
      }
    }

    ws.onclose = () => {
      if (!cancelled) {
        setState({ status: "error", error: "WebSocket closed unexpectedly" })
      }
    }

    return () => {
      cancelled = true
      cleanupRef.current?.()
      ws.close()
    }
  }, [])

  return state
}
