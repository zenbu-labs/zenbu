import type { WebSocket } from "ws";
import { createServer, createRpcRouter } from "@zenbu/zenrpc";
import type { AnyRouter, EventProxy } from "@zenbu/zenrpc";
import { Service, runtime } from "../runtime";
import { HttpService } from "./http";
import type { ZenbuEvents } from "../../../shared/events";
/**
 * not great come back to this
 */

type EmitProxy<T> = {
  [K in keyof T]: T[K] extends Record<string, any>
    ? EmitProxy<T[K]> & ((data: T[K]) => void)
    : (data: T[K]) => void;
};

export class RpcService extends Service {
  static key = "rpc";
  static deps = { http: HttpService };
  declare ctx: { http: HttpService };

  private _emit: EmitProxy<ZenbuEvents> | null = null;

  get emit(): EmitProxy<ZenbuEvents> {
    if (!this._emit) throw new Error("RpcService not yet evaluated");
    return this._emit;
  }

  evaluate() {
    const { http } = this.ctx;

    this.setup("rpc-wiring", () => {
      const rpcRouter = createRpcRouter();

      const rpcServer = createServer<ZenbuEvents>({
        router: () => runtime.buildRouter() as AnyRouter,
        version: "0",
        send: rpcRouter.send,
      });

      this._emit = rpcServer.emit;

      const wsRpcConnections = new Map<
        string,
        {
          rpcConn: { receive: (data: string) => void; close: () => void };
          ws: WebSocket;
        }
      >();

      const onConnected = (id: string, ws: WebSocket, meta: { workspaceId?: string }) => {
        const rpcConn = rpcRouter.connection({
          send: (data: string) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ ch: "rpc", data }));
            }
          },
          postMessage: rpcServer.postMessage,
          removeClient: rpcServer.removeClient,
        });
        if (meta.workspaceId) {
          rpcServer.setClientMeta(rpcConn.clientId, { workspaceId: meta.workspaceId });
        }
        wsRpcConnections.set(id, { rpcConn, ws });

        ws.on("message", (raw: Buffer) => {
          const msg = JSON.parse(String(raw));
          if (msg.ch === "rpc") {
            rpcConn.receive(msg.data);
          }
        });
      };

      const onDisconnected = (id: string) => {
        const entry = wsRpcConnections.get(id);
        if (entry) {
          entry.rpcConn.close();
          wsRpcConnections.delete(id);
        }
      };

      const unsubConnected = http.onConnected(onConnected);
      const unsubDisconnected = http.onDisconnected(onDisconnected);

      return () => {
        this._emit = null;
        unsubConnected();
        unsubDisconnected();
        for (const { rpcConn, ws } of wsRpcConnections.values()) {
          rpcConn.close();
          ws.close();
        }
        wsRpcConnections.clear();
      };
    });

    console.log("[rpc] service ready");
  }
}

runtime.register(RpcService, (import.meta as any).hot);
