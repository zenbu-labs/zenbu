import type { AnyRouter, AnyRouterFactory, RpcContext, ExtractRequirements } from "./types";
import { serialize, deserialize } from "./protocol";
import { resolveMethod, executeMethod } from "./execute";

type ClientEntry = {
  clientId: string;
  workspaceId?: string;
};

type CreateServerOptions<R = never> = {
  router: AnyRouterFactory;
  version: string;
  send: (data: string, clientId: string) => void;
  runtime?: { runPromiseExit: (effect: any) => Promise<any> };
};

const createEmitProxy = (
  send: (path: string[], data: unknown) => void,
  currentPath: string[] = [],
): any =>
  new Proxy(() => {}, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      return createEmitProxy(send, [...currentPath, prop as string]);
    },
    apply(_target, _thisArg, args) {
      send(currentPath, args[0]);
    },
  });

export const createServer = <
  TEvents extends Record<string, any> = Record<string, never>,
>(
  options: CreateServerOptions,
) => {
  const clients = new Map<string, ClientEntry>();

  const sendTo = (clientId: string) => (data: string) =>
    options.send(data, clientId);

  const postMessage = (data: string, clientId: string) => {
    const msg = deserialize(data);

    switch (msg.type) {
      case "handshake": {
        if (msg.version !== options.version) {
          options.send(
            serialize({
              type: "handshake-ack",
              ok: false,
              error: `Version mismatch: expected ${options.version}, got ${msg.version}`,
            }),
            clientId,
          );
          return;
        }

        const meta = clientMeta.get(clientId);
        clientMeta.delete(clientId);
        clients.set(clientId, { clientId, workspaceId: meta?.workspaceId });

        options.send(serialize({ type: "handshake-ack", ok: true }), clientId);
        break;
      }

      case "request": {
        const entry = clients.get(clientId);
        if (!entry) {
          options.send(
            serialize({
              type: "error-response",
              id: msg.id,
              error: { message: "Not connected" },
            }),
            clientId,
          );
          return;
        }

        try {
          const ctx: RpcContext = { clientId };
          const routerInstance = options.router(() => ctx);
          const wsId = entry.workspaceId;
          let method: Function;
          if (wsId && msg.path.length >= 1) {
            const scopedPath = [`${msg.path[0]}@@${wsId}`, ...msg.path.slice(1)];
            try {
              method = resolveMethod(routerInstance, scopedPath);
            } catch {
              method = resolveMethod(routerInstance, msg.path);
            }
          } else {
            method = resolveMethod(routerInstance, msg.path);
          }
          void executeMethod({
            method,
            methodArgs: msg.args,
            id: msg.id,
            send: sendTo(clientId),
            runtime: options.runtime,
          });
        } catch (err) {
          console.error(`[zenrpc] request handler failed for ${msg.path?.join(".")}:`, err);
          options.send(
            serialize({
              type: "error-response",
              id: msg.id,
              error: {
                message: err instanceof Error ? err.message : String(err),
              },
            }),
            clientId,
          );
        }
        break;
      }
    }
  };

  const removeClient = (clientId: string) => {
    clients.delete(clientId);
  };

  const setClientMeta = (clientId: string, meta: { workspaceId?: string }) => {
    const entry = clients.get(clientId);
    if (entry) {
      entry.workspaceId = meta.workspaceId;
    } else {
      clientMeta.set(clientId, meta);
    }
  };
  const clientMeta = new Map<string, { workspaceId?: string }>();

  type EmitProxy<T> = {
    [K in keyof T]: T[K] extends Record<string, any>
      ? EmitProxy<T[K]> & ((data: T[K]) => void)
      : (data: T[K]) => void;
  };

  const emit: EmitProxy<TEvents> = createEmitProxy(
    (path: string[], data: unknown) => {
      const msg = serialize({ type: "event", path, data });
      for (const [clientId] of clients) {
        options.send(msg, clientId);
      }
    },
  );

  const emitTo = (clientId: string): EmitProxy<TEvents> =>
    createEmitProxy((path: string[], data: unknown) => {
      if (!clients.has(clientId)) return;
      options.send(serialize({ type: "event", path, data }), clientId);
    });

  return { postMessage, removeClient, setClientMeta, emit, emitTo };
};
