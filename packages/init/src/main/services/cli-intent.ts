import path from "node:path";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import { makeCollection } from "@zenbu/kyju/schema";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";

function parseZenArgs(argv: string[]): {
  agent?: string;
  agentId?: string;
  cwd?: string;
} {
  const result: { agent?: string; agentId?: string; cwd?: string } = {};
  for (const arg of argv) {
    if (arg.startsWith("--zen-agent-id=")) {
      result.agentId = arg.slice("--zen-agent-id=".length);
    } else if (arg.startsWith("--zen-agent=")) {
      result.agent = arg.slice("--zen-agent=".length);
    } else if (arg.startsWith("--zen-cwd=")) {
      result.cwd = arg.slice("--zen-cwd=".length);
    }
  }
  return result;
}

function matchAgentConfig(
  configs: Array<{ id: string; name: string; startCommand: string }>,
  query: string,
): { id: string; name: string; startCommand: string } | undefined {
  const q = query.toLowerCase();
  return (
    configs.find((c) => c.id.toLowerCase() === q) ??
    configs.find((c) => c.name.toLowerCase() === q) ??
    configs.find((c) => c.id.toLowerCase().startsWith(q))
  );
}

export class CliIntentService extends Service {
  static key = "cli-intent";
  static deps = { db: DbService, baseWindow: "base-window" };
  declare ctx: { db: DbService; baseWindow: any };

  private _processed = false;

  evaluate() {
    if (this._processed) return;

    const { agent, agentId: existingAgentId, cwd } = parseZenArgs(process.argv);
    if (!agent && !existingAgentId && !cwd) return;

    this._processed = true;

    const client = this.ctx.db.client;

    Effect.runPromise(
      client.update((root) => {
        const kernel = root.plugin.kernel;

        if (cwd) {
          const existing = (kernel.workspaces ?? []).find(
            (w) => w.cwd === cwd,
          );
          if (existing) {
            kernel.activeWorkspaceId = existing.id;
          } else {
            const id = nanoid();
            kernel.workspaces = [
              ...(kernel.workspaces ?? []),
              {
                id,
                name: path.basename(cwd),
                cwd,
                pinnedAgentIds: [],
                contextFiles: [],
              },
            ];
            kernel.activeWorkspaceId = id;
          }
        }

        if (existingAgentId) {
          const existingAgent = (kernel.agents ?? []).find((a) => a.id === existingAgentId);
          if (!existingAgent) {
            console.warn(`[cli-intent] No agent with id "${existingAgentId}"`);
            return;
          }

          const sessionId = nanoid();
          const firstWindowId = [...this.ctx.baseWindow.windows.keys()][0] ?? nanoid();
          kernel.windowStates = [
            ...(kernel.windowStates ?? []),
            {
              id: firstWindowId,
              sessions: [{ id: sessionId, agentId: existingAgentId }],
              panes: [],
              rootPaneId: null,
              focusedPaneId: null,
              sidebarOpen: false,
              tabSidebarOpen: true,
              sidebarPanel: "overview",
            },
          ];
        } else if (agent) {
          const configs = kernel.agentConfigs ?? [];
          const matched = matchAgentConfig(configs, agent);
          if (!matched) {
            const names = configs.map((c) => c.name).join(", ");
            console.warn(
              `[cli-intent] No agent config matching "${agent}". Available: ${names || "(none)"}`,
            );
            return;
          }

          kernel.selectedConfigId = matched.id;

          const agentId = nanoid();
          const sessionId = nanoid();
          kernel.agents = [
            ...(kernel.agents ?? []),
            {
              id: agentId,
              name: matched.name,
              startCommand: matched.startCommand,
              configId: matched.id,
              status: "idle" as const,
              metadata: { workspaceId: kernel.activeWorkspaceId },
              eventLog: makeCollection({ collectionId: nanoid(), debugName: "eventLog" }),
            },
          ];

          const firstWindowId = [...this.ctx.baseWindow.windows.keys()][0] ?? nanoid();
          kernel.windowStates = [
            ...(kernel.windowStates ?? []),
            {
              id: firstWindowId,
              sessions: [{ id: sessionId, agentId }],
              panes: [],
              rootPaneId: null,
              focusedPaneId: null,
              sidebarOpen: false,
              tabSidebarOpen: true,
              sidebarPanel: "overview",
            },
          ];

          const ws = (kernel.workspaces ?? []).find(
            (w) => w.id === kernel.activeWorkspaceId,
          );
          if (ws) {
            ws.lastSelectedAgentId = agentId;
          }
        }
      }),
    ).catch((err) => {
      console.error("[cli-intent] Failed to apply CLI intent:", err);
    });

    console.log(
      `[cli-intent] applied${agent ? ` agent=${agent}` : ""}${existingAgentId ? ` agentId=${existingAgentId}` : ""}${cwd ? ` cwd=${cwd}` : ""}`,
    );
  }
}

runtime.register(CliIntentService, (import.meta as any).hot);
