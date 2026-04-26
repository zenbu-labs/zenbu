import * as acp from "@agentclientprotocol/sdk";
import { Readable, Writable } from "node:stream";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  createCodexTransport,
  type CodexTransport,
} from "./codex-transport.ts";
import type { ModelListResponse } from "../generated/v2/ModelListResponse.ts";
import type { ThreadStartResponse } from "../generated/v2/ThreadStartResponse.ts";
import type { TurnStartResponse } from "../generated/v2/TurnStartResponse.ts";
import type { TurnCompletedNotification } from "../generated/v2/TurnCompletedNotification.ts";
import type { AgentMessageDeltaNotification } from "../generated/v2/AgentMessageDeltaNotification.ts";
import type { ReasoningTextDeltaNotification } from "../generated/v2/ReasoningTextDeltaNotification.ts";
import type { ReasoningSummaryTextDeltaNotification } from "../generated/v2/ReasoningSummaryTextDeltaNotification.ts";
import type { TurnPlanUpdatedNotification } from "../generated/v2/TurnPlanUpdatedNotification.ts";
import type { ItemStartedNotification } from "../generated/v2/ItemStartedNotification.ts";
import type { ItemCompletedNotification } from "../generated/v2/ItemCompletedNotification.ts";
import type { CommandExecutionRequestApprovalParams } from "../generated/v2/CommandExecutionRequestApprovalParams.ts";
import type { FileChangeRequestApprovalParams } from "../generated/v2/FileChangeRequestApprovalParams.ts";
import type { CommandExecutionOutputDeltaNotification } from "../generated/v2/CommandExecutionOutputDeltaNotification.ts";
import type { ThreadItem } from "../generated/v2/ThreadItem.ts";
import type { UserInput } from "../generated/v2/UserInput.ts";

const CODEX_CONFIG_PATH = join(homedir(), ".codex", "config.toml");

type McpServerStdioEntry = {
  name: string;
  command: string;
  args?: string[];
  env?: Array<{ name: string; value: string }>;
  [key: string]: unknown;
};

function isMcpStdio(server: acp.McpServer): server is acp.McpServer & McpServerStdioEntry {
  return typeof (server as { command?: unknown }).command === "string";
}

function appendMcpServersToConfig(servers: McpServerStdioEntry[]): string[] {
  const dir = join(homedir(), ".codex");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let toml = "";
  if (existsSync(CODEX_CONFIG_PATH)) {
    toml = readFileSync(CODEX_CONFIG_PATH, "utf-8");
  }

  const names: string[] = [];
  for (const server of servers) {
    const name = server.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    names.push(name);

    const sectionHeader = `[mcp_servers.${name}]`;
    if (toml.includes(sectionHeader)) continue;

    const lines = [`\n${sectionHeader}`];
    lines.push(`command = ${JSON.stringify(server.command)}`);
    if (server.args && server.args.length > 0) {
      lines.push(`args = [${server.args.map((a) => JSON.stringify(a)).join(", ")}]`);
    }
    if (server.env && server.env.length > 0) {
      lines.push(`[mcp_servers.${name}.env]`);
      for (const e of server.env) {
        lines.push(`${e.name} = ${JSON.stringify(e.value)}`);
      }
    }
    toml += lines.join("\n") + "\n";
  }

  writeFileSync(CODEX_CONFIG_PATH, toml, "utf-8");
  return names;
}

function removeMcpServersFromConfig(names: string[]): void {
  if (!existsSync(CODEX_CONFIG_PATH)) return;
  const lines = readFileSync(CODEX_CONFIG_PATH, "utf-8").split("\n");
  const sectionHeaders = new Set(
    names.map((n) => `[mcp_servers.${n}]`),
  );
  const envHeaders = new Set(
    names.map((n) => `[mcp_servers.${n}.env]`),
  );

  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      skipping = sectionHeaders.has(trimmed) || envHeaders.has(trimmed);
    }
    if (!skipping) result.push(line);
  }

  writeFileSync(CODEX_CONFIG_PATH, result.join("\n"), "utf-8");
}

function stripShellWrapper(command: string): string {
  const match = command.match(
    /^\/(?:bin|usr\/bin)\/(?:zsh|bash|sh)\s+-\w*c\s+([\s\S]+)$/,
  );
  if (!match) return command;
  let inner = match[1].trim();
  if (
    (inner.startsWith("'") && inner.endsWith("'")) ||
    (inner.startsWith('"') && inner.endsWith('"'))
  ) {
    inner = inner.slice(1, -1);
  }
  return inner;
}

export function createBridge(opts?: { noLoadSession?: boolean }) {
  let codex: CodexTransport | null = null;
  let threadId: string | null = null;
  let currentTurnId: string | null = null;
  let currentModel: string | null = null;
  let currentEffort: string | null = null;
  let currentMode: string = "bypassPermissions";
  let injectedMcpNames: string[] = [];

  const MODE_OPTIONS = [
    { value: "bypassPermissions", name: "Bypass Permissions", description: "Bypass all permission checks" },
    { value: "default", name: "Default", description: "Standard behavior, prompts for dangerous operations" },
    { value: "plan", name: "Plan Mode", description: "Planning mode, no actual tool execution" },
  ] as const;

  type ModeId = (typeof MODE_OPTIONS)[number]["value"];

  const modeToApprovalPolicy: Record<ModeId, string> = {
    bypassPermissions: "never",
    default: "on-failure",
    plan: "never",
  };

  class CodexAcpAgent implements acp.Agent {
    private conn: acp.AgentSideConnection;

    constructor(conn: acp.AgentSideConnection) {
      this.conn = conn;
    }

    async initialize(
      params: acp.InitializeRequest,
    ): Promise<acp.InitializeResponse> {
      codex = await createCodexTransport();
      setupCodexListeners(codex, this.conn);

      await codex.sendRequest("initialize", {
        clientInfo: {
          name: "codex-acp-bridge",
          title: "Codex ACP Bridge",
          version: "0.0.1",
        },
        capabilities: {
          experimentalApi: true,
        },
      });
      codex.sendNotification("initialized");

      return {
        protocolVersion: acp.PROTOCOL_VERSION,
        agentCapabilities: {
          loadSession: !opts?.noLoadSession,
          promptCapabilities: { embeddedContext: true },
        },
        agentInfo: {
          name: "codex-acp",
          title: "Codex (via ACP bridge)",
          version: "0.0.1",
        },
        authMethods: [
          {
            id: "codex_login",
            name: "Codex Login",
            description: "Authenticate using the Codex CLI. Run 'codex auth login' first if not logged in.",
          },
        ],
      };
    }

    async newSession(
      params: acp.NewSessionRequest,
    ): Promise<acp.NewSessionResponse> {
      if (!codex) throw new Error("Not initialized");

      const stdioServers = (params.mcpServers ?? []).filter(isMcpStdio);
      if (stdioServers.length > 0) {
        injectedMcpNames = appendMcpServersToConfig(stdioServers);
        await codex.sendRequest("config/mcpServer/reload", {});
      }

      const models = await codex.sendRequest<ModelListResponse>("model/list", {
        limit: 50,
      });
      const defaultModel =
        models.data.find((m) => m.isDefault)?.id ?? "o4-mini";
      currentModel = defaultModel;

      const defaultModelData = models.data.find((m) => m.isDefault);
      currentEffort = defaultModelData?.defaultReasoningEffort ?? null;

      const result = await codex.sendRequest<ThreadStartResponse>(
        "thread/start",
        {
          model: defaultModel,
          cwd: params.cwd ?? process.cwd(),
          approvalPolicy: modeToApprovalPolicy[currentMode as ModeId] ?? "never",
          sandbox: "danger-full-access",
          persistExtendedHistory: true,
        },
      );

      threadId = result.thread.id;

      const reasoningLabel = (effort: string) =>
        effort
          .split(/[-_]/)
          .filter(Boolean)
          .map((w) =>
            w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w,
          )
          .join(" ");

      const configOptions = [
        {
          id: "mode",
          name: "Mode",
          description: "Session permission mode",
          category: "mode",
          type: "select" as const,
          currentValue: currentMode,
          options: MODE_OPTIONS.map((m) => ({
            value: m.value,
            name: m.name,
            description: m.description,
          })),
        },
        {
          id: "model",
          name: "Model",
          category: "model",
          type: "select" as const,
          currentValue: defaultModel,
          options: models.data
            .filter((m) => !m.hidden)
            .map((m) => ({ value: m.id, name: m.displayName })),
        },
        ...(defaultModelData?.supportedReasoningEfforts.length
          ? [
              {
                id: "reasoning_effort",
                name: "Thinking",
                category: "thought_level",
                type: "select" as const,
                currentValue: defaultModelData.defaultReasoningEffort,
                options: defaultModelData.supportedReasoningEfforts.map(
                  (opt) => {
                    const name = reasoningLabel(opt.reasoningEffort);
                    const desc = opt.description?.trim();
                    return {
                      value: opt.reasoningEffort,
                      name,
                      ...(desc && desc !== name ? { description: desc } : {}),
                    };
                  },
                ),
              },
            ]
          : []),
      ];

      return { sessionId: threadId, configOptions };
    }

    async loadSession(
      params: acp.LoadSessionRequest,
    ): Promise<acp.LoadSessionResponse> {
      if (!codex) throw new Error("Not initialized");

      const stdioServers = (params.mcpServers ?? []).filter(isMcpStdio);
      if (stdioServers.length > 0) {
        injectedMcpNames = appendMcpServersToConfig(stdioServers);
        await codex.sendRequest("config/mcpServer/reload", {});
      }

      threadId = params.sessionId;
      await codex.sendRequest("thread/resume", {
        threadId: params.sessionId,
        cwd: params.cwd ?? process.cwd(),
        persistExtendedHistory: true,
      });

      return undefined as unknown as acp.LoadSessionResponse;
    }

    async unstable_resumeSession(
      params: { sessionId: string; cwd: string; mcpServers?: acp.McpServer[] },
    ): Promise<Record<string, never>> {
      if (!codex) throw new Error("Not initialized");

      const stdioServers = (params.mcpServers ?? []).filter(isMcpStdio);
      if (stdioServers.length > 0) {
        injectedMcpNames = appendMcpServersToConfig(stdioServers);
        await codex.sendRequest("config/mcpServer/reload", {});
      }

      threadId = params.sessionId;
      await codex.sendRequest("thread/resume", {
        threadId: params.sessionId,
        cwd: params.cwd ?? process.cwd(),
        persistExtendedHistory: true,
      });

      return {};
    }

    async prompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
      if (!codex || !threadId) throw new Error("No active session");

      const input: UserInput[] = params.prompt.map((block) => {
        if (block.type === "text") {
          return { type: "text" as const, text: block.text, text_elements: [] };
        }
        if (block.type === "resource") {
          const resourceText =
            "text" in block.resource ? block.resource.text : "";
          return {
            type: "text" as const,
            text: `[File: ${block.resource.uri}]\n${resourceText}`,
            text_elements: [],
          };
        }
        return {
          type: "text" as const,
          text: JSON.stringify(block),
          text_elements: [],
        };
      });

      const turnDone = new Promise<acp.PromptResponse>((resolve) => {
        const unsub = codex!.onNotification((method, params) => {
          if (method === "turn/completed") {
            unsub();
            currentTurnId = null;
            const notification = params as TurnCompletedNotification;
            resolve({
              stopReason: translateTurnStatus(notification.turn.status),
            });
          }
        });
      });

      const startResponse = await codex.sendRequest<TurnStartResponse>(
        "turn/start",
        {
          threadId,
          input,
          ...(currentModel ? { model: currentModel } : {}),
          ...(currentEffort ? { effort: currentEffort } : {}),
          approvalPolicy: modeToApprovalPolicy[currentMode as ModeId] ?? "never",
        },
      );
      currentTurnId = startResponse.turn.id;

      return turnDone;
    }

    async cancel(): Promise<void> {
      if (codex && threadId && currentTurnId) {
        await codex
          .sendRequest("turn/interrupt", { threadId, turnId: currentTurnId })
          .catch(() => {});
      }
    }

    async authenticate(): Promise<acp.AuthenticateResponse> {
      return {};
    }

    async setSessionMode(): Promise<acp.SetSessionModeResponse> {
      return {};
    }

    async setSessionConfigOption(
      params: acp.SetSessionConfigOptionRequest,
    ): Promise<acp.SetSessionConfigOptionResponse> {
      if (params.configId === "model" && typeof params.value === "string") {
        currentModel = params.value;
      } else if (
        params.configId === "reasoning_effort" &&
        typeof params.value === "string"
      ) {
        currentEffort = params.value;
      } else if (
        params.configId === "mode" &&
        typeof params.value === "string"
      ) {
        currentMode = params.value;
      }
      return { configOptions: [] };
    }
  }

  const input = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>;
  const output = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
  const stream = acp.ndJsonStream(input, output);

  new acp.AgentSideConnection((conn) => new CodexAcpAgent(conn), stream);

  function setupCodexListeners(
    codex: CodexTransport,
    conn: acp.AgentSideConnection,
  ): void {
    codex.onNotification((method, params) => {
      if (!threadId) return;

      switch (method) {
        case "item/agentMessage/delta": {
          const notification = params as AgentMessageDeltaNotification;
          conn.sessionUpdate({
            sessionId: threadId,
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: notification.delta },
            },
          });
          break;
        }

        case "item/reasoning/summaryTextDelta": {
          const notification = params as ReasoningSummaryTextDeltaNotification;
          conn.sessionUpdate({
            sessionId: threadId,
            update: {
              sessionUpdate: "agent_thought_chunk",
              content: { type: "text", text: notification.delta },
            },
          });
          break;
        }

        case "item/reasoning/textDelta": {
          const notification = params as ReasoningTextDeltaNotification;
          conn.sessionUpdate({
            sessionId: threadId,
            update: {
              sessionUpdate: "agent_thought_chunk",
              content: { type: "text", text: notification.delta },
            },
          });
          break;
        }

        case "turn/plan/updated": {
          const notification = params as TurnPlanUpdatedNotification;
          conn.sessionUpdate({
            sessionId: threadId,
            update: {
              sessionUpdate: "plan",
              entries: notification.plan.map((step) => ({
                content: step.step,
                priority: "medium" as const,
                status:
                  step.status === "inProgress"
                    ? ("in_progress" as const)
                    : step.status,
              })),
            },
          });
          break;
        }

        case "item/commandExecution/outputDelta": {
          const notification =
            params as CommandExecutionOutputDeltaNotification;
          conn.sessionUpdate({
            sessionId: threadId,
            update: {
              sessionUpdate: "tool_call_update",
              toolCallId: notification.itemId,
              content: [
                {
                  type: "content",
                  content: { type: "text", text: notification.delta },
                },
              ],
            },
          });
          break;
        }

        case "item/started": {
          const notification = params as ItemStartedNotification;
          translateItemToUpdate(conn, threadId, notification.item, "started");
          break;
        }

        case "item/completed": {
          const notification = params as ItemCompletedNotification;
          translateItemToUpdate(conn, threadId, notification.item, "completed");
          break;
        }
      }
    });

    codex.onServerRequest((method, id, params) => {
      if (method === "item/commandExecution/requestApproval") {
        const approval = params as CommandExecutionRequestApprovalParams;
        conn
          .requestPermission({
            sessionId: threadId!,
            toolCall: {
              toolCallId: approval.itemId,
              title: stripShellWrapper(approval.command ?? "Command execution"),
              kind: "execute",
              status: "pending",
            },
            options: [
              { optionId: "allow", name: "Allow", kind: "allow_once" },
              { optionId: "reject", name: "Reject", kind: "reject_once" },
            ],
          })
          .then((result) => {
            const accepted =
              result.outcome.outcome === "selected" &&
              result.outcome.optionId === "allow";
            codex!.respondToServerRequest(id, {
              decision: accepted ? "acceptForSession" : "decline",
            });
          });
      } else if (method === "item/fileChange/requestApproval") {
        const approval = params as FileChangeRequestApprovalParams;
        conn
          .requestPermission({
            sessionId: threadId!,
            toolCall: {
              toolCallId: approval.itemId,
              title: "File change",
              kind: "edit",
              status: "pending",
            },
            options: [
              { optionId: "allow", name: "Allow", kind: "allow_once" },
              { optionId: "reject", name: "Reject", kind: "reject_once" },
            ],
          })
          .then((result) => {
            const accepted =
              result.outcome.outcome === "selected" &&
              result.outcome.optionId === "allow";
            codex!.respondToServerRequest(id, {
              decision: accepted ? "acceptForSession" : "decline",
            });
          });
      } else {
        codex!.respondToServerRequest(id, { decision: "accept" });
      }
    });
  }

  function translateItemToUpdate(
    conn: acp.AgentSideConnection,
    sessionId: string,
    item: ThreadItem,
    lifecycle: "started" | "completed",
  ): void {
    const sessionUpdate =
      lifecycle === "started" ? "tool_call" : "tool_call_update";
    const status = translateToolStatus(
      "status" in item && typeof item.status === "string"
        ? item.status
        : undefined,
    );

    switch (item.type) {
      case "userMessage":
      case "agentMessage":
        break;

      case "commandExecution": {
        const content: acp.ToolCallContent[] = [];
        if (item.aggregatedOutput) {
          content.push({
            type: "content",
            content: { type: "text", text: item.aggregatedOutput },
          });
        }
        conn.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate,
            toolCallId: item.id,
            title: stripShellWrapper(item.command),
            kind: "execute",
            status,
            ...(content.length > 0 ? { content } : {}),
          },
        });
        break;
      }

      case "fileChange": {
        const title =
          item.changes.length > 0
            ? item.changes.map((c) => c.path).join(", ")
            : "File change";
        const content: acp.ToolCallContent[] = item.changes.map((change) => ({
          type: "diff" as const,
          path: change.path,
          newText: change.diff,
        }));
        conn.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate,
            toolCallId: item.id,
            title,
            kind: "edit",
            status,
            ...(content.length > 0 ? { content } : {}),
          },
        });
        break;
      }

      case "mcpToolCall": {
        const mcpContent: acp.ToolCallContent[] = [];
        if (item.result) {
          const text =
            typeof item.result === "string"
              ? item.result
              : JSON.stringify(item.result);
          mcpContent.push({
            type: "content",
            content: { type: "text", text },
          });
        }
        if (item.error) {
          mcpContent.push({
            type: "content",
            content: {
              type: "text",
              text: `Error: ${typeof item.error === "string" ? item.error : JSON.stringify(item.error)}`,
            },
          });
        }
        conn.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate,
            toolCallId: item.id,
            title: `${item.server}/${item.tool}`,
            kind: "execute",
            status,
            ...(mcpContent.length > 0 ? { content: mcpContent } : {}),
          },
        });
        break;
      }
    }
  }

  function translateTurnStatus(status: string): acp.StopReason {
    switch (status) {
      case "interrupted":
        return "cancelled";
      case "failed":
        return "refusal";
      default:
        return "end_turn";
    }
  }

  function translateToolStatus(status: string | undefined): acp.ToolCallStatus {
    switch (status) {
      case "completed":
        return "completed";
      case "failed":
      case "declined":
        return "failed";
      default:
        return "in_progress";
    }
  }

  return {
    close() {
      if (injectedMcpNames.length > 0) {
        removeMcpServersFromConfig(injectedMcpNames);
        injectedMcpNames = [];
      }
      codex?.close();
    },
  };
}
