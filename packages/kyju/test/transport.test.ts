import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";
import { createDb } from "../src/v2/db/db";
import { createReplica } from "../src/v2/replica/replica";
import { createClient } from "../src/v2/client/client";
import { VERSION } from "../src/v2/shared";
import type { DbSendEvent, ServerEvent } from "../src/v2/shared";
import { createRouter, connectReplica, dbStringify, dbParse } from "../src/v2/transport";
import { testSchema, type TestSchema } from "./helpers";

function tmpDbPath() {
  return path.join(os.tmpdir(), `kyju-transport-test-${nanoid()}`);
}

let cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups) fn();
  cleanups = [];
});

describe("createRouter", () => {
  it("connection.receive forwards to db and learns replicaId", async () => {
    const router = createRouter();
    const dbPath = tmpDbPath();
    cleanups.push(() => fs.rmSync(dbPath, { recursive: true, force: true }));

    const db = await createDb({ schema: testSchema, path: dbPath, send: router.send });

    const sent: DbSendEvent[] = [];
    const conn = router.connection({
      send: (event) => sent.push(event),
      postMessage: db.postMessage,
    });

    await conn.receive({
      kind: "connect",
      message: { type: "connect", version: VERSION, requestId: nanoid(), replicaId: "r1" },
    });

    expect(sent.some((e) => e.kind === "db-update" && e.replicaId === "r1")).toBe(true);
  });

  it("can connect a replica through the router", async () => {
    const router = createRouter();
    const dbPath = tmpDbPath();
    cleanups.push(() => fs.rmSync(dbPath, { recursive: true, force: true }));

    const db = await createDb({ schema: testSchema, path: dbPath, send: router.send });

    let conn!: ReturnType<typeof router.connection>;
    const replica = createReplica({
      send: (event) => { conn.receive(event); },
      maxPageSizeBytes: 1024 * 1024,
    });
    conn = router.connection({
      send: (event) => { replica.postMessage(event); },
      postMessage: db.postMessage,
    });

    await replica.postMessage({ kind: "connect", version: VERSION });
    expect(replica.getState().kind).toBe("connected");

    const client = createClient<TestSchema>(replica);
    await client.title.set("routed");
    expect(client.title.read()).toBe("routed");
  });

  it("routes to multiple connections", async () => {
    const router = createRouter();
    const dbPath = tmpDbPath();
    cleanups.push(() => fs.rmSync(dbPath, { recursive: true, force: true }));

    const db = await createDb({ schema: testSchema, path: dbPath, send: router.send });

    let conn1!: ReturnType<typeof router.connection>;
    let conn2!: ReturnType<typeof router.connection>;

    const r1 = createReplica({ send: (e) => { conn1.receive(e); }, maxPageSizeBytes: 1024 * 1024 });
    const r2 = createReplica({ send: (e) => { conn2.receive(e); }, maxPageSizeBytes: 1024 * 1024 });

    conn1 = router.connection({ send: (e) => { r1.postMessage(e); }, postMessage: db.postMessage });
    conn2 = router.connection({ send: (e) => { r2.postMessage(e); }, postMessage: db.postMessage });

    await r1.postMessage({ kind: "connect", version: VERSION });
    await r2.postMessage({ kind: "connect", version: VERSION });

    const c1 = createClient<TestSchema>(r1);
    await c1.title.set("from-1");

    expect(createClient<TestSchema>(r2).title.read()).toBe("from-1");
  });

  it("close removes the route", async () => {
    const router = createRouter();
    const dbPath = tmpDbPath();
    cleanups.push(() => fs.rmSync(dbPath, { recursive: true, force: true }));

    const db = await createDb({ schema: testSchema, path: dbPath, send: router.send });

    const sent: DbSendEvent[] = [];
    let conn!: ReturnType<typeof router.connection>;

    const replica = createReplica({
      send: (e) => { conn.receive(e); },
      maxPageSizeBytes: 1024 * 1024,
    });
    conn = router.connection({
      send: (e) => { sent.push(e); replica.postMessage(e); },
      postMessage: db.postMessage,
    });

    await replica.postMessage({ kind: "connect", version: VERSION });

    conn.close();
    sent.length = 0;

    await db.client.title.set("after-close");
    expect(sent.length).toBe(0);
  });
});

describe("blob read through serialized transport", () => {
  /**
   * Simulates the real WebSocket path: every message between db and replica
   * goes through dbStringify → dbParse, just like it does over a real WebSocket.
   * This catches Uint8Array serialization issues that in-process tests miss.
   */
  function setupWithSerialization() {
    const dbPath = tmpDbPath();
    cleanups.push(() => fs.rmSync(dbPath, { recursive: true, force: true }));

    const router = createRouter();

    // These will be wired up after both db and replica exist
    let conn!: ReturnType<typeof router.connection>;

    const replica = createReplica({
      send: (event) => {
        // Simulate: renderer → WebSocket → server
        const serialized = dbStringify(event);
        const deserialized = dbParse(serialized);
        conn.receive(deserialized);
      },
      maxPageSizeBytes: 1024 * 1024,
    });

    const dbPromise = createDb({
      schema: testSchema,
      path: dbPath,
      send: router.send,
    }).then((db) => {
      conn = router.connection({
        send: (event) => {
          // Simulate: server → WebSocket → renderer
          const serialized = dbStringify(event);
          const deserialized = dbParse(serialized);
          replica.postMessage(deserialized);
        },
        postMessage: db.postMessage,
      });
      return db;
    });

    return { dbPromise, replica, dbPath };
  }

  it("getBlobData returns Uint8Array after create (hot)", async () => {
    const { dbPromise, replica } = setupWithSerialization();
    await dbPromise;

    await replica.postMessage({ kind: "connect", version: VERSION });
    const client = createClient<TestSchema>(replica);

    const payload = new TextEncoder().encode("hot through wire");
    const blobId = await client.createBlob(payload, true);

    const data = await client.getBlobData(blobId);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(data!)).toBe("hot through wire");
  });

  it("getBlobData auto-warms cold blob through serialized transport", async () => {
    const { dbPromise, replica } = setupWithSerialization();
    await dbPromise;

    await replica.postMessage({ kind: "connect", version: VERSION });
    const client = createClient<TestSchema>(replica);

    // Create as cold
    const payload = new TextEncoder().encode("cold through wire");
    const blobId = await client.createBlob(payload, false);

    const data = await client.getBlobData(blobId);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(data!)).toBe("cold through wire");
  });

  it("getBlobData works after reconnect through serialized transport", async () => {
    const { dbPromise, replica } = setupWithSerialization();
    await dbPromise;

    await replica.postMessage({ kind: "connect", version: VERSION });
    const client = createClient<TestSchema>(replica);

    const payload = new TextEncoder().encode("survives wire reconnect");
    const blobId = await client.createBlob(payload, true);

    // Reconnect — blobs are cleared
    await replica.postMessage({ kind: "disconnect" });
    await replica.postMessage({ kind: "connect", version: VERSION });

    const data = await client.getBlobData(blobId);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(data!)).toBe("survives wire reconnect");
  });
});

describe("connectReplica", () => {
  it("returns a connected typed client", async () => {
    const dbPath = tmpDbPath();
    cleanups.push(() => fs.rmSync(dbPath, { recursive: true, force: true }));

    let sendToReplica: (event: DbSendEvent) => void = () => {};
    const db = await createDb({
      schema: testSchema,
      path: dbPath,
      send: (event) => sendToReplica(event),
    });

    const { client, disconnect } = await connectReplica<TestSchema>({
      send: (event) => { db.postMessage(event); },
      subscribe: (cb) => { sendToReplica = cb; return () => { sendToReplica = () => {}; }; },
    });

    expect(client.title.read()).toBe("untitled");
    await client.title.set("hello");
    expect(client.title.read()).toBe("hello");

    await disconnect();
  });

  it("filters events by replicaId with multiple replicas", async () => {
    const dbPath = tmpDbPath();
    cleanups.push(() => fs.rmSync(dbPath, { recursive: true, force: true }));

    const subs = new Set<(event: DbSendEvent) => void>();
    const db = await createDb({
      schema: testSchema,
      path: dbPath,
      send: (event) => { for (const cb of subs) cb(event); },
    });

    const { client: c1, disconnect: d1 } = await connectReplica<TestSchema>({
      send: (event) => { db.postMessage(event); },
      subscribe: (cb) => { subs.add(cb); return () => subs.delete(cb); },
    });

    const { client: c2, disconnect: d2 } = await connectReplica<TestSchema>({
      send: (event) => { db.postMessage(event); },
      subscribe: (cb) => { subs.add(cb); return () => subs.delete(cb); },
    });

    await c1.title.set("from-1");
    expect(c1.title.read()).toBe("from-1");
    expect(c2.title.read()).toBe("from-1");

    await d1();
    await d2();
  });

  it("disconnect unsubscribes", async () => {
    const dbPath = tmpDbPath();
    cleanups.push(() => fs.rmSync(dbPath, { recursive: true, force: true }));

    let unsubscribed = false;
    let sendToReplica: (event: DbSendEvent) => void = () => {};
    const db = await createDb({
      schema: testSchema,
      path: dbPath,
      send: (event) => sendToReplica(event),
    });

    const { disconnect } = await connectReplica<TestSchema>({
      send: (event) => { db.postMessage(event); },
      subscribe: (cb) => {
        sendToReplica = cb;
        return () => { sendToReplica = () => {}; unsubscribed = true; };
      },
    });

    expect(unsubscribed).toBe(false);
    await disconnect();
    expect(unsubscribed).toBe(true);
  });
});
