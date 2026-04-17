import { createContext, useContext, useEffect, useRef, useState } from "react"
import { connectReplica } from "@zenbu/kyju/transport"
import { connectRpc } from "@zenbu/zenrpc"
import type { ClientProxy, createReplica } from "@zenbu/kyju"
import type { RouterProxy } from "@zenbu/zenrpc"
import type { MockAgentSchema } from "../../shared/schema"
import type { ControlRouter } from "../../src/control/router"

type Replica = ReturnType<typeof createReplica>

/** Desktop app's server router type (only the methods we need) */
type DesktopRouter = {
  send: (viewId: string, text: string) => Promise<void>
}

export type ControlConnectionState =
  | { status: "connecting" }
  | {
      status: "connected"
      rpc: RouterProxy<ControlRouter>
      db: ClientProxy<MockAgentSchema>
      replica: Replica
      sendPrompt: (text: string) => Promise<void>
    }
  | { status: "error"; error: string }

export function useControlConnection(): ControlConnectionState {
  const [state, setState] = useState<ControlConnectionState>({ status: "connecting" })
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ status: "connecting" })
    cleanupRef.current = null

    const params = new URLSearchParams(window.location.search)
    const controlPort = params.get("controlPort")
    const wsPort = params.get("wsPort")
    const viewId = params.get("viewId")

    if (!controlPort) {
      setState({ status: "error", error: "Missing ?controlPort= in URL" })
      return
    }

    // Connect to mock-acp control server
    const controlWs = new WebSocket(`ws://127.0.0.1:${controlPort}`)

    controlWs.onopen = async () => {
      try {
        const { server: rpc, disconnect: disconnectRpc } =
          await connectRpc<ControlRouter>({
            version: "0",
            send: (data) => {
              if (controlWs.readyState === WebSocket.OPEN) {
                controlWs.send(JSON.stringify({ ch: "rpc", data }))
              }
            },
            subscribe: (cb) => {
              const handler = (e: MessageEvent) => {
                const msg = JSON.parse(e.data)
                if (msg.ch === "rpc") cb(msg.data)
              }
              controlWs.addEventListener("message", handler)
              return () => controlWs.removeEventListener("message", handler)
            },
          })

        const {
          client: db,
          replica,
          disconnect: disconnectDb,
        } = await connectReplica<MockAgentSchema>({
          send: (event) => {
            if (controlWs.readyState === WebSocket.OPEN) {
              controlWs.send(JSON.stringify({ ch: "db", data: event }))
            }
          },
          subscribe: (cb) => {
            const handler = (e: MessageEvent) => {
              const msg = JSON.parse(e.data)
              if (msg.ch === "db") cb(msg.data)
            }
            controlWs.addEventListener("message", handler)
            return () => controlWs.removeEventListener("message", handler)
          },
        })

        if (cancelled) {
          await disconnectDb()
          disconnectRpc()
          controlWs.close()
          return
        }

        // Connect to desktop app for sending prompts
        let sendPrompt: (text: string) => Promise<void> = async () => {}
        let desktopCleanup: (() => void) | null = null

        if (wsPort && viewId) {
          const desktopWs = new WebSocket(`ws://127.0.0.1:${wsPort}`)
          await new Promise<void>((resolve) => {
            desktopWs.onopen = () => resolve()
            desktopWs.onerror = () => resolve() // don't block if desktop WS fails
          })

          if (desktopWs.readyState === WebSocket.OPEN) {
            const { server: desktopRpc, disconnect: disconnectDesktopRpc } =
              await connectRpc<DesktopRouter>({
                version: "0",
                send: (data) => {
                  if (desktopWs.readyState === WebSocket.OPEN) {
                    desktopWs.send(JSON.stringify({ ch: "rpc", data }))
                  }
                },
                subscribe: (cb) => {
                  const handler = (e: MessageEvent) => {
                    const msg = JSON.parse(e.data)
                    if (msg.ch === "rpc") cb(msg.data)
                  }
                  desktopWs.addEventListener("message", handler)
                  return () => desktopWs.removeEventListener("message", handler)
                },
              })

            sendPrompt = (text: string) => desktopRpc.send(viewId, text)
            desktopCleanup = () => {
              disconnectDesktopRpc()
              desktopWs.close()
            }
          }
        }

        cleanupRef.current = () => {
          cancelled = true
          disconnectDb()
          disconnectRpc()
          controlWs.close()
          desktopCleanup?.()
        }

        console.log("[devtools] fully connected")
        setState({ status: "connected", rpc, db, replica, sendPrompt })
      } catch (err) {
        if (!cancelled) {
          setState({ status: "error", error: String(err) })
        }
      }
    }

    controlWs.onerror = () => {
      if (!cancelled) {
        setState({ status: "error", error: "Failed to connect to control server" })
      }
    }

    controlWs.onclose = () => {
      if (!cancelled) {
        setState({ status: "error", error: "Connection to control server closed" })
      }
    }

    return () => {
      cancelled = true
      cleanupRef.current?.()
      controlWs.close()
    }
  }, [])

  return state
}

// Contexts
const RpcContext = createContext<RouterProxy<ControlRouter> | null>(null)
const DbContext = createContext<ClientProxy<MockAgentSchema> | null>(null)
const SendPromptContext = createContext<((text: string) => Promise<void>) | null>(null)

export const RpcProvider = RpcContext.Provider
export const DbProvider = DbContext.Provider
export const SendPromptProvider = SendPromptContext.Provider

export function useRpc(): RouterProxy<ControlRouter> {
  const ctx = useContext(RpcContext)
  if (!ctx) throw new Error("useRpc must be used within RpcProvider")
  return ctx
}

export function useDbClient(): ClientProxy<MockAgentSchema> {
  const ctx = useContext(DbContext)
  if (!ctx) throw new Error("useDbClient must be used within DbProvider")
  return ctx
}

export function useSendPrompt(): (text: string) => Promise<void> {
  const ctx = useContext(SendPromptContext)
  if (!ctx) throw new Error("useSendPrompt must be used within SendPromptProvider")
  return ctx
}
