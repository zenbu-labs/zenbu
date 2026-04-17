import http from "node:http"
import { WebSocketServer } from "ws"
import { Service, runtime } from "../runtime"

type UpgradeHandler = (req: http.IncomingMessage, socket: import("stream").Duplex, head: Buffer) => boolean

export class ServerService extends Service {
  static key = "server"
  static deps = {}

  server: http.Server | null = null
  wss: WebSocketServer | null = null
  port = 0
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

    this.effect("server-cleanup", () => {
      return () => {
        this.wss?.close()
        this.server?.close()
        this.server?.closeAllConnections()
        this.server = null
        this.wss = null
      }
    })
  }
}

runtime.register(ServerService, (import.meta as any).hot)
