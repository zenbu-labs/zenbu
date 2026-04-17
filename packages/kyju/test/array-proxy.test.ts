import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { nanoid } from "nanoid";
import zod from "zod";
import { createDb } from "../src/v2/db/db";
import { createReplica } from "../src/v2/replica/replica";
import { createClient } from "../src/v2/client/client";
import { createSchema, f, makeCollection, type InferSchema } from "../src/v2/db/schema";
import { VERSION } from "../src/v2/shared";

function tmpDbPath() {
  return path.join(os.tmpdir(), `kyju-array-proxy-test-${nanoid()}`);
}

const arraySchema = createSchema({
  agents: f
    .array(
      zod.object({
        id: zod.string(),
        name: zod.string(),
        status: zod.string(),
        eventLog: f.collection(zod.object({ text: zod.string(), ts: zod.number() })),
      }),
    )
    .default([
      { id: "a1", name: "Agent 1", status: "idle", eventLog: makeCollection("eventLog-a1") },
      { id: "a2", name: "Agent 2", status: "idle", eventLog: makeCollection("eventLog-a2") },
      { id: "a3", name: "Agent 3", status: "streaming", eventLog: makeCollection("eventLog-a3") },
    ]),
  tags: f.array(zod.string()).default(["alpha", "beta", "gamma"]),
  nested: f
    .array(zod.array(zod.number()))
    .default([[1, 2], [3, 4]]),
  empty: f.array(zod.string()).default([]),
});

type ArraySchema = InferSchema<typeof arraySchema>;

async function setup() {
  const dbPath = tmpDbPath();
  let db!: Awaited<ReturnType<typeof createDb>>;

  const replica = createReplica({
    send: (event) => db.postMessage(event),
    maxPageSizeBytes: 1024 * 1024,
  });

  db = await createDb({
    path: dbPath,
    schema: arraySchema,
    migrations: [],
    send: (event) => replica.postMessage(event),
  });

  await replica.postMessage({ kind: "connect", version: VERSION });

  const client = createClient<ArraySchema>(replica);

  return {
    db,
    replica,
    client,
    dbPath,
    cleanup: () => fs.rmSync(dbPath, { recursive: true, force: true }),
  };
}

let cleanup: () => void;
afterEach(() => cleanup?.());

describe("array field proxy", () => {
  describe("element-returning methods (return field node proxies)", () => {
    it("find returns a proxy node that supports chaining collection ops", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const node = ctx.client.agents.find((a) => a.id === "a1");
      expect(node).toBeDefined();
      await node!.eventLog.concat([{ text: "hello", ts: 1 }]);

      const root = ctx.client.readRoot();
      const collectionId = root.agents[0].eventLog.collectionId;
      const collectionDir = path.join(ctx.dbPath, "collections", collectionId, "pages");
      expect(fs.existsSync(collectionDir)).toBe(true);
    });

    it("find returns undefined when no match", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const node = ctx.client.agents.find((a) => a.id === "nonexistent");
      expect(node).toBeUndefined();
    });

    it("find selects the correct element by predicate", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const node = ctx.client.agents.find((a) => a.name === "Agent 2");
      expect(node).toBeDefined();
      expect(node!.read().id).toBe("a2");
    });

    it("at(0) returns proxy for first element", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const node = ctx.client.agents.at(0);
      expect(node).toBeDefined();
      expect(node!.read().id).toBe("a1");
    });

    it("at(-1) returns proxy for last element", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const node = ctx.client.agents.at(-1);
      expect(node).toBeDefined();
      expect(node!.read().id).toBe("a3");
    });

    it("at out of bounds returns undefined", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      expect(ctx.client.agents.at(100)).toBeUndefined();
      expect(ctx.client.agents.at(-100)).toBeUndefined();
    });
  });

  describe("read-only methods (return plain values)", () => {
    it("map returns a plain JS array", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const names = ctx.client.agents.map((a) => a.name);
      expect(names).toEqual(["Agent 1", "Agent 2", "Agent 3"]);
      expect(Array.isArray(names)).toBe(true);
    });

    it("filter returns a plain JS array", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const streaming = ctx.client.agents.filter((a) => a.status === "streaming");
      expect(streaming).toHaveLength(1);
      expect(streaming[0].name).toBe("Agent 3");
    });

    it("some returns boolean", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      expect(ctx.client.agents.some((a) => a.id === "a2")).toBe(true);
      expect(ctx.client.agents.some((a) => a.id === "z9")).toBe(false);
    });

    it("every returns boolean", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      expect(ctx.client.agents.every((a) => a.status === "idle")).toBe(false);
      expect(ctx.client.tags.every((t) => typeof t === "string")).toBe(true);
    });

    it("indexOf and includes work on primitive arrays", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      expect(ctx.client.tags.indexOf("beta")).toBe(1);
      expect(ctx.client.tags.includes("gamma")).toBe(true);
      expect(ctx.client.tags.includes("delta")).toBe(false);
    });

    it("reduce returns accumulated value", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const joined = ctx.client.tags.reduce((acc, t) => acc + t, "");
      expect(joined).toBe("alphabetagamma");
    });

    it("forEach calls callback for each element", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const collected: string[] = [];
      ctx.client.tags.forEach((t) => collected.push(t));
      expect(collected).toEqual(["alpha", "beta", "gamma"]);
    });

    it("findIndex returns the correct index", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      expect(ctx.client.agents.findIndex((a) => a.id === "a2")).toBe(1);
      expect(ctx.client.agents.findIndex((a) => a.id === "nope")).toBe(-1);
    });

    it("slice returns a plain subarray", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const first = ctx.client.tags.slice(0, 1);
      expect(first).toEqual(["alpha"]);
    });
  });

  describe("kyju methods on array nodes", () => {
    it("read() returns the plain array snapshot", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const arr = ctx.client.agents.read();
      expect(Array.isArray(arr)).toBe(true);
      expect(arr).toHaveLength(3);
      expect(arr[0].id).toBe("a1");
    });

    it("set() replaces the array and persists", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      await ctx.client.tags.set(["x", "y"]);
      expect(ctx.client.tags.read()).toEqual(["x", "y"]);
    });

    it("subscribe() fires on array changes", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const values: string[][] = [];
      const unsub = ctx.client.tags.subscribe((v) => values.push(v));

      await ctx.client.tags.set(["changed"]);
      await new Promise((r) => setTimeout(r, 20));

      unsub();
      expect(values.length).toBeGreaterThan(0);
      expect(values[values.length - 1]).toEqual(["changed"]);
    });
  });

  describe("iteration", () => {
    it("for...of iterates plain values", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const collected: string[] = [];
      for (const tag of ctx.client.tags) {
        collected.push(tag);
      }
      expect(collected).toEqual(["alpha", "beta", "gamma"]);
    });

    it("spread produces a plain array", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const arr = [...ctx.client.tags];
      expect(arr).toEqual(["alpha", "beta", "gamma"]);
    });

    it("length returns correct count", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      expect(ctx.client.agents.length).toBe(3);
      expect(ctx.client.tags.length).toBe(3);
      expect(ctx.client.empty.length).toBe(0);
    });
  });

  describe("numeric index access", () => {
    it("[0] returns a field node proxy (not plain value)", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const first = ctx.client.agents[0];
      expect(first.read().id).toBe("a1");
    });

    it("[i].eventLog.concat() works (deep collection access)", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      await ctx.client.agents[1].eventLog.concat([{ text: "deep", ts: 99 }]);

      const root = ctx.client.readRoot();
      const collectionId = root.agents[1].eventLog.collectionId;
      const collectionDir = path.join(ctx.dbPath, "collections", collectionId, "pages");
      expect(fs.existsSync(collectionDir)).toBe(true);
    });

    it("[i].read() returns the plain element", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const elem = ctx.client.agents[2].read();
      expect(elem.id).toBe("a3");
      expect(elem.name).toBe("Agent 3");
    });
  });

  describe("edge cases", () => {
    it("empty array: find returns undefined, length is 0, map returns []", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      expect(ctx.client.empty.find(() => true)).toBeUndefined();
      expect(ctx.client.empty.length).toBe(0);
      expect(ctx.client.empty.map((x) => x)).toEqual([]);
    });

    it("mutation via set then re-read via find sees updated data", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      await ctx.client.tags.set(["new1", "new2"]);
      expect(ctx.client.tags.find((t) => t === "new2")).toBeDefined();
      expect(ctx.client.tags.read()).toEqual(["new1", "new2"]);
    });

    it("find always resolves fresh index after array reorder", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const original = ctx.client.agents.read();
      const reversed = [...original].reverse();
      await ctx.client.agents.set(reversed);

      const node = ctx.client.agents.find((a) => a.id === "a1");
      expect(node).toBeDefined();
      expect(node!.read().id).toBe("a1");
      expect(ctx.client.agents.findIndex((a) => a.id === "a1")).toBe(2);
    });

    it("nested arrays — inner access still works", async () => {
      const ctx = await setup();
      cleanup = ctx.cleanup;

      const inner = ctx.client.nested[0];
      expect(inner.read()).toEqual([1, 2]);
      expect(inner.length).toBe(2);

      const mapped = ctx.client.nested.map((arr) => arr.length);
      expect(mapped).toEqual([2, 2]);
    });
  });
});

describe("array proxy types", () => {
  it("type-level: find returns FieldNode | undefined, not plain value", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const node = ctx.client.agents.find((a) => a.id === "a1");
    if (node) {
      const _read: { id: string; name: string; status: string } & Record<string, any> = node.read();
      const _name: string = _read.name;

      type NodeEventLog = typeof node.eventLog;
      type _HasConcat = NodeEventLog extends { concat: (...args: any[]) => any } ? true : false;
      const _check: _HasConcat = true;
    }
  });

  it("type-level: map returns plain array, not proxied", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const names = ctx.client.agents.map((a) => a.name);
    const _first: string = names[0];

    const tags = ctx.client.tags.map((t) => t.toUpperCase());
    const _tag: string = tags[0];
  });

  it("type-level: at returns FieldNode | undefined", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const node = ctx.client.agents.at(0);
    if (node) {
      const _id: string = node.read().id;
    }
  });

  it("type-level: numeric index returns FieldNode", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const node = ctx.client.agents[0];
    const _id: string = node.read().id;
  });
});
