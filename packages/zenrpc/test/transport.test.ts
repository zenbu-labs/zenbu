import { describe, it, expect } from "vitest";
import { createServer } from "../src/server";
import { createRpcRouter, connectRpc } from "../src/transport";

const echoRouter = (_getCtx: () => { clientId: string }) => ({
  echo: (msg: string) => `echo: ${msg}`,
  add: (a: number, b: number) => a + b,
});

type ServerRouter = ReturnType<typeof echoRouter>;

function setupInMemory() {
  const rpcRouter = createRpcRouter();

  const server = createServer({
    router: echoRouter,
    version: "0",
    send: rpcRouter.send,
  });

  return { rpcRouter, server };
}

describe("createRpcRouter", () => {
  it("routes data to the correct connection by clientId", async () => {
    const { rpcRouter, server } = setupInMemory();

    let connSend!: (data: string) => void;
    const conn = rpcRouter.connection({
      send: (data) => connSend?.(data),
      postMessage: server.postMessage,
      removeClient: server.removeClient,
    });

    const { server: rpc, disconnect } = await connectRpc<ServerRouter>({
      version: "0",
      clientId: conn.clientId,
      send: (data) => conn.receive(data),
      subscribe: (cb) => { connSend = cb; return () => {}; },
    });

    expect(await rpc.echo("hello")).toBe("echo: hello");
    expect(await rpc.add(2, 3)).toBe(5);

    disconnect();
    conn.close();
  });

  it("handles multiple connections independently", async () => {
    const { rpcRouter, server } = setupInMemory();

    let conn1Send!: (data: string) => void;
    let conn2Send!: (data: string) => void;

    const conn1 = rpcRouter.connection({
      send: (data) => conn1Send?.(data),
      postMessage: server.postMessage,
      removeClient: server.removeClient,
    });

    const conn2 = rpcRouter.connection({
      send: (data) => conn2Send?.(data),
      postMessage: server.postMessage,
      removeClient: server.removeClient,
    });

    expect(conn1.clientId).not.toBe(conn2.clientId);

    const { server: rpc1, disconnect: d1 } = await connectRpc<ServerRouter>({
      version: "0",
      clientId: conn1.clientId,
      send: (data) => conn1.receive(data),
      subscribe: (cb) => { conn1Send = cb; return () => {}; },
    });

    const { server: rpc2, disconnect: d2 } = await connectRpc<ServerRouter>({
      version: "0",
      clientId: conn2.clientId,
      send: (data) => conn2.receive(data),
      subscribe: (cb) => { conn2Send = cb; return () => {}; },
    });

    const [r1, r2] = await Promise.all([rpc1.echo("one"), rpc2.echo("two")]);
    expect(r1).toBe("echo: one");
    expect(r2).toBe("echo: two");

    d1();
    d2();
    conn1.close();
    conn2.close();
  });

  it("close removes route and calls removeClient", () => {
    const { rpcRouter, server } = setupInMemory();

    let removedClientId: string | null = null;
    const conn = rpcRouter.connection({
      send: () => {},
      postMessage: server.postMessage,
      removeClient: (clientId) => {
        removedClientId = clientId;
        server.removeClient(clientId);
      },
    });

    expect(removedClientId).toBeNull();
    conn.close();
    expect(removedClientId).toBe(conn.clientId);
  });
});

describe("connectRpc", () => {
  it("returns a typed server proxy after handshake", async () => {
    const { rpcRouter, server } = setupInMemory();

    let connSend!: (data: string) => void;
    const conn = rpcRouter.connection({
      send: (data) => connSend?.(data),
      postMessage: server.postMessage,
      removeClient: server.removeClient,
    });

    const { server: rpc, disconnect } = await connectRpc<ServerRouter>({
      version: "0",
      clientId: conn.clientId,
      send: (data) => conn.receive(data),
      subscribe: (cb) => { connSend = cb; return () => {}; },
    });

    expect(await rpc.echo("test")).toBe("echo: test");
    expect(await rpc.add(10, 20)).toBe(30);

    disconnect();
    conn.close();
  });

  it("disconnect calls unsubscribe", async () => {
    const { rpcRouter, server } = setupInMemory();

    let unsubscribed = false;
    let connSend!: (data: string) => void;
    const conn = rpcRouter.connection({
      send: (data) => connSend?.(data),
      postMessage: server.postMessage,
      removeClient: server.removeClient,
    });

    const { disconnect } = await connectRpc<ServerRouter>({
      version: "0",
      clientId: conn.clientId,
      send: (data) => conn.receive(data),
      subscribe: (cb) => { connSend = cb; return () => { unsubscribed = true; }; },
    });

    expect(unsubscribed).toBe(false);
    disconnect();
    expect(unsubscribed).toBe(true);

    conn.close();
  });
});
