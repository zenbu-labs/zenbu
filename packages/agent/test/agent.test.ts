import { describe, it, expect, afterEach } from "vitest";
import { Effect } from "effect";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Agent } from "../src/agent.ts";
import type { EventLog } from "../src/event-log.ts";
import type { AgentStore } from "../src/store.ts";
import type { SessionUpdate } from "@agentclientprotocol/sdk";

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

function createTestEventLog() {
  const events: SessionUpdate[] = [];
  const log: EventLog = {
    append: (newEvents) =>
      Effect.gen(function* () {
        events.push(...newEvents);
      }),
  };
  return { log, events };
}

function createTestStore(): AgentStore {
  const sessions = new Map<string, string>();
  return {
    getSessionId: (agentId) =>
      Effect.succeed(sessions.get(agentId) ?? null),
    setSessionId: (agentId, sessionId) =>
      Effect.sync(() => { sessions.set(agentId, sessionId); }),
    deleteSessionId: (agentId) =>
      Effect.sync(() => { sessions.delete(agentId); }),
  };
}

function createAgent(eventLog: EventLog, store: AgentStore, id?: string) {
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

describe.skipIf(!codexAvailable)("Agent", () => {
  let agent: Agent;

  afterEach(async () => {
    if (agent) {
      await Effect.runPromise(agent.close()).catch(() => {});
    }
  });

  it("generates an id when none is provided", async () => {
    const { log } = createTestEventLog();
    const store = createTestStore();
    agent = await createAgent(log, store);

    const id = agent.getId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("uses provided id", async () => {
    const { log } = createTestEventLog();
    const store = createTestStore();
    agent = await createAgent(log, store, "my-agent-123");

    expect(agent.getId()).toBe("my-agent-123");
  });

  it("starts in initializing state", async () => {
    const { log } = createTestEventLog();
    const store = createTestStore();
    agent = await createAgent(log, store);

    const state = await Effect.runPromise(agent.getState());
    expect(state.kind).toBe("initializing");
  });

  it("transitions to ready after first send", async () => {
    const { log } = createTestEventLog();
    const store = createTestStore();
    agent = await createAgent(log, store);

    await Effect.runPromise(
      agent.send([{ type: "text", text: "hello" }]),
    );

    const state = await Effect.runPromise(agent.getState());
    expect(state.kind).toBe("ready");
  });

  it("stores session id mapping after init", async () => {
    const { log } = createTestEventLog();
    const store = createTestStore();
    agent = await createAgent(log, store, "test-agent");

    await Effect.runPromise(
      agent.send([{ type: "text", text: "hello" }]),
    );

    const sessionId = await Effect.runPromise(store.getSessionId("test-agent"));
    expect(sessionId).toBeTruthy();
  });

  it("sends a message and collects events in event log", async () => {
    const { log, events } = createTestEventLog();
    const store = createTestStore();
    agent = await createAgent(log, store);

    await Effect.runPromise(
      agent.send([{ type: "text", text: "Say hello" }]),
    );

    expect(events.length).toBeGreaterThan(0);

    const messageChunks = events.filter(
      (e) => e.sessionUpdate === "agent_message_chunk",
    );
    expect(messageChunks.length).toBeGreaterThan(0);
  });

  it("closes and transitions to closed state", async () => {
    const { log } = createTestEventLog();
    const store = createTestStore();
    agent = await createAgent(log, store);

    await Effect.runPromise(agent.close());

    const state = await Effect.runPromise(agent.getState());
    expect(state.kind).toBe("closed");
  });

  it("fails to send when closed", async () => {
    const { log } = createTestEventLog();
    const store = createTestStore();
    agent = await createAgent(log, store);

    await Effect.runPromise(agent.close());

    const result = await Effect.runPromiseExit(
      agent.send([{ type: "text", text: "Should fail" }]),
    );

    expect(result._tag).toBe("Failure");
  });
});
