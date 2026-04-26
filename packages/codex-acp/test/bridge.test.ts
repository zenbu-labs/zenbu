import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";
import { AcpClient, PROTOCOL_VERSION } from "@zenbu/agent/src/client.ts";
import { McpSocketServer } from "@zenbu/agent/src/mcp/server.ts";
import { defineTools } from "@zenbu/agent/src/mcp/tools.ts";
import { getMcpSocketPath } from "@zenbu/agent/src/mcp/socket-path.ts";
import { writeProxyScript } from "@zenbu/agent/src/mcp/proxy-template.ts";
import type { McpServer, SessionNotification, SessionUpdate } from "@agentclientprotocol/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bridgePath = join(__dirname, "..", "src", "index.ts");
const CODEX_CONFIG_PATH = join(homedir(), ".codex", "config.toml");

function createBridgeClient() {
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

async function initAndCreateSession(client: AcpClient) {
  await client.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
    clientInfo: { name: "spec-test", version: "0.0.1" },
  });
  return client.newSession({ cwd: process.cwd(), mcpServers: [] });
}

async function promptAndCollectEvents(
  client: AcpClient,
  sessionId: string,
  text: string,
) {
  const events: SessionNotification[] = [];
  client.onSessionUpdate((e) => events.push(e));
  const result = await client.prompt({ sessionId, prompt: [{ type: "text", text }] });
  return { result, events };
}

let codexAvailable = false;
try {
  execSync("which codex", { stdio: "ignore" });
  codexAvailable = true;
} catch {
  codexAvailable = false;
}

describe.skipIf(!codexAvailable)("codex-acp bridge spec compliance", () => {
  let client: AcpClient;

  afterEach(async () => {
    if (client) await client.close();
  });

  it("initialize returns valid protocol version and capabilities", async () => {
    client = await createBridgeClient();
    const result = await client.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
      clientInfo: { name: "spec-test", version: "0.0.1" },
    });

    expect(result.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(result.agentCapabilities).toBeDefined();
    expect(result.agentInfo?.name).toBeTruthy();
  });

  it("session/new returns a sessionId", async () => {
    client = await createBridgeClient();
    const session = await initAndCreateSession(client);

    expect(session.sessionId).toBeTruthy();
    expect(typeof session.sessionId).toBe("string");
  });

  it("prompt returns end_turn stop reason", async () => {
    client = await createBridgeClient();
    const session = await initAndCreateSession(client);
    const { result } = await promptAndCollectEvents(
      client,
      session.sessionId,
      "Say hi",
    );

    expect(result.stopReason).toBe("end_turn");
  });

  it("agent_message_chunk events contain only incremental text, not full accumulated messages", async () => {
    client = await createBridgeClient();
    const session = await initAndCreateSession(client);
    const { events } = await promptAndCollectEvents(
      client,
      session.sessionId,
      "Say exactly: hello world",
    );

    const chunks = events
      .filter((e) => e.update.sessionUpdate === "agent_message_chunk")
      .map((e) => {
        const update = e.update as Extract<SessionUpdate, { sessionUpdate: "agent_message_chunk" }>;
        return update.content.type === "text" ? update.content.text : "";
      });

    expect(chunks.length).toBeGreaterThan(0);

    const accumulated = chunks.reduce((acc, chunk) => acc + chunk, "");

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(accumulated.length);
      if (chunks.length > 1) {
        expect(chunk).not.toBe(accumulated);
      }
    }
  });

  it("no user_message_chunk events are emitted during a prompt turn", async () => {
    client = await createBridgeClient();
    const session = await initAndCreateSession(client);
    const { events } = await promptAndCollectEvents(
      client,
      session.sessionId,
      "Say hi",
    );

    const userChunks = events.filter(
      (e) => e.update.sessionUpdate === "user_message_chunk",
    );
    expect(userChunks.length).toBe(0);
  });

  it("all session/update events have the correct sessionId", async () => {
    client = await createBridgeClient();
    const session = await initAndCreateSession(client);
    const { events } = await promptAndCollectEvents(
      client,
      session.sessionId,
      "Say hi",
    );

    for (const event of events) {
      expect(event.sessionId).toBe(session.sessionId);
    }
  });

  it("all session/update events have a valid sessionUpdate discriminator", async () => {
    client = await createBridgeClient();
    const session = await initAndCreateSession(client);
    const { events } = await promptAndCollectEvents(
      client,
      session.sessionId,
      "Say hi",
    );

    const validTypes = [
      "agent_message_chunk",
      "agent_thought_chunk",
      "user_message_chunk",
      "tool_call",
      "tool_call_update",
      "plan",
      "available_commands_update",
      "current_mode_update",
      "config_option_update",
      "session_info_update",
      "usage_update",
    ];

    for (const event of events) {
      expect(validTypes).toContain(event.update.sessionUpdate);
    }
  });

  it("agent_message_chunk content blocks have type text", async () => {
    client = await createBridgeClient();
    const session = await initAndCreateSession(client);
    const { events } = await promptAndCollectEvents(
      client,
      session.sessionId,
      "Say hi",
    );

    const messageChunks = events.filter(
      (e) => e.update.sessionUpdate === "agent_message_chunk",
    );
    for (const event of messageChunks) {
      const update = event.update as Extract<SessionUpdate, { sessionUpdate: "agent_message_chunk" }>;
      expect(update.content.type).toBe("text");
      if (update.content.type === "text") {
        expect(typeof update.content.text).toBe("string");
      }
    }
  });

  it("emits a tool_call_update when a bash command completes", async () => {
    client = await createBridgeClient();
    const session = await initAndCreateSession(client);
    const { events } = await promptAndCollectEvents(
      client,
      session.sessionId,
      "Use the bash tool to run exactly this command, then stop: printf codex-acp-bash-update-ok",
    );

    const toolStarts = events.filter(
      (e): e is SessionNotification & {
        update: Extract<SessionUpdate, { sessionUpdate: "tool_call" }>;
      } =>
        e.update.sessionUpdate === "tool_call" &&
        e.update.kind === "execute",
    );
    const toolUpdates = events.filter(
      (e): e is SessionNotification & {
        update: Extract<SessionUpdate, { sessionUpdate: "tool_call_update" }>;
      } =>
        e.update.sessionUpdate === "tool_call_update" &&
        e.update.toolCallId === toolStarts[0]?.update.toolCallId,
    );

    expect(toolStarts.length).toBeGreaterThan(0);
    expect(toolUpdates.length).toBeGreaterThan(0);
    expect(toolUpdates.some((e) => e.update.status === "completed")).toBe(true);
    expect(
      toolUpdates.some((e) =>
        e.update.content?.some((item) =>
          item.type === "content" &&
          item.content.type === "text" &&
          item.content.text.includes("codex-acp-bash-update-ok"),
        ),
      ),
    ).toBe(true);
  }, 120_000);

  it("injects stdio mcpServers into codex config.toml and cleans up on close", async () => {
    const testSocketPath = getMcpSocketPath("bridge-mcp-test");
    const mcpServer = new McpSocketServer();
    mcpServer.setImplementation(
      defineTools({
        bridge_test_ping: {
          description: "Test ping from bridge test",
          input: z.object({}),
          handler: async () => ({
            content: [{ type: "text" as const, text: "bridge-pong" }],
          }),
        },
      }),
    );
    await mcpServer.listen(testSocketPath);

    try {
      const proxyPath = writeProxyScript(testSocketPath);

      client = await createBridgeClient();
      await client.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
        clientInfo: { name: "mcp-test", version: "0.0.1" },
      });

      await client.newSession({
        cwd: process.cwd(),
        mcpServers: [
          {
            type: "stdio",
            name: "zenbu-tools",
            command: "node",
            args: [proxyPath],
            env: [],
          },
        ] as unknown as McpServer[],
      });

      const configContent = readFileSync(CODEX_CONFIG_PATH, "utf-8");
      expect(configContent).toContain("[mcp_servers.zenbu-tools]");

      await client.close();
      await new Promise((r) => setTimeout(r, 500));

      const afterClose = readFileSync(CODEX_CONFIG_PATH, "utf-8");
      expect(afterClose).not.toContain("[mcp_servers.zenbu-tools]");
    } finally {
      await mcpServer.close();
    }
  });
});
