import { z } from "zod";
import { Agent } from "@zenbu/agent/src/agent";
import { McpSocketServer } from "@zenbu/agent/src/mcp/server";
import { getMcpSocketPath } from "@zenbu/agent/src/mcp/socket-path";
import { defineTools, type ToolDef } from "@zenbu/agent/src/mcp/tools";
import { Service, runtime } from "../runtime";
import { AgentService } from "./agent";
import { DbService } from "./db";

interface ExternalToolEntry {
  def: ToolDef<any>;
  workspaceId?: string;
}

const builtinTools: Record<string, ToolDef<any>> = {
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

export class ToolService extends Service {
  static key = "tool";
  static deps = { agent: AgentService, db: DbService };
  declare ctx: { agent: AgentService; db: DbService };

  private servers = new Map<string, McpSocketServer>();
  private externalTools = new Map<string, ExternalToolEntry>();

  addTool(name: string, def: ToolDef<any>): () => void {
    const wsId = runtime.getActiveScope() ?? undefined;
    const key = wsId ? `${name}@@${wsId}` : name;
    this.externalTools.set(key, { def, workspaceId: wsId });
    this.refreshImplementation();

    return () => {
      this.externalTools.delete(key);
      this.refreshImplementation();
    };
  }

  private buildImplementation(agentWorkspaceId?: string) {
    const tools: Record<string, ToolDef<any>> = { ...builtinTools };

    for (const [key, { def, workspaceId }] of this.externalTools) {
      if (!workspaceId || workspaceId === agentWorkspaceId) {
        const name = key.includes("@@") ? key.split("@@")[0] : key;
        tools[name] = def;
      }
    }

    return defineTools(tools);
  }

  private getAgentWorkspaceId(agentId: string): string | undefined {
    const agents = this.ctx.db.client.readRoot().plugin.kernel.agents ?? [];
    const agent = agents.find((a: any) => a.id === agentId);
    return agent?.workspaceId;
  }

  private refreshImplementation() {
    for (const [agentId, server] of this.servers) {
      const wsId = this.getAgentWorkspaceId(agentId);
      server.setImplementation(this.buildImplementation(wsId));
    }
  }

  private async bindServer(agentId: string, socketPath: string) {
    const wsId = this.getAgentWorkspaceId(agentId);
    const impl = this.buildImplementation(wsId);
    const server = new McpSocketServer();
    server.setImplementation(impl, () => ({
      agentId,
      agent: this.ctx.agent.getProcess(agentId),
    }));
    await server.listen(socketPath);
    this.servers.set(agentId, server);
  }

  evaluate() {
    this.refreshImplementation();

    for (const agentId of this.ctx.agent.getActiveAgentIds()) {
      if (!this.servers.has(agentId)) {
        const socketPath = getMcpSocketPath(agentId);
        this.bindServer(agentId, socketPath).catch((e) =>
          console.error(`[tool] failed to rebind socket for ${agentId}:`, e),
        );
      }
    }

    const unsubCreate = Agent.onBeforeCreate(async (agentId, socketPath) => {
      await this.bindServer(agentId, socketPath);
    });

    const unsubDestroy = Agent.onDestroy((agentId) => {
      const server = this.servers.get(agentId);
      if (server) {
        server.close().catch(() => {});
        this.servers.delete(agentId);
      }
    });

    this.setup("tool-cleanup", () => {
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
