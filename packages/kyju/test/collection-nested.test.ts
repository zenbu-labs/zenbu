import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { nanoid } from "nanoid";
import { createDb } from "../src/v2/db/db";
import { createReplica } from "../src/v2/replica/replica";
import { createClient } from "../src/v2/client/client";
import { createSchema, f, makeCollection, type InferSchema } from "../src/v2/db/schema";
import { VERSION } from "../src/v2/shared";
import zod from "zod";

function tmpDbPath() {
  return path.join(os.tmpdir(), `kyju-nested-collection-test-${nanoid()}`);
}

const nestedSchema = createSchema({
  title: f.string().default("test"),
  topLevelEvents: f.collection(zod.object({ msg: zod.string() })),
  agents: f
    .array(
      zod.object({
        id: zod.string(),
        name: zod.string(),
        eventLog: f.collection(zod.object({ text: zod.string(), ts: zod.number() })),
      }),
    )
    .default([
      { id: "a1", name: "Agent 1", eventLog: makeCollection("eventLog") },
    ]),
});

type NestedSchema = InferSchema<typeof nestedSchema>;

async function setup() {
  const dbPath = tmpDbPath();
  let db!: Awaited<ReturnType<typeof createDb>>;

  const replica = createReplica({
    send: (event) => db.postMessage(event),
    maxPageSizeBytes: 1024 * 1024,
  });

  db = await createDb({
    path: dbPath,
    schema: nestedSchema,
    migrations: [],
    send: (event) => replica.postMessage(event),
  });

  await replica.postMessage({ kind: "connect", version: VERSION });

  const client = createClient<NestedSchema>(replica);

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

describe("unified f.collection()", () => {
  it("initializes top-level collection with a real collectionId", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const root = ctx.client.readRoot();
    const topLevel = root.topLevelEvents;
    expect(topLevel).toBeDefined();
    expect(topLevel.collectionId).toBeTruthy();
    expect(topLevel.collectionId.length).toBeGreaterThan(0);
    expect(topLevel.debugName).toBe("topLevelEvents");
  });

  it("initializes nested collection inside array default with a real collectionId", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const root = ctx.client.readRoot();
    const agents = root.agents;
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe("a1");
    expect(agents[0].eventLog).toBeDefined();
    expect(agents[0].eventLog.collectionId).toBeTruthy();
    expect(agents[0].eventLog.collectionId.length).toBeGreaterThan(0);
  });

  it("creates backing collection directory on disk for top-level collection", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const root = ctx.client.readRoot();
    const collectionDir = path.join(ctx.dbPath, "collections", root.topLevelEvents.collectionId);
    expect(fs.existsSync(collectionDir)).toBe(true);
  });

  it("creates backing collection directory on disk for nested collection", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const root = ctx.client.readRoot();
    const collectionDir = path.join(ctx.dbPath, "collections", root.agents[0].eventLog.collectionId);
    expect(fs.existsSync(collectionDir)).toBe(true);
  });

  it("can concat to a top-level collection", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.topLevelEvents.concat([{ msg: "hello" }]);

    const root = ctx.client.readRoot();
    const dataDir = path.join(ctx.dbPath, "collections", root.topLevelEvents.collectionId);
    expect(fs.existsSync(dataDir)).toBe(true);
  });

  it("can concat to a nested collection via proxy path", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.agents[0].eventLog.concat([
      { text: "first event", ts: 1 },
      { text: "second event", ts: 2 },
    ]);

    const root = ctx.client.readRoot();
    const collectionDir = path.join(ctx.dbPath, "collections", root.agents[0].eventLog.collectionId, "pages");
    expect(fs.existsSync(collectionDir)).toBe(true);
  });

  it("lazy-creates collection on concat when backing dir does not exist", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const newAgents = [
      ...ctx.client.agents.read(),
      { id: "a2", name: "Agent 2", eventLog: { collectionId: nanoid(), debugName: "eventLog:a2" } },
    ];
    await ctx.client.agents.set(newAgents);

    const updated = ctx.client.readRoot();
    const newAgent = updated.agents.find((a) => a.id === "a2")!;
    expect(newAgent.eventLog.collectionId).toBeTruthy();

    await ctx.client.agents[1].eventLog.concat([{ text: "lazy created", ts: 3 }]);

    const collectionDir = path.join(ctx.dbPath, "collections", newAgent.eventLog.collectionId);
    expect(fs.existsSync(collectionDir)).toBe(true);
  });
});
