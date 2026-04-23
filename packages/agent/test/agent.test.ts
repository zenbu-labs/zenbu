import { describe, it, expect, afterEach } from "vitest";
import { Effect } from "effect";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Agent } from "../src/agent.ts";
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

/**
 * Ephemeral agent harness: no DB handle, session + first-prompt state live
 * in-memory. `events` is a passive observer accumulating raw ACP updates
 * via the onSessionUpdate hook so assertions can inspect the stream.
 */
function createEphemeralAgent(id?: string) {
  const events: SessionUpdate[] = [];
  return Agent.create({
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
      onSessionUpdate: (u) => {
        events.push(u);
      },
    }).then((agent) => ({ agent, events }));
}

describe.skipIf(!codexAvailable)("Agent (ephemeral mode)", () => {
  let agent: Agent;

  afterEach(async () => {
    if (agent) {
      await agent.close().catch(() => {});
    }
  });

  it("generates an id when none is provided", async () => {
    ({ agent } = await createEphemeralAgent());

    const id = agent.getId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("uses provided id", async () => {
    ({ agent } = await createEphemeralAgent("my-agent-123"));

    expect(agent.getId()).toBe("my-agent-123");
  });

  it("starts in initializing state", async () => {
    ({ agent } = await createEphemeralAgent());

    const state = agent.getState();
    expect(state.kind).toBe("initializing");
  });

  it("transitions to ready after first send", async () => {
    ({ agent } = await createEphemeralAgent());

    await agent.send([{ type: "text", text: "hello" }]);

    const state = agent.getState();
    expect(state.kind).toBe("ready");
  });

  it("acquires a session id after init (visible on state)", async () => {
    ({ agent } = await createEphemeralAgent("test-agent"));

    await agent.send([{ type: "text", text: "hello" }]);

    const state = agent.getState();
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.sessionId).toBeTruthy();
    }
  });

  it("sends a message and streams session updates", async () => {
    let result: { agent: Agent; events: SessionUpdate[] };
    result = await createEphemeralAgent();
    agent = result.agent;

    await agent.send([{ type: "text", text: "Say hello" }]);

    expect(result.events.length).toBeGreaterThan(0);

    const messageChunks = result.events.filter(
      (e) => e.sessionUpdate === "agent_message_chunk",
    );
    expect(messageChunks.length).toBeGreaterThan(0);
  });

  it("closes and transitions to closed state", async () => {
    ({ agent } = await createEphemeralAgent());

    await agent.close();

    const state = agent.getState();
    expect(state.kind).toBe("closed");
  });

  it("fails to send when closed", async () => {
    ({ agent } = await createEphemeralAgent());

    await agent.close();

    let threw = false;
    try {
      await agent.send([{ type: "text", text: "Should fail" }]);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
