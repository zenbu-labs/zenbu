import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { AcpClient, PROTOCOL_VERSION } from "../src/client.ts";
import type { SessionNotification } from "@agentclientprotocol/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bridgePath = join(__dirname, "..", "..", "codex-acp", "src", "index.ts");

let codexAvailable = false;
try {
  execSync("which codex", { stdio: "ignore" });
  codexAvailable = true;
} catch {
  codexAvailable = false;
}

function createTestClient() {
  return AcpClient.create({
      command: "npx",
      args: ["tsx", bridgePath],
      cwd: process.cwd(),
      handlers: {
        requestPermission: async () => ({
          outcome: { outcome: "selected" as const, optionId: "allow" },
        }),
      },
    });
}

describe.skipIf(!codexAvailable)("AcpClient", () => {
  let client: AcpClient;

  afterEach(async () => {
    if (client) await client.close();
  });

  it("initializes and gets capabilities", async () => {
    client = await createTestClient();
    const state = client.getState();
    expect(state).toBe("disconnected");

    const result = await client.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
        clientInfo: { name: "test-client", version: "0.0.1" },
      });

    expect(result.protocolVersion).toBe(1);
    expect(result.agentCapabilities?.loadSession).toBe(true);
    expect(result.agentInfo?.name).toBe("codex-acp");

    const stateAfter = client.getState();
    expect(stateAfter).toBe("initializing");
  });

  it("creates a new session", async () => {
    client = await createTestClient();
    await client.initialize({ protocolVersion: PROTOCOL_VERSION });

    const session = await client.newSession({ cwd: process.cwd(), mcpServers: [] });

    expect(session.sessionId).toBeTruthy();
    expect(typeof session.sessionId).toBe("string");

    const state = client.getState();
    expect(state).toBe("ready");

    const sessionId = await client.getSessionId();
    expect(sessionId).toBe(session.sessionId);
  });

  it("sends a prompt and receives events", async () => {
    client = await createTestClient();
    await client.initialize({ protocolVersion: PROTOCOL_VERSION });
    const session = await client.newSession({ cwd: process.cwd(), mcpServers: [] });

    const events: SessionNotification[] = [];
    client.onSessionUpdate((e) => events.push(e));

    const result = await client.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "Say exactly: hello" }],
      });

    expect(result.stopReason).toBe("end_turn");

    const state = client.getState();
    expect(state).toBe("ready");

    expect(events.length).toBeGreaterThan(0);
    const messageChunks = events.filter(
      (e) => e.update.sessionUpdate === "agent_message_chunk",
    );
    expect(messageChunks.length).toBeGreaterThan(0);
  });

  it("unsubscribes from session updates", async () => {
    client = await createTestClient();
    await client.initialize({ protocolVersion: PROTOCOL_VERSION });
    const session = await client.newSession({ cwd: process.cwd(), mcpServers: [] });

    const events: SessionNotification[] = [];
    const unsub = client.onSessionUpdate((e) => events.push(e));
    unsub();

    await client.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "Say hello" }],
      });

    expect(events.length).toBe(0);
  });

  it("transitions through states correctly", async () => {
    client = await createTestClient();
    expect(client.getState()).toBe("disconnected");

    await client.initialize({ protocolVersion: PROTOCOL_VERSION });
    expect(client.getState()).toBe("initializing");

    const session = await client.newSession({ cwd: process.cwd(), mcpServers: [] });
    expect(client.getState()).toBe("ready");

    await client.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "hi" }],
      });
    expect(client.getState()).toBe("ready");

    await client.close();
    expect(client.getState()).toBe("disconnected");
  });
});
