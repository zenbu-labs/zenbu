import { describe, it, expect, vi } from "vitest";
import { createProxy } from "../src/proxy";
import { createPendingRequests } from "../src/pending";
import { deserialize } from "../src/protocol";

describe("createProxy", () => {
  it("sends a request with the correct path for a flat method", async () => {
    const sent: string[] = [];
    const pending = createPendingRequests();

    type Router = { greet: (name: string) => string };
    const proxy = createProxy<Router>({
      send: (data) => {
        sent.push(data);
        const msg = deserialize(data);
        if (msg.type === "request") {
          pending.resolve(msg.id, "hello");
        }
      },
      pending,
    });

    const result = await proxy.greet("world");

    expect(result).toBe("hello");
    expect(sent).toHaveLength(1);

    const msg = deserialize(sent[0]!);
    expect(msg).toMatchObject({
      type: "request",
      path: ["greet"],
      args: ["world"],
    });
  });

  it("sends a request with the correct path for nested methods", async () => {
    const sent: string[] = [];
    const pending = createPendingRequests();

    type Router = { users: { get: (id: string) => { id: string } } };
    const proxy = createProxy<Router>({
      send: (data) => {
        sent.push(data);
        const msg = deserialize(data);
        if (msg.type === "request") {
          pending.resolve(msg.id, { id: "123" });
        }
      },
      pending,
    });

    const result = await proxy.users.get("123");

    expect(result).toEqual({ id: "123" });
    const msg = deserialize(sent[0]!);
    expect(msg).toMatchObject({
      type: "request",
      path: ["users", "get"],
      args: ["123"],
    });
  });

  it("sends a request with the correct path for deeply nested methods", async () => {
    const sent: string[] = [];
    const pending = createPendingRequests();

    type Router = { a: { b: { c: { method: (x: number) => boolean } } } };
    const proxy = createProxy<Router>({
      send: (data) => {
        sent.push(data);
        const msg = deserialize(data);
        if (msg.type === "request") {
          pending.resolve(msg.id, true);
        }
      },
      pending,
    });

    const result = await proxy.a.b.c.method(42);

    expect(result).toBe(true);
    const msg = deserialize(sent[0]!);
    expect(msg).toMatchObject({
      type: "request",
      path: ["a", "b", "c", "method"],
      args: [42],
    });
  });

  it("supports multiple arguments", async () => {
    const sent: string[] = [];
    const pending = createPendingRequests();

    type Router = { add: (a: number, b: number) => number };
    const proxy = createProxy<Router>({
      send: (data) => {
        sent.push(data);
        const msg = deserialize(data);
        if (msg.type === "request") {
          pending.resolve(msg.id, 5);
        }
      },
      pending,
    });

    const result = await proxy.add(2, 3);

    expect(result).toBe(5);
    const msg = deserialize(sent[0]!);
    expect(msg).toMatchObject({
      type: "request",
      path: ["add"],
      args: [2, 3],
    });
  });

  it("generates unique request ids", async () => {
    const ids: string[] = [];
    const pending = createPendingRequests();

    type Router = { method: () => void };
    const proxy = createProxy<Router>({
      send: (data) => {
        const msg = deserialize(data);
        if (msg.type === "request") {
          ids.push(msg.id);
          pending.resolve(msg.id, undefined);
        }
      },
      pending,
    });

    await proxy.method();
    await proxy.method();
    await proxy.method();

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });
});
