import http from "node:http"
import type { WebSocket } from "ws"
import { nanoid } from "nanoid"
import { Service, runtime } from "../runtime"
import { ServerService } from "./server"
import { ReloaderService } from "./reloader"
import type { Duplex } from "stream"

type ConnectedCallback = (id: string, ws: WebSocket) => void
type DisconnectedCallback = (id: string) => void

type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void

export class HttpService extends Service {
  static key = "http"
  static deps = { server: ServerService, reloader: ReloaderService }
  declare ctx: { server: ServerService; reloader: ReloaderService }

  connectedCallbacks: ConnectedCallback[] = []
  disconnectedCallbacks: DisconnectedCallback[] = []
  activeConnections = new Map<string, WebSocket>()
  private requestHandlers = new Map<string, RequestHandler>()

  get port() { return this.ctx.server.port }

  addRequestHandler(prefix: string, handler: RequestHandler): () => void {
    this.requestHandlers.set(prefix, handler)
    return () => { this.requestHandlers.delete(prefix) }
  }

  onConnected(cb: ConnectedCallback) {
    this.connectedCallbacks.push(cb)
    return () => { this.connectedCallbacks = this.connectedCallbacks.filter(f => f !== cb) }
  }

  onDisconnected(cb: DisconnectedCallback) {
    this.disconnectedCallbacks.push(cb)
    return () => { this.disconnectedCallbacks = this.disconnectedCallbacks.filter(f => f !== cb) }
  }

  evaluate() {
    this.connectedCallbacks = []
    this.disconnectedCallbacks = []

    const { server } = this.ctx

    const startTime = performance.now()

    this.effect("proxy", () => {
      const viteAgent = new http.Agent({ keepAlive: true, maxSockets: 20 })

      const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
        const url = req.url ?? "/"
        for (const [prefix, routeHandler] of this.requestHandlers) {
          if (url.startsWith(prefix)) {
            routeHandler(req, res)
            return
          }
        }

        const coreEntry = this.ctx.reloader.get("core")
        if (!coreEntry) {
          res.writeHead(503)
          res.end("Vite server not ready")
          return
        }
        const reloaderUrl = coreEntry.url.replace(/\/$/, "")
        const target = new URL(url, reloaderUrl)
        const proxyHeaders = { ...req.headers, host: target.host }
        const proxyReq = http.request(
          target,
          { method: req.method, headers: proxyHeaders, agent: viteAgent },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
            proxyRes.pipe(res)
          },
        )
        proxyReq.on("error", () => {
          res.writeHead(502)
          res.end("Bad Gateway")
        })
        req.pipe(proxyReq)
      }

      server.server!.on("request", handler)
      return () => {
        server.server!.off("request", handler)
        viteAgent.destroy()
      }
    })

    this.effect("vite-hmr-proxy", () => {
      const removeHandler = server.addUpgradeHandler((req, socket, head) => {
        const protocols = req.headers["sec-websocket-protocol"]
        if (!protocols || !protocols.includes("vite-hmr")) return false

        const coreEntry = this.ctx.reloader.get("core")
        if (!coreEntry) {
          socket.destroy()
          return true
        }

        const target = new URL(coreEntry.url)
        const proxyReq = http.request({
          hostname: target.hostname,
          port: target.port,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: target.host },
        })
        proxyReq.on("upgrade", (_res, proxySocket, proxyHead) => {
          socket.write(
            `HTTP/1.1 101 Switching Protocols\r\n` +
            Object.entries(_res.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n") +
            "\r\n\r\n",
          )
          if (proxyHead.length) socket.write(proxyHead)
          proxySocket.pipe(socket as Duplex).pipe(proxySocket)
        })
        // 
        proxyReq.on("error", () => socket.destroy())
        proxyReq.end(head)
        return true
      })
      return removeHandler
    })

    this.effect("ws-dispatch", () => {
      const onConnection = (ws: WebSocket) => {
        const id = nanoid()
        const elapsed = (performance.now() - startTime).toFixed(1)
        console.log(`[http] ws connected: ${id} (${elapsed}ms since start)`)

        this.activeConnections.set(id, ws)
        for (const cb of this.connectedCallbacks) cb(id, ws)

        ws.on("close", () => {
          console.log(`[http] ws disconnected: ${id}`)
          this.activeConnections.delete(id)
          for (const cb of this.disconnectedCallbacks) cb(id)
        })
      }

      server.wss!.on("connection", onConnection)
      return () => {
        server.wss!.off("connection", onConnection)
      }
    })

    console.log(`[http] service ready on port ${this.port}`)
  }
}

runtime.register(HttpService, (import.meta as any).hot)
