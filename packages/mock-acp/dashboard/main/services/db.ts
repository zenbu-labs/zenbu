import path from "node:path"
import os from "node:os"
import { Effect } from "effect"
import { createDb } from "@zenbu/kyju"
import { createRouter } from "@zenbu/kyju/transport"
import { dashboardSchema } from "../../shared/schema/index"
import { migrations } from "../../kyju/index"
import { HttpService } from "./http"

const DB_PATH = path.join(os.tmpdir(), "zenbu-mock-acp-dashboard-db")

export class DbService extends Effect.Service<DbService>()("DbService", {
  scoped: Effect.gen(function* () {
    const httpService = yield* HttpService
    const dbRouter = createRouter()

    const db = yield* Effect.promise(() =>
      createDb({
        schema: dashboardSchema,
        migrations,
        path: DB_PATH,
        send: (event) => dbRouter.send(event),
      }),
    )

    const wsDbConnections = new Map<
      string,
      { receive: (event: any) => Promise<void>; close: () => void }
    >()

    httpService.onConnected((id, ws) => {
      const dbConn = dbRouter.connection({
        send: (event) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ ch: "db", data: event }))
          }
        },
        postMessage: db.postMessage,
      })
      wsDbConnections.set(id, dbConn)

      ws.on("message", async (raw: Buffer) => {
        const msg = JSON.parse(String(raw))
        if (msg.ch === "db") {
          await dbConn.receive(msg.data)
        }
      })
    })

    httpService.onDisconnected((id) => {
      const conn = wsDbConnections.get(id)
      if (conn) {
        conn.close()
        wsDbConnections.delete(id)
      }
    })

    yield* Effect.addFinalizer(() => Effect.log("[db] shutting down"))


    return { db, client: db.effectClient } as const
  }),
}) {}
