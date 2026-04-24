import { connectRpc, type EventProxy, type RouterProxy } from "#zenbu/zenrpc"
import type { ServiceRouter } from "#registry/services"
import type { ZenbuEvents } from "#zenbu/init/shared/events"
import { readRuntimeConfig, type RuntimeConfig } from "./runtime"

export type CliRpc = RouterProxy<ServiceRouter>
export type CliEvents = EventProxy<ZenbuEvents>

export type CliConnection = {
  rpc: CliRpc
  events: CliEvents
  config: RuntimeConfig
  close: () => void
}

/**
 * Connect to the running app's RPC over WebSocket, mirroring the renderer
 * pattern in `packages/init/src/renderer/lib/ws-connection.ts`. Returns null
 * when no running app is discoverable — callers fall back to spawning
 * Electron cold.
 */
export async function connectCli(): Promise<CliConnection | null> {
  const config = readRuntimeConfig()
  if (!config) return null

  const ws = new WebSocket(`ws://127.0.0.1:${config.wsPort}`)

  try {
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup()
        resolve()
      }
      const onError = () => {
        cleanup()
        reject(new Error("ws connection refused"))
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error("ws connect timeout"))
      }, 2000)
      const cleanup = () => {
        clearTimeout(timer)
        ws.removeEventListener("open", onOpen)
        ws.removeEventListener("error", onError as any)
      }
      ws.addEventListener("open", onOpen)
      ws.addEventListener("error", onError as any)
    })
  } catch {
    try { ws.close() } catch {}
    return null
  }

  const { server, events, disconnect } = await connectRpc<ServiceRouter, ZenbuEvents>({
    version: "0",
    send: (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ ch: "rpc", data }))
      }
    },
    subscribe: (cb) => {
      const handler = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data as string)
          if (msg.ch === "rpc") cb(msg.data)
        } catch {}
      }
      ws.addEventListener("message", handler)
      return () => ws.removeEventListener("message", handler)
    },
  })

  return {
    rpc: server as CliRpc,
    events: events as CliEvents,
    config,
    close: () => {
      disconnect()
      try { ws.close() } catch {}
    },
  }
}
