import { describe, it, expect, afterEach } from "vitest";
import { Effect } from "effect";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import zod from "zod";
import type { SessionUpdate } from "@agentclientprotocol/sdk";

import { Agent } from "../src/agent.ts";
import type { EventLog } from "../src/event-log.ts";
import type { AgentStore, AgentStoreError } from "../src/store.ts";

import {
  createDb,
  createReplica,
  createClient,
  createSchema,
  f,
  VERSION,
  type Db,
  type InferSchema,
  type ClientProxy,
  type ClientState,
} from "@zenbu/kyju";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const codexAcpBridge = join(
  __dirname,
  "..",
  "..",
  "codex-acp",
  "src",
  "index.ts",
);

let codexAvailable = false;
try {
  execSync("which codex", { stdio: "ignore" });
  codexAvailable = true;
} catch {
  codexAvailable = false;
}

const agentSchema = createSchema({
  sessions: f.record(zod.string(), zod.string()).default({}),
  events: f.collection<SessionUpdate>(),
});

type AgentDbSchema = InferSchema<typeof agentSchema>;
type AgentClient = ClientProxy<AgentDbSchema>;

function tmpDbPath() {
  return path.join(os.tmpdir(), `agent-kyju-test-${nanoid()}`);
}

async function setupKyju(dbPath?: string) {
  const p = dbPath ?? tmpDbPath();

  let db!: Db;
  const replica = createReplica({
    send: (event) => db.postMessage(event),
    maxPageSizeBytes: 1024 * 1024,
  });

  db = await createDb({
    path: p,
    schema: agentSchema,
    send: (event) => replica.postMessage(event),
  });

  await replica.postMessage({ kind: "connect", version: VERSION });

  const client = createClient<AgentDbSchema>(replica);

  return {
    db,
    replica,
    client,
    dbPath: p,
    cleanup: () => fs.rmSync(p, { recursive: true, force: true }),
  };
}

function createKyjuStore(client: AgentClient): AgentStore {
  return {
    getSessionId: (agentId) =>
      Effect.sync(() => {
        const sessions = client.sessions.read();
        return sessions[agentId] ?? null;
      }) as Effect.Effect<string | null, AgentStoreError>,
    setSessionId: (agentId, sessionId) =>
      Effect.promise(() =>
        client.update((root) => {
          root.sessions[agentId] = sessionId;
        }),
      ) as Effect.Effect<void, AgentStoreError>,
    deleteSessionId: (agentId) =>
      Effect.promise(() =>
        client.update((root) => {
          delete root.sessions[agentId];
        }),
      ) as Effect.Effect<void, AgentStoreError>,
  };
}

function createKyjuEventLog(client: AgentClient): EventLog {
  return {
    append: (events) => Effect.promise(() => client.events.concat(events)),
  };
}

function getConnectedState(replica: { getState: () => ClientState }) {
  const state = replica.getState();
  if (state.kind === "disconnected") throw new Error("Not connected");
  return state;
}

function readEvents(
  client: AgentClient,
  replica: { getState: () => ClientState },
): SessionUpdate[] {
  const state = getConnectedState(replica);
  const root = client.readRoot();
  const col = state.collections.find((c) => c.id === root.events.collectionId);
  if (!col) return [];
  return col.pages
    .filter((p) => p.data.kind === "hot")
    .flatMap((p) =>
      p.data.kind === "hot" ? (p.data.items as SessionUpdate[]) : [],
    );
}

function createAgent(store: AgentStore, eventLog: EventLog, id?: string) {
  return Effect.runPromise(
    Agent.create({
      id,
      clientConfig: {
        command: "npx",
        args: ["tsx", codexAcpBridge],
        cwd: process.cwd(),
        handlers: {
          requestPermission: async () => ({
            outcome: { outcome: "selected" as const, optionId: "allow" },
          }),
        },
      },
      cwd: process.cwd(),
      eventLog,
      store,
    }),
  );
}

describe.skipIf(!codexAvailable)("Agent with kyju storage", () => {
  let agent: Agent | undefined;
  let kyjuCleanup: (() => void) | undefined;

  afterEach(async () => {
    if (agent) {
      await Effect.runPromise(agent.close()).catch(() => {});
      agent = undefined;
    }
    kyjuCleanup?.();
  });

  it("persists session id mapping in kyju", async () => {
    const kyju = await setupKyju();
    kyjuCleanup = kyju.cleanup;
    const store = createKyjuStore(kyju.client);
    const eventLog = createKyjuEventLog(kyju.client);

    agent = await createAgent(store, eventLog, "kyju-agent-1");
    await Effect.runPromise(agent.send([{ type: "text", text: "hello" }]));

    const sessions = kyju.client.sessions.read();
    expect(sessions["kyju-agent-1"]).toBeTruthy();
    expect(typeof sessions["kyju-agent-1"]).toBe("string");
  });

  it("stores events in kyju collection after send", async () => {
    const kyju = await setupKyju();
    kyjuCleanup = kyju.cleanup;
    const store = createKyjuStore(kyju.client);
    const eventLog = createKyjuEventLog(kyju.client);

    agent = await createAgent(store, eventLog);
    await Effect.runPromise(agent.send([{ type: "text", text: "Say hello" }]));

    await kyju.client.events.read();
    const events = readEvents(kyju.client, kyju.replica);

    expect(events.length).toBeGreaterThan(0);
    const messageChunks = events.filter(
      (e) => e.sessionUpdate === "agent_message_chunk",
    );
    expect(messageChunks.length).toBeGreaterThan(0);
  });

  it("session mapping survives db reconnect", async () => {
    const dbPath = tmpDbPath();
    kyjuCleanup = () => fs.rmSync(dbPath, { recursive: true, force: true });

    const kyju1 = await setupKyju(dbPath);
    const store1 = createKyjuStore(kyju1.client);
    const eventLog1 = createKyjuEventLog(kyju1.client);

    agent = await createAgent(store1, eventLog1, "persist-agent");
    await Effect.runPromise(agent.send([{ type: "text", text: "hello" }]));
    await Effect.runPromise(agent.close());
    agent = undefined;

    const sessionsBefore = kyju1.client.sessions.read();
    const savedSessionId = sessionsBefore["persist-agent"];
    expect(savedSessionId).toBeTruthy();

    await kyju1.replica.postMessage({ kind: "disconnect" });

    const kyju2 = await setupKyju(dbPath);
    const sessionsAfter = kyju2.client.sessions.read();
    expect(sessionsAfter["persist-agent"]).toBe(savedSessionId);
  });

  it("multiple agents share the same kyju db", async () => {
    const kyju = await setupKyju();
    kyjuCleanup = kyju.cleanup;
    const store = createKyjuStore(kyju.client);
    const eventLog = createKyjuEventLog(kyju.client);

    const agent1 = await createAgent(store, eventLog, "agent-a");
    await Effect.runPromise(agent1.send([{ type: "text", text: "hello" }]));

    const agent2 = await createAgent(store, eventLog, "agent-b");
    await Effect.runPromise(agent2.send([{ type: "text", text: "hello" }]));

    const sessions = kyju.client.sessions.read();
    expect(sessions["agent-a"]).toBeTruthy();
    expect(sessions["agent-b"]).toBeTruthy();
    expect(sessions["agent-a"]).not.toBe(sessions["agent-b"]);

    await Effect.runPromise(agent1.close()).catch(() => {});
    await Effect.runPromise(agent2.close()).catch(() => {});
  });

  it("events from multiple sends accumulate in the collection", async () => {
    const kyju = await setupKyju();
    kyjuCleanup = kyju.cleanup;
    const store = createKyjuStore(kyju.client);
    const eventLog = createKyjuEventLog(kyju.client);

    agent = await createAgent(store, eventLog);

    await Effect.runPromise(
      agent.send([{ type: "text", text: "First message" }]),
    );
    await Effect.runPromise(
      agent.send([{ type: "text", text: "Second message" }]),
    );

    await kyju.client.events.read();
    const events = readEvents(kyju.client, kyju.replica);

    const messageChunks = events.filter(
      (e) => e.sessionUpdate === "agent_message_chunk",
    );
    expect(messageChunks.length).toBeGreaterThanOrEqual(2);
  });
});
