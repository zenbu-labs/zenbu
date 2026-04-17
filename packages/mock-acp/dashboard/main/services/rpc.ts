import { Effect, ManagedRuntime, Layer } from "effect"
import { createServer, createRpcRouter } from "@zenbu/zenrpc"
import { DbService } from "./db"
import { MockAgentConnectionService } from "./mock-agent-connection"
import { HttpService } from "./http"
import { router } from "../router"

export class RpcService extends Effect.Service<RpcService>()("RpcService", {
  scoped: Effect.gen(function* () {
    const dbService = yield* DbService
    const mockAgentConn = yield* MockAgentConnectionService
    const httpService = yield* HttpService

    const rpcRouter = createRpcRouter()

    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        Layer.succeed(DbService, dbService),
        Layer.succeed(MockAgentConnectionService, mockAgentConn),
      ),
    )

    yield* Effect.addFinalizer(() =>
      Effect.promise(() => runtime.dispose()),
    )

    const rpcServer = createServer({
      router: () => router,
      version: "0",
      send: rpcRouter.send,
      runtime,
    })

    const wsRpcConnections = new Map<
      string,
      { receive: (data: string) => void; close: () => void }
    >()

    httpService.onConnected((id, ws) => {
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

      ws.on("message", (raw: Buffer) => {
        const msg = JSON.parse(String(raw))
        if (msg.ch === "rpc") {
          rpcConn.receive(msg.data)
        }
      })
    })

    httpService.onDisconnected((id) => {
      const conn = wsRpcConnections.get(id)
      if (conn) {
        conn.close()
        wsRpcConnections.delete(id)
      }
    })

    yield* Effect.addFinalizer(() => Effect.log("[rpc] shutting down"))

    console.log("[rpc] server ready")

    return { rpcServer, rpcRouter } as const
  }),
}) {}
