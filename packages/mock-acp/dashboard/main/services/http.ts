import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { WebSocketServer, type WebSocket } from "ws"
import { nanoid } from "nanoid"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !!process.env.ELECTRON_RENDERER_URL

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

export class HttpService extends Effect.Service<HttpService>()("HttpService", {
  scoped: Effect.gen(function* () {
    const connectedCallbacks: ((id: string, ws: WebSocket) => void)[] = []
    const disconnectedCallbacks: ((id: string) => void)[] = []

    const viteAgent = isDev
      ? new http.Agent({ keepAlive: true, maxSockets: 20 })
      : undefined

    const server = http.createServer((req, res) => {
      if (isDev) {
        const viteBase = process.env.ELECTRON_RENDERER_URL!.replace(/\/$/, "")
        const target = new URL(req.url ?? "/", viteBase)
        const proxyReq = http.request(
          target,
          { method: req.method, headers: req.headers, agent: viteAgent },
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
      } else {
        const urlPath = new URL(req.url ?? "/", "http://localhost").pathname
        const filePath = path.join(__dirname, "../../renderer", urlPath)
        fs.readFile(filePath, (err, content) => {
          if (err) {
            res.writeHead(404)
            res.end("Not Found")
            return
          }
          const ext = path.extname(filePath)
          res.writeHead(200, {
            "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
          })
          res.end(content)
        })
      }
    })

    const wss = new WebSocketServer({ server })

    wss.on("connection", (ws) => {
      const id = nanoid()
      console.log(`[http] ws connected: ${id}`)
      for (const cb of connectedCallbacks) cb(id, ws)
      ws.on("close", () => {
        console.log(`[http] ws disconnected: ${id}`)
        for (const cb of disconnectedCallbacks) cb(id)
      })
    })

    const port = yield* Effect.promise(
      () =>
        new Promise<number>((resolve) => {
          server.listen(0, "0.0.0.0", () => {
            const addr = server.address()
            resolve(typeof addr === "object" && addr ? addr.port : 0)
          })
        }),
    )

    yield* Effect.addFinalizer(() =>
      Effect.promise(
        () =>
          new Promise<void>((resolve) => {
            wss.close()
            server.close(() => resolve())
          }),
      ),
    )

    console.log(`[http] server ready on port ${port}`)

    return {
      port,
      onConnected: (cb: (id: string, ws: WebSocket) => void) => {
        connectedCallbacks.push(cb)
      },
      onDisconnected: (cb: (id: string) => void) => {
        disconnectedCallbacks.push(cb)
      },
    } as const
  }),
}) {}
