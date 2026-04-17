import { describe, it, expect, vi } from "vitest";
import { Context, Data, Effect, Layer, ManagedRuntime } from "effect";
import { createServer } from "../src/server";
import { serialize, deserialize } from "../src/protocol";

class DivisionByZeroError extends Data.TaggedError("DivisionByZeroError")<{
  dividend: number;
}> {}

class NegativeInputError extends Data.TaggedError("NegativeInputError")<{
  value: number;
}> {}

const serverRouter = (getCtx: () => { clientId: string }) => ({
  greet: (name: string) => `Hello ${name} from ${getCtx().clientId}`,
  echo: (value: unknown) => value,
  users: {
    get: (id: string) => ({ id, name: "Alice" }),
    list: () => [{ id: "1", name: "Alice" }],
  },
  failing: () => {
    throw new Error("intentional error");
  },
  asyncMethod: async (x: number) => x * 2,
  effectDouble: (x: number) => Effect.succeed(x * 2),
  effectDivide: (a: number, b: number) =>
    b === 0
      ? Effect.fail(new DivisionByZeroError({ dividend: a }))
      : Effect.succeed(a / b),
  effectValidate: (x: number) =>
    x < 0
      ? Effect.fail(new NegativeInputError({ value: x }))
      : Effect.succeed(x),
  effectDefect: () => Effect.die("something broke"),
});

function createTestServer() {
  const sent = new Map<string, string[]>();
  const server = createServer({
    router: serverRouter,
    version: "1.0.0",
    send: (data, clientId) => {
      if (!sent.has(clientId)) sent.set(clientId, []);
      sent.get(clientId)!.push(data);
    },
  });
  const sentTo = (clientId: string) => sent.get(clientId) ?? [];
  return { server, sentTo };
}

function handshake(
  server: ReturnType<typeof createServer>,
  clientId: string,
  version = "1.0.0",
) {
  server.postMessage(
    serialize({ type: "handshake", clientId, version }),
    clientId,
  );
}

describe("createServer", () => {
  it("auto-registers client on handshake", () => {
    const { server, sentTo } = createTestServer();

    handshake(server, "c1");

    const msgs = sentTo("c1");
    expect(msgs).toHaveLength(1);
    expect(deserialize(msgs[0]!)).toEqual({ type: "handshake-ack", ok: true });
  });

  it("rejects version mismatch", () => {
    const { server, sentTo } = createTestServer();

    handshake(server, "c1", "2.0.0");

    const msgs = sentTo("c1");
    expect(deserialize(msgs[0]!)).toMatchObject({
      type: "handshake-ack",
      ok: false,
      error: "Version mismatch: expected 1.0.0, got 2.0.0",
    });
  });

  it("handles RPC requests after handshake", async () => {
    const { server, sentTo } = createTestServer();
    handshake(server, "c1");

    server.postMessage(
      serialize({ type: "request", id: "r1", path: ["greet"], args: ["World"] }),
      "c1",
    );

    await vi.waitFor(() => expect(sentTo("c1")).toHaveLength(2));

    const response = deserialize(sentTo("c1")[1]!);
    expect(response).toEqual({
      type: "response",
      id: "r1",
      result: "Hello World from c1",
    });
  });

  it("handles nested method calls", async () => {
    const { server, sentTo } = createTestServer();
    handshake(server, "c1");

    server.postMessage(
      serialize({ type: "request", id: "r2", path: ["users", "get"], args: ["42"] }),
      "c1",
    );

    await vi.waitFor(() => expect(sentTo("c1")).toHaveLength(2));

    const response = deserialize(sentTo("c1")[1]!);
    expect(response).toEqual({
      type: "response",
      id: "r2",
      result: { id: "42", name: "Alice" },
    });
  });

  it("returns error response when method throws", async () => {
    const { server, sentTo } = createTestServer();
    handshake(server, "c1");

    server.postMessage(
      serialize({ type: "request", id: "r3", path: ["failing"], args: [] }),
      "c1",
    );

    await vi.waitFor(() => expect(sentTo("c1")).toHaveLength(2));

    expect(deserialize(sentTo("c1")[1]!)).toEqual({
      type: "error-response",
      id: "r3",
      error: { message: "intentional error" },
    });
  });

  it("returns error for request before handshake", () => {
    const { server, sentTo } = createTestServer();

    server.postMessage(
      serialize({ type: "request", id: "r4", path: ["greet"], args: ["test"] }),
      "c1",
    );

    expect(sentTo("c1")).toHaveLength(1);
    expect(deserialize(sentTo("c1")[0]!)).toMatchObject({
      type: "error-response",
      id: "r4",
      error: { message: "Not connected" },
    });
  });

  it("returns error for unknown method path", async () => {
    const { server, sentTo } = createTestServer();
    handshake(server, "c1");

    server.postMessage(
      serialize({ type: "request", id: "r5", path: ["nonexistent"], args: [] }),
      "c1",
    );

    await vi.waitFor(() => expect(sentTo("c1")).toHaveLength(2));

    expect(deserialize(sentTo("c1")[1]!)).toMatchObject({
      type: "error-response",
      id: "r5",
      error: { message: "Method not found: nonexistent" },
    });
  });

  it("handles async router methods", async () => {
    const { server, sentTo } = createTestServer();
    handshake(server, "c1");

    server.postMessage(
      serialize({ type: "request", id: "r6", path: ["asyncMethod"], args: [21] }),
      "c1",
    );

    await vi.waitFor(() => expect(sentTo("c1")).toHaveLength(2));

    expect(deserialize(sentTo("c1")[1]!)).toEqual({
      type: "response",
      id: "r6",
      result: 42,
    });
  });

  it("removeClient cleans up", () => {
    const { server } = createTestServer();
    handshake(server, "c1");

    server.removeClient("c1");
    // no error on double remove
    server.removeClient("c1");
  });

  it("handles Effect success (wraps in { _tag: success, data })", async () => {
    const { server, sentTo } = createTestServer();
    handshake(server, "c1");

    server.postMessage(
      serialize({ type: "request", id: "e1", path: ["effectDouble"], args: [21] }),
      "c1",
    );

    await vi.waitFor(() => expect(sentTo("c1")).toHaveLength(2));

    expect(deserialize(sentTo("c1")[1]!)).toEqual({
      type: "response",
      id: "e1",
      result: { _tag: "success", data: 42 },
    });
  });

  it("handles Effect tagged error (resolves with serialized error)", async () => {
    const { server, sentTo } = createTestServer();
    handshake(server, "c1");

    server.postMessage(
      serialize({ type: "request", id: "e2", path: ["effectDivide"], args: [10, 0] }),
      "c1",
    );

    await vi.waitFor(() => expect(sentTo("c1")).toHaveLength(2));

    const response = deserialize(sentTo("c1")[1]!) as any;
    expect(response.type).toBe("response");
    expect(response.result._tag).toBe("DivisionByZeroError");
    expect(response.result.dividend).toBe(10);
  });

  it("handles Effect defect (sends error-response)", async () => {
    const { server, sentTo } = createTestServer();
    handshake(server, "c1");

    server.postMessage(
      serialize({ type: "request", id: "e3", path: ["effectDefect"], args: [] }),
      "c1",
    );

    await vi.waitFor(() => expect(sentTo("c1")).toHaveLength(2));

    expect(deserialize(sentTo("c1")[1]!)).toMatchObject({
      type: "error-response",
      id: "e3",
    });
  });

  it("supports multiple concurrent clients", async () => {
    const { server, sentTo } = createTestServer();
    handshake(server, "c1");
    handshake(server, "c2");

    server.postMessage(
      serialize({ type: "request", id: "r1", path: ["greet"], args: ["Alice"] }),
      "c1",
    );
    server.postMessage(
      serialize({ type: "request", id: "r2", path: ["greet"], args: ["Bob"] }),
      "c2",
    );

    await vi.waitFor(() => {
      expect(sentTo("c1").length).toBeGreaterThanOrEqual(2);
      expect(sentTo("c2").length).toBeGreaterThanOrEqual(2);
    });

    expect(deserialize(sentTo("c1")[1]!)).toEqual({
      type: "response",
      id: "r1",
      result: "Hello Alice from c1",
    });
    expect(deserialize(sentTo("c2")[1]!)).toEqual({
      type: "response",
      id: "r2",
      result: "Hello Bob from c2",
    });
  });
});

describe("createServer with runtime", () => {
  class CounterService extends Context.Tag("CounterService")<
    CounterService,
    { readonly count: () => number }
  >() {}

  class GreeterService extends Context.Tag("GreeterService")<
    GreeterService,
    { readonly greet: (name: string) => string }
  >() {}

  it("router method can yield* a service via runtime", async () => {
    let counter = 0;
    const runtime = ManagedRuntime.make(
      Layer.succeed(CounterService, { count: () => ++counter }),
    );

    const sent = new Map<string, string[]>();
    const server = createServer({
      router: () => ({
        getCount: () =>
          Effect.gen(function* () {
            const svc = yield* CounterService;
            return svc.count();
          }),
      }),
      version: "0",
      send: (data, clientId) => {
        if (!sent.has(clientId)) sent.set(clientId, []);
        sent.get(clientId)!.push(data);
      },
      runtime,
    });

    server.postMessage(
      serialize({ type: "handshake", clientId: "c1", version: "0" }),
      "c1",
    );

    server.postMessage(
      serialize({ type: "request", id: "r1", path: ["getCount"], args: [] }),
      "c1",
    );

    await vi.waitFor(() => expect(sent.get("c1")!.length).toBeGreaterThanOrEqual(2));

    const response = deserialize(sent.get("c1")![1]!);
    expect(response).toEqual({
      type: "response",
      id: "r1",
      result: { _tag: "success", data: 1 },
    });

    await runtime.dispose();
  });

  it("router method without runtime defects when yielding a service", async () => {
    const sent = new Map<string, string[]>();
    const server = createServer({
      router: () => ({
        getCount: () =>
          Effect.gen(function* () {
            const svc = yield* CounterService;
            return svc.count();
          }),
      }),
      version: "0",
      send: (data, clientId) => {
        if (!sent.has(clientId)) sent.set(clientId, []);
        sent.get(clientId)!.push(data);
      },
    });

    server.postMessage(
      serialize({ type: "handshake", clientId: "c1", version: "0" }),
      "c1",
    );

    server.postMessage(
      serialize({ type: "request", id: "r1", path: ["getCount"], args: [] }),
      "c1",
    );

    await vi.waitFor(() => expect(sent.get("c1")!.length).toBeGreaterThanOrEqual(2));

    const response = deserialize(sent.get("c1")![1]!);
    expect(response).toMatchObject({
      type: "error-response",
      id: "r1",
    });
  });

  it("multiple methods with different service deps all resolve", async () => {
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        Layer.succeed(CounterService, { count: () => 42 }),
        Layer.succeed(GreeterService, { greet: (name: string) => `Hi ${name}` }),
      ),
    );

    const sent = new Map<string, string[]>();
    const server = createServer({
      router: () => ({
        getCount: () =>
          Effect.gen(function* () {
            const svc = yield* CounterService;
            return svc.count();
          }),
        greetUser: (name: string) =>
          Effect.gen(function* () {
            const svc = yield* GreeterService;
            return svc.greet(name);
          }),
      }),
      version: "0",
      send: (data, clientId) => {
        if (!sent.has(clientId)) sent.set(clientId, []);
        sent.get(clientId)!.push(data);
      },
      runtime,
    });

    server.postMessage(
      serialize({ type: "handshake", clientId: "c1", version: "0" }),
      "c1",
    );

    server.postMessage(
      serialize({ type: "request", id: "r1", path: ["getCount"], args: [] }),
      "c1",
    );
    server.postMessage(
      serialize({ type: "request", id: "r2", path: ["greetUser"], args: ["Alice"] }),
      "c1",
    );

    await vi.waitFor(() => expect(sent.get("c1")!.length).toBeGreaterThanOrEqual(3));

    const responses = sent.get("c1")!.slice(1).map((s) => deserialize(s) as any);
    const r1 = responses.find((r: any) => r.id === "r1");
    const r2 = responses.find((r: any) => r.id === "r2");

    expect(r1).toEqual({
      type: "response",
      id: "r1",
      result: { _tag: "success", data: 42 },
    });
    expect(r2).toEqual({
      type: "response",
      id: "r2",
      result: { _tag: "success", data: "Hi Alice" },
    });

    await runtime.dispose();
  });
});
