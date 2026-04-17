import { z } from "zod";
import { Agent } from "@zenbu/agent/src/agent";
import { McpSocketServer } from "@zenbu/agent/src/mcp/server";
import { getMcpSocketPath } from "@zenbu/agent/src/mcp/socket-path";
import { defineTools, type ToolDef } from "@zenbu/agent/src/mcp/tools";
import { Service, runtime } from "../runtime";
import { AgentService } from "./agent";

export class ToolService extends Service {
  static key = "tool";
  static deps = { agent: AgentService };
  declare ctx: { agent: AgentService };

  private servers = new Map<string, McpSocketServer>();
  private externalTools = new Map<string, { def: ToolDef<any>; remove: () => void }>();

  addTool(name: string, def: ToolDef<any>): () => void {
    const remove = () => {
      this.externalTools.delete(name);
      this.refreshImplementation();
    };
    this.externalTools.set(name, { def, remove });
    this.refreshImplementation();
    return remove;
  }

  private buildImplementation() {
    const tools: Record<string, ToolDef<any>> = {
      ping: {
        description: "Ping the Zenbu application",
        input: z.object({}),
        handler: async () => ({
          content: [{ type: "text" as const, text: "pong" }],
        }),
      },
      calculator: {
        description: "Evaluate a basic arithmetic expression (add, subtract, multiply, divide)",
        input: z.object({
          expression: z.string().describe("An arithmetic expression like '2 + 3 * 4'"),
        }),
        handler: async ({ expression }) => {
          try {
            const sanitized = expression.replace(/[^0-9+\-*/().  ]/g, "");
            const result = new Function(`return (${sanitized})`)();
            return {
              content: [{ type: "text" as const, text: String(result) }],
            };
          } catch (e: any) {
            return {
              content: [{ type: "text" as const, text: `Error: ${e.message}` }],
              isError: true,
            };
          }
        },
      },
    };

    for (const [name, { def }] of this.externalTools) {
      tools[name] = def;
    }

    return defineTools(tools);
  }

  private refreshImplementation() {
    const impl = this.buildImplementation();
    for (const server of this.servers.values()) {
      server.setImplementation(impl);
    }
  }

  private async bindServer(agentId: string, socketPath: string, impl: ReturnType<typeof defineTools>) {
    const server = new McpSocketServer();
    server.setImplementation(impl, () => ({
      agentId,
      agent: this.ctx.agent.getProcess(agentId),
    }));
    await server.listen(socketPath);
    this.servers.set(agentId, server);
  }

  evaluate() {
    const impl = this.buildImplementation();

    for (const server of this.servers.values()) {
      server.setImplementation(impl);
    }

    for (const agentId of this.ctx.agent.getActiveAgentIds()) {
      if (!this.servers.has(agentId)) {
        const socketPath = getMcpSocketPath(agentId);
        this.bindServer(agentId, socketPath, impl).catch((e) =>
          console.error(`[tool] failed to rebind socket for ${agentId}:`, e),
        );
      }
    }

    const unsubCreate = Agent.onBeforeCreate(async (agentId, socketPath) => {
      await this.bindServer(agentId, socketPath, this.buildImplementation());
    });

    const unsubDestroy = Agent.onDestroy((agentId) => {
      const server = this.servers.get(agentId);
      if (server) {
        server.close().catch(() => {});
        this.servers.delete(agentId);
      }
    });

    this.effect("tool-cleanup", () => {
      return async (reason) => {
        unsubCreate();
        unsubDestroy();
        if (reason !== "reload") {
          for (const server of this.servers.values()) {
            await server.close().catch(() => {});
          }
          this.servers.clear();
        }
      };
    });
  }
}

runtime.register(ToolService, (import.meta as any).hot);
