import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentProvider, AgentSession, PromptOptions } from "./types.ts";
import { createTransport, type JsonRpcTransport } from "./protocol.ts";

const execAsync = promisify(exec);

export class CodexProvider implements AgentProvider {
  readonly name = "codex" as const;

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync("which codex");
      return true;
    } catch {
      return false;
    }
  }

  async createSession(): Promise<AgentSession> {
    const transport = createTransport({
      command: "codex",
      args: ["app-server"],
    });

    await transport.sendRequest("initialize", {
      clientInfo: {
        name: "puter_cli",
        title: "Puter CLI",
        version: "0.0.1",
      },
    });
    transport.sendNotification("initialized");

    const models = await transport.sendRequest("model/list", { limit: 50 });
    const defaultModel =
      models.data?.find((m: any) => m.isDefault)?.id ?? "o4-mini";

    const threadResult = await transport.sendRequest("thread/start", {
      model: defaultModel,
      cwd: process.cwd(),
      approvalPolicy: "never",
      sandbox: "workspace-write",
    });
    const threadId = threadResult.thread.id as string;

    return new CodexSession(transport, threadId);
  }
}

class CodexSession implements AgentSession {
  constructor(
    private transport: JsonRpcTransport,
    private threadId: string
  ) {}

  async prompt(text: string, opts?: PromptOptions): Promise<string> {
    let accumulated = "";

    const done = new Promise<string>((resolve, reject) => {
      const unsub = this.transport.onNotification((method, params) => {
        if (
          method === "item/agentMessage/delta" ||
          method === "codex/event/agent_message_content_delta"
        ) {
          const chunk = params.delta ?? params.content ?? "";
          accumulated += chunk;
          opts?.onDelta?.(chunk, accumulated);
        } else if (method === "turn/completed") {
          unsub();
          if (params?.turn?.error) {
            reject(new Error(JSON.stringify(params.turn.error)));
          } else {
            resolve(accumulated);
          }
        }
      });

      this.transport
        .sendRequest("turn/start", {
          threadId: this.threadId,
          input: [{ type: "text", text }],
        })
        .catch(reject);
    });

    return done;
  }

  close(): void {
    this.transport.close();
  }
}

export const codexMessageShapes = {
  initialize(clientName: string) {
    return {
      method: "initialize",
      params: {
        clientInfo: {
          name: clientName,
          title: "Puter CLI",
          version: "0.0.1",
        },
      },
    };
  },
  initialized() {
    return { method: "initialized", params: {} };
  },
  threadStart(model: string, cwd: string) {
    return {
      method: "thread/start",
      params: {
        model,
        cwd,
        approvalPolicy: "never",
        sandbox: "workspace-write",
      },
    };
  },
  turnStart(threadId: string, text: string) {
    return {
      method: "turn/start",
      params: {
        threadId,
        input: [{ type: "text", text }],
      },
    };
  },
} as const;
