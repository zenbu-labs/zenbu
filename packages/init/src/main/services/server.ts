import http from "node:http"
import { randomBytes, timingSafeEqual } from "node:crypto"
import { WebSocketServer } from "ws"
import { Service, runtime } from "../runtime"

type UpgradeHandler = (req: http.IncomingMessage, socket: import("stream").Duplex, head: Buffer) => boolean

export class ServerService extends Service {
  static key = "server"
  static deps = {}

  server: http.Server | null = null
  wss: WebSocketServer | null = null
  port = 0
  authToken = randomBytes(32).toString("base64url")
  private upgradeHandlers: UpgradeHandler[] = []

  addUpgradeHandler(handler: UpgradeHandler): () => void {
    this.upgradeHandlers.push(handler)
    return () => { this.upgradeHandlers = this.upgradeHandlers.filter(h => h !== handler) }
  }

  async evaluate() {
    if (!this.server) {
      this.server = http.createServer()
      this.wss = new WebSocketServer({ noServer: true })
      this.server.on("upgrade", (req, socket, head) => {
        for (const handler of this.upgradeHandlers) {
          if (handler(req, socket, head)) return
        }
        if (!this.isAuthorizedUpgrade(req)) {
          socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n")
          socket.destroy()
          return
        }
        this.wss!.handleUpgrade(req, socket, head, (ws) => {
          this.wss!.emit("connection", ws, req)
        })
      })
      this.port = await new Promise<number>((resolve) => {
        this.server!.listen(0, () => {
          const addr = this.server!.address()
          resolve(typeof addr === "object" && addr ? addr.port : 0)
        })
      })
      console.log(`[server] listening on port ${this.port}`)
    }

    this.setup("server-cleanup", () => {
      return () => {
        this.wss?.close()
        this.server?.close()
        this.server?.closeAllConnections()
        this.server = null
        this.wss = null
      }
    })
  }

  private isAuthorizedUpgrade(req: http.IncomingMessage): boolean {
    const rawUrl = req.url ?? "/"
    const token = new URL(rawUrl, "http://127.0.0.1").searchParams.get("token")
    if (!token) return false

    const expected = Buffer.from(this.authToken)
    const actual = Buffer.from(token)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }
}

runtime.register(ServerService, (import.meta as any).hot)
