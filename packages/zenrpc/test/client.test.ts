import { describe, it, expect, vi } from "vitest";
import { Data, Effect } from "effect";
import { createClient } from "../src/client";
import { serialize, deserialize } from "../src/protocol";
import { createTransportPair } from "./helpers";

class DivisionByZeroError extends Data.TaggedError("DivisionByZeroError")<{
  dividend: number;
}> {}

class NegativeInputError extends Data.TaggedError("NegativeInputError")<{
  value: number;
}> {}

describe("createClient", () => {
  it("sends handshake on creation", () => {
    const sent: string[] = [];

    createClient({
      version: "1.0.0",
      clientId: "c1",
      send: (data) => sent.push(data),
    });

    expect(sent).toHaveLength(1);
    const msg = deserialize(sent[0]!);
    expect(msg).toEqual({
      type: "handshake",
      clientId: "c1",
      version: "1.0.0",
    });
  });

  it("resolves ready on successful handshake", async () => {
    const client = createClient({
      version: "1.0.0",
      clientId: "c1",
      send: () => {},
    });

    expect(client.connected).toBe(false);

    client.postMessage(serialize({ type: "handshake-ack", ok: true }));

    await client.ready;
    expect(client.connected).toBe(true);
  });

  it("rejects ready on failed handshake", async () => {
    const client = createClient({
      version: "1.0.0",
      clientId: "c1",
      send: () => {},
    });

    client.postMessage(
      serialize({
        type: "handshake-ack",
        ok: false,
        error: "Version mismatch",
      }),
    );

    await expect(client.ready).rejects.toThrow("Version mismatch");
  });
});

describe("end-to-end with transport pair", () => {
  const serverRouter = (getCtx: () => { clientId: string }) => ({
    greet: (name: string) => `Hello ${name} from ${getCtx().clientId}`,
    add: (a: number, b: number) => a + b,
    users: {
      get: (id: string) => ({ id, name: "Alice" }),
    },
    asyncDouble: async (x: number) => x * 2,
    fail: () => {
      throw new Error("server fail");
    },
    effectDouble: (x: number) => Effect.succeed(x * 2),
    effectDivide: (a: number, b: number) =>
      b === 0
        ? Effect.fail(new DivisionByZeroError({ dividend: a }))
        : Effect.succeed(a / b),
    effectMultiError: (x: number) => {
      if (x === 0)
        return Effect.fail(new DivisionByZeroError({ dividend: x }));
      if (x < 0) return Effect.fail(new NegativeInputError({ value: x }));
      return Effect.succeed(x * 10);
    },
    effectDefect: () => Effect.die("kaboom"),
  });

  type ServerRouter = ReturnType<typeof serverRouter>;

  it("client can call server methods", async () => {
    const { client } = createTransportPair<ServerRouter>({
      serverRouter,
      version: "1.0.0",
      clientId: "c1",
    });

    await client.ready;

    const greeting = await client.server.greet("World");
    expect(greeting).toBe("Hello World from c1");
  });

  it("client can call nested server methods", async () => {
    const { client } = createTransportPair<ServerRouter>({
      serverRouter,
      version: "1.0.0",
      clientId: "c1",
    });

    await client.ready;

    const user = await client.server.users.get("42");
    expect(user).toEqual({ id: "42", name: "Alice" });
  });

  it("client can call server methods with multiple args", async () => {
    const { client } = createTransportPair<ServerRouter>({
      serverRouter,
      version: "1.0.0",
      clientId: "c1",
    });

    await client.ready;

    const sum = await client.server.add(3, 4);
    expect(sum).toBe(7);
  });

  it("client can call async server methods", async () => {
    const { client } = createTransportPair<ServerRouter>({
      serverRouter,
      version: "1.0.0",
      clientId: "c1",
    });

    await client.ready;

    const result = await client.server.asyncDouble(21);
    expect(result).toBe(42);
  });

  it("propagates server errors to client", async () => {
    const { client } = createTransportPair<ServerRouter>({
      serverRouter,
      version: "1.0.0",
      clientId: "c1",
    });

    await client.ready;

    await expect(client.server.fail()).rejects.toThrow("server fail");
  });

  it("Effect method success returns { _tag: success, data }", async () => {
    const { client } = createTransportPair<ServerRouter>({
      serverRouter,
      version: "1.0.0",
      clientId: "c1",
    });

    await client.ready;

    const result = await client.server.effectDouble(21);
    expect(result).toEqual({ _tag: "success", data: 42 });
  });

  it("Effect method error returns serialized tagged error", async () => {
    const { client } = createTransportPair<ServerRouter>({
      serverRouter,
      version: "1.0.0",
      clientId: "c1",
    });

    await client.ready;

    const result = await client.server.effectDivide(10, 0);
    expect(result).toMatchObject({
      _tag: "DivisionByZeroError",
      dividend: 10,
    });
  });

  it("Effect method success path when errors are possible", async () => {
    const { client } = createTransportPair<ServerRouter>({
      serverRouter,
      version: "1.0.0",
      clientId: "c1",
    });

    await client.ready;

    const result = await client.server.effectDivide(10, 2);
    expect(result).toEqual({ _tag: "success", data: 5 });
  });

  it("Effect method with multiple error types", async () => {
    const { client } = createTransportPair<ServerRouter>({
      serverRouter,
      version: "1.0.0",
      clientId: "c1",
    });

    await client.ready;

    const success = await client.server.effectMultiError(5);
    expect(success).toEqual({ _tag: "success", data: 50 });

    const divError = await client.server.effectMultiError(0);
    expect(divError).toMatchObject({
      _tag: "DivisionByZeroError",
      dividend: 0,
    });

    const negError = await client.server.effectMultiError(-3);
    expect(negError).toMatchObject({
      _tag: "NegativeInputError",
      value: -3,
    });
  });

  it("Effect defect rejects the promise", async () => {
    const { client } = createTransportPair<ServerRouter>({
      serverRouter,
      version: "1.0.0",
      clientId: "c1",
    });

    await client.ready;

    await expect(client.server.effectDefect()).rejects.toThrow();
  });

  it("discriminated union works with switch on _tag", async () => {
    const { client } = createTransportPair<ServerRouter>({
      serverRouter,
      version: "1.0.0",
      clientId: "c1",
    });

    await client.ready;

    const result = await client.server.effectDivide(10, 0);

    switch (result._tag) {
      case "success":
        throw new Error("should not succeed");
      case "DivisionByZeroError":
        expect(result.dividend).toBe(10);
        break;
    }
  });

  it("rejects handshake on version mismatch", async () => {
    let clientPM: ((data: string) => void) | null = null;

    const server = (await import("../src/server")).createServer({
      router: serverRouter,
      version: "1.0.0",
      send: (data, _clientId) => {
        queueMicrotask(() => clientPM?.(data));
      },
    });

    const client = createClient<ServerRouter>({
      version: "2.0.0",
      clientId: "c1",
      send: (data) => queueMicrotask(() => server.postMessage(data, "c1")),
    });

    clientPM = client.postMessage;

    await expect(client.ready).rejects.toThrow("Version mismatch");
  });
});
