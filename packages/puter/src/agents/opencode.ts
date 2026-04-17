import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentProvider, AgentSession, PromptOptions } from "./types.ts";
import { createTransport, type JsonRpcTransport } from "./protocol.ts";

const execAsync = promisify(exec);

export class OpenCodeProvider implements AgentProvider {
  readonly name = "opencode" as const;

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync("which opencode");
      return true;
    } catch {
      return false;
    }
  }

  async createSession(): Promise<AgentSession> {
    const transport = createTransport({
      command: "opencode",
      args: ["acp"],
    });

    await transport.sendRequest("initialize", {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: {
        name: "puter_cli",
        title: "Puter CLI",
        version: "0.0.1",
      },
    });

    const sessionResult = await transport.sendRequest("session/new", {});
    const sessionId = sessionResult.sessionId as string;

    return new OpenCodeSession(transport, sessionId);
  }
}

class OpenCodeSession implements AgentSession {
  constructor(
    private transport: JsonRpcTransport,
    private sessionId: string
  ) {}

  async prompt(text: string, opts?: PromptOptions): Promise<string> {
    let accumulated = "";

    const unsub = this.transport.onNotification((method, params) => {
      if (method === "session/update") {
        const update = params?.update;
        if (update?.sessionUpdate === "agent_message_chunk") {
          const content = update.content;
          if (content?.type === "text") {
            const chunk = content.text ?? "";
            accumulated += chunk;
            opts?.onDelta?.(chunk, accumulated);
          }
        }
      }
    });

    try {
      await this.transport.sendRequest("session/prompt", {
        sessionId: this.sessionId,
        prompt: [{ type: "text", text }],
      });
    } finally {
      unsub();
    }

    return accumulated;
  }

  close(): void {
    this.transport.close();
  }
}

export const acpMessageShapes = {
  initialize(clientName: string) {
    return {
      jsonrpc: "2.0" as const,
      method: "initialize",
      params: {
        protocolVersion: 1,
        clientCapabilities: {},
        clientInfo: {
          name: clientName,
          title: "Puter CLI",
          version: "0.0.1",
        },
      },
    };
  },
  sessionNew() {
    return {
      jsonrpc: "2.0" as const,
      method: "session/new",
      params: {},
    };
  },
  sessionPrompt(sessionId: string, text: string) {
    return {
      jsonrpc: "2.0" as const,
      method: "session/prompt",
      params: {
        sessionId,
        prompt: [{ type: "text", text }],
      },
    };
  },
  sessionCancel(sessionId: string) {
    return {
      jsonrpc: "2.0" as const,
      method: "session/cancel",
      params: { sessionId },
    };
  },
} as const;
