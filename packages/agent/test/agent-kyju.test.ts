import { describe, it, expect, afterEach } from "vitest";
import { Effect } from "effect";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import type { SessionUpdate } from "@agentclientprotocol/sdk";

import { Agent } from "../src/agent.ts";
import {
  agentSchema,
  type AgentDb,
  type AgentRecord,
} from "../src/schema.ts";

import {
  createDb,
  createReplica,
  VERSION,
  type Db,
} from "@zenbu/kyju";
import { makeCollection } from "@zenbu/kyju/schema";

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

function tmpDbPath() {
  return path.join(os.tmpdir(), `agent-integration-${nanoid()}`);
}

/**
 * Build a kyju DB scoped to exactly the agent schema. The DB's
 * `effectClient` directly satisfies the structural `AgentDb` shape —
 * no adapter layer needed in tests.
 */
async function setupAgentDb(dbPath?: string) {
  const p = dbPath ?? tmpDbPath();
  let db!: Db<typeof agentSchema.shape>;
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
  return {
    db,
    replica,
    dbPath: p,
    client: db.effectClient as unknown as AgentDb,
    cleanup: () => fs.rmSync(p, { recursive: true, force: true }),
  };
}

/**
 * Insert an agent row with the given id into the DB. Must happen before the
 * Agent class's first DB read, because all the state-sync methods no-op when
 * the row is missing (host app is responsible for creating the row).
 */
async function seedAgentRow(
  client: AgentDb,
  id: string,
  overrides: Partial<AgentRecord> = {},
): Promise<void> {
  await Effect.runPromise(
    client.update((root) => {
      root.agents = [
        ...root.agents,
        {
          id,
          name: id,
          startCommand: "codex",
          configId: "codex",
          status: "idle" as const,
          eventLog: makeCollection({ collectionId: nanoid(), debugName: "eventLog" }),
          title: { kind: "not-available" as const },
          reloadMode: "keep-alive" as const,
          sessionId: null,
          firstPromptSentAt: null,
          createdAt: Date.now(),
          ...overrides,
        },
      ];
    }),
  );
}

function createAgent(client: AgentDb, id: string) {
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
      db: client,
    }),
  );
}

describe.skipIf(!codexAvailable)("Agent × kyju integration", () => {
  let agent: Agent | undefined;
  let cleanup: (() => void) | undefined;

  afterEach(async () => {
    if (agent) {
      await Effect.runPromise(agent.close()).catch(() => {});
      agent = undefined;
    }
    cleanup?.();
    cleanup = undefined;
  });

  it("writes sessionId onto the agent record after init", async () => {
    const kyju = await setupAgentDb();
    cleanup = kyju.cleanup;
    await seedAgentRow(kyju.client, "persist-sess");

    agent = await createAgent(kyju.client, "persist-sess");
    await Effect.runPromise(agent.send([{ type: "text", text: "hello" }]));

    const row = kyju.client.readRoot().agents.find((a) => a.id === "persist-sess");
    expect(row?.sessionId).toBeTruthy();
    expect(typeof row?.sessionId).toBe("string");
  });

  it("session row survives db reconnect", async () => {
    const dbPath = tmpDbPath();
    cleanup = () => fs.rmSync(dbPath, { recursive: true, force: true });

    const kyju1 = await setupAgentDb(dbPath);
    await seedAgentRow(kyju1.client, "persist-agent");

    agent = await createAgent(kyju1.client, "persist-agent");
    await Effect.runPromise(agent.send([{ type: "text", text: "hello" }]));
    await Effect.runPromise(agent.close());
    agent = undefined;

    const savedSessionId = kyju1.client
      .readRoot()
      .agents.find((a) => a.id === "persist-agent")?.sessionId;
    expect(savedSessionId).toBeTruthy();

    await kyju1.replica.postMessage({ kind: "disconnect" });

    const kyju2 = await setupAgentDb(dbPath);
    const reloaded = kyju2.client
      .readRoot()
      .agents.find((a) => a.id === "persist-agent");
    expect(reloaded?.sessionId).toBe(savedSessionId);
  });

  it("first-prompt latch is durable: firstPromptSentAt is set once", async () => {
    const kyju = await setupAgentDb();
    cleanup = kyju.cleanup;
    await seedAgentRow(kyju.client, "latch-agent");

    let preambleCalls = 0;
    agent = await Effect.runPromise(
      Agent.create({
        id: "latch-agent",
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
        db: kyju.client,
        firstPromptPreamble: () =>
          Effect.sync(() => {
            preambleCalls++;
            return [{ type: "text", text: "PREAMBLE" } as const];
          }),
      }),
    );

    await Effect.runPromise(agent.send([{ type: "text", text: "first" }]));
    expect(preambleCalls).toBe(1);

    const firstStamp = kyju.client
      .readRoot()
      .agents.find((a) => a.id === "latch-agent")?.firstPromptSentAt;
    expect(firstStamp).toBeTruthy();
    expect(typeof firstStamp).toBe("number");

    await Effect.runPromise(agent.send([{ type: "text", text: "second" }]));
    expect(preambleCalls).toBe(1);

    const secondStamp = kyju.client
      .readRoot()
      .agents.find((a) => a.id === "latch-agent")?.firstPromptSentAt;
    expect(secondStamp).toBe(firstStamp);
  });

  it("writes events into the agent's eventLog collection", async () => {
    const kyju = await setupAgentDb();
    cleanup = kyju.cleanup;
    await seedAgentRow(kyju.client, "events-agent");

    agent = await createAgent(kyju.client, "events-agent");
    await Effect.runPromise(agent.send([{ type: "text", text: "Say hello" }]));

    const rowNode = kyju.client.agents.find((a) => a.id === "events-agent");
    expect(rowNode).toBeTruthy();

    // Subscribe to collection data — kyju buffers pages locally on the
    // replica, and subscribeData fires every time a new batch lands. Wait
    // up to 5s for at least one batch.
    const received: any[] = [];
    const unsub = rowNode!.eventLog.subscribeData((data) => {
      received.push(...data.newItems);
    });
    await Effect.runPromise(rowNode!.eventLog.read()).catch(() => {});

    const deadline = Date.now() + 5_000;
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    unsub();

    expect(received.length).toBeGreaterThan(0);
    const sessionUpdates = received.filter(
      (e: any) => e.data?.kind === "session_update",
    );
    expect(sessionUpdates.length).toBeGreaterThan(0);
  });

  it("syncs status + processState on state transitions", async () => {
    const kyju = await setupAgentDb();
    cleanup = kyju.cleanup;
    await seedAgentRow(kyju.client, "state-agent");

    agent = await createAgent(kyju.client, "state-agent");

    // After creation the Agent forks init in the background. We observe the
    // row's processState values during send() to confirm state-sync.
    const states: string[] = [];
    const start = Date.now();
    let done = false;
    const poller = (async () => {
      while (!done && Date.now() - start < 30_000) {
        const row = kyju.client
          .readRoot()
          .agents.find((a) => a.id === "state-agent");
        if (row?.processState && states.at(-1) !== row.processState) {
          states.push(row.processState);
        }
        await new Promise((r) => setTimeout(r, 20));
      }
    })();

    await Effect.runPromise(agent.send([{ type: "text", text: "hello" }]));

    // The final `_setState({kind: "ready"})` fires inside the Effect chain
    // but its DB write is async; wait for the row to settle.
    const readyDeadline = Date.now() + 2_000;
    while (Date.now() < readyDeadline) {
      const row = kyju.client
        .readRoot()
        .agents.find((a) => a.id === "state-agent");
      if (row?.processState === "ready" && row?.status === "idle") break;
      await new Promise((r) => setTimeout(r, 20));
    }

    done = true;
    await poller;

    expect(states).toContain("prompting");

    const finalRow = kyju.client
      .readRoot()
      .agents.find((a) => a.id === "state-agent");
    expect(finalRow?.processState).toBe("ready");
    expect(finalRow?.status).toBe("idle");
  });

  it("reconciles agentConfigs.availableModels from ACP on session start", async () => {
    const kyju = await setupAgentDb();
    cleanup = kyju.cleanup;

    // Seed the config template and a matching agent.
    await Effect.runPromise(
      kyju.client.update((root) => {
        root.agentConfigs = [
          {
            id: "codex",
            name: "codex",
            startCommand: "codex",
            availableModels: [],
            availableThinkingLevels: [],
            availableModes: [],
          },
        ];
      }),
    );
    await seedAgentRow(kyju.client, "cfg-agent", { configId: "codex" });

    agent = await createAgent(kyju.client, "cfg-agent");
    await Effect.runPromise(agent.send([{ type: "text", text: "hello" }]));

    const template = kyju.client
      .readRoot()
      .agentConfigs.find((c) => c.id === "codex");
    // Codex always advertises at least one model in its configOptions.
    expect(template?.availableModels.length).toBeGreaterThan(0);
  });

  it("ephemeral mode: no db → no row writes, sessionId lives on agent state only", async () => {
    const kyju = await setupAgentDb();
    cleanup = kyju.cleanup;
    await seedAgentRow(kyju.client, "ghost-agent");

    const events: SessionUpdate[] = [];
    // Note: NO `db` field passed.
    agent = await Effect.runPromise(
      Agent.create({
        id: "ghost-agent",
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
        onSessionUpdate: (u) => {
          events.push(u);
        },
      }),
    );

    await Effect.runPromise(agent.send([{ type: "text", text: "hello" }]));

    // Even though a row with this id exists in the DB, the Agent never
    // touched it (ran ephemeral).
    const row = kyju.client
      .readRoot()
      .agents.find((a) => a.id === "ghost-agent");
    expect(row?.sessionId).toBeNull();
    expect(row?.firstPromptSentAt).toBeNull();
    expect(row?.status).toBe("idle");

    // But the agent's internal state machine has the session.
    const state = await Effect.runPromise(agent.getState());
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.sessionId).toBeTruthy();
    }

    // onSessionUpdate did observe the stream.
    expect(events.length).toBeGreaterThan(0);
  });
});
