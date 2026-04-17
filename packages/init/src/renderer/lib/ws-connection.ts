import { useEffect, useRef, useState } from "react";
import { connectReplica, dbStringify, dbParse } from "@zenbu/kyju/transport";
import type { ClientProxy, SchemaShape } from "@zenbu/kyju";
import { connectRpc } from "@zenbu/zenrpc";
import type { ServiceRouter } from "#registry/services";
import type { EventProxy } from "@zenbu/zenrpc";
import type { createReplica } from "@zenbu/kyju";
import type { RpcType } from "./providers";
import type { ZenbuEvents } from "../../../shared/events";

export {
  RpcProvider,
  useRpc,
  EventsProvider,
  useEvents,
  KyjuClientProvider,
  useKyjuClient,
} from "./providers";

export type ZenbuEventProxy = EventProxy<ZenbuEvents>;

type Replica = ReturnType<typeof createReplica>;

export type WsConnectionState =
  | { status: "connecting" }
  | {
      status: "connected";
      rpc: RpcType;
      events: ZenbuEventProxy;
      kyjuClient: ClientProxy<SchemaShape>;
      replica: Replica;
    }
  | { status: "error"; error: string };

export function useWsConnection(): WsConnectionState {
  const [state, setState] = useState<WsConnectionState>({
    status: "connecting",
  });
  const cleanupRef = useRef<(() => void) | null>(null);
  const retriesRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const wsPort = new URLSearchParams(window.location.search).get("wsPort");

    if (!wsPort) {
      setState({ status: "error", error: "Missing ?wsPort= in URL" });
      return;
    }

    const wsUrl = `ws://127.0.0.1:${wsPort}`;

    function connect() {
      if (cancelled) return;

      setState({ status: "connecting" });
      cleanupRef.current = null;

      const t0 = performance.now();
      console.log(
        `[ws-conn] connecting to ${wsUrl} (attempt ${retriesRef.current + 1})`,
      );

      const ws = new WebSocket(wsUrl);

      ws.onopen = async () => {
        try {
          retriesRef.current = 0;

          const { server: rpc, events, disconnect: disconnectRpc } =
            await connectRpc<ServiceRouter, ZenbuEvents>({
              version: "0",
              send: (data) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ ch: "rpc", data }));
                }
              },
              subscribe: (cb) => {
                const handler = (e: MessageEvent) => {
                  const msg = JSON.parse(e.data);
                  if (msg.ch === "rpc") cb(msg.data);
                };
                ws.addEventListener("message", handler);
                return () => ws.removeEventListener("message", handler);
              },
            });
          

          const {
            client: kyjuClient,
            replica,
            disconnect: disconnectDb,
          } = await connectReplica<SchemaShape>({
            send: (event) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(dbStringify({ ch: "db", data: event }));
              }
            },
            subscribe: (cb) => {
              const handler = (e: MessageEvent) => {
                const msg = dbParse(e.data);
                if (msg.ch === "db") cb(msg.data);
              };
              ws.addEventListener("message", handler);
              return () => ws.removeEventListener("message", handler);
            },
          });
          

          if (cancelled) {
            await disconnectDb();
            disconnectRpc();
            ws.close();
            return;
          }

          const viewMatch = window.location.pathname.match(/^\/views\/([^/]+)\//)
          const viewScope = viewMatch ? viewMatch[1] : null
          let unsubReload: (() => void) | null = null
          if (viewScope) {
            unsubReload = (events as ZenbuEventProxy).advice.reload.subscribe((data: any) => {
              if (data?.scope === viewScope) location.reload()
            })
          }

          cleanupRef.current = () => {
            unsubReload?.();
            disconnectDb();
            disconnectRpc();
            ws.close();
          };

          setState({ status: "connected", rpc: rpc as RpcType, events: events as ZenbuEventProxy, kyjuClient, replica });
        } catch (err) {
          if (!cancelled) {
            ws.close();
            scheduleReconnect();
          }
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        if (!cancelled) {
          cleanupRef.current?.();
          cleanupRef.current = null;
          scheduleReconnect();
        }
      };
    }

    function scheduleReconnect() {
      if (cancelled) return;
      const delay = Math.min(300 * Math.pow(2, retriesRef.current), 3000);
      retriesRef.current++;
      console.log(`[ws-conn] reconnecting in ${delay}ms`);
      setState({ status: "connecting" });
      reconnectTimer = setTimeout(connect, delay);
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return state;
}
