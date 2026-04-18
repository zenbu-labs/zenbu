import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import { makeCollection } from "@zenbu/kyju/schema";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";
import { insertHotAgent, type ArchivedAgent } from "../../../shared/agent-ops";

const DEFAULT_CWD = path.join(os.homedir(), ".zenbu");

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

    const { agent, agentId: explicitAgentId, cwd } = parseZenArgs(process.argv);

    this._processed = true;

    const client = this.ctx.db.client;

    // When nothing was passed on the CLI (spotlight/dock open), fall back to
    // the last agent the user interacted with. If none exists, create a fresh
    // agent from the selected config — same behavior as `zen` with no args.
    let existingAgentId = explicitAgentId;
    let fallbackToNewAgent = false;
    if (!agent && !existingAgentId && !cwd) {
      const kernel = client.readRoot().plugin.kernel;
      const lastAgent = kernel.agents
        .filter((a) => a.lastUserMessageAt != null)
        .sort(
          (a, b) => (b.lastUserMessageAt ?? 0) - (a.lastUserMessageAt ?? 0),
        )[0];
      if (lastAgent) {
        existingAgentId = lastAgent.id;
      } else {
        fallbackToNewAgent = true;
      }
    }

    let evicted: ArchivedAgent[] = [];

    Effect.runPromise(
      client.update((root) => {
        const kernel = root.plugin.kernel;

        if (existingAgentId) {
          const existingAgent = kernel.agents.find(
            (a) => a.id === existingAgentId,
          );
          if (!existingAgent) {
            console.warn(`[cli-intent] No agent with id "${existingAgentId}"`);
            return;
          }

          const sessionId = nanoid();
          const firstWindowId =
            [...this.ctx.baseWindow.windows.keys()][0] ?? nanoid();
          kernel.windowStates = [
            ...kernel.windowStates,
            {
              id: firstWindowId,
              sessions: [
                {
                  id: sessionId,
                  agentId: existingAgentId,
                  lastViewedAt: null,
                },
              ],
              panes: [],
              rootPaneId: null,
              focusedPaneId: null,
              sidebarOpen: false,
              tabSidebarOpen: true,
              sidebarPanel: "overview",
            },
          ];
        } else if (agent || fallbackToNewAgent) {
          const matched = agent
            ? matchAgentConfig(kernel.agentConfigs, agent)
            : kernel.agentConfigs.find(
                (c) => c.id === kernel.selectedConfigId,
              ) ?? kernel.agentConfigs[0];
          if (!matched) {
            if (agent) {
              const names = kernel.agentConfigs.map((c) => c.name).join(", ");
              console.warn(
                `[cli-intent] No agent config matching "${agent}". Available: ${names || "(none)"}`,
              );
            } else {
              console.warn(
                `[cli-intent] No agent configs available; cannot create a default agent.`,
              );
            }
            return;
          }

          if (agent) kernel.selectedConfigId = matched.id;

          const agentId = nanoid();
          const sessionId = nanoid();
          evicted = insertHotAgent(kernel, {
            id: agentId,
            name: matched.name,
            startCommand: matched.startCommand,
            configId: matched.id,
            status: "idle",
            metadata: { cwd: cwd ?? DEFAULT_CWD },
            eventLog: makeCollection({
              collectionId: nanoid(),
              debugName: "eventLog",
            }),
            title: { kind: "not-available" },
            reloadMode: "keep-alive",
            sessionId: null,
            firstPromptSentAt: null,
            createdAt: Date.now(),
          });

          const firstWindowId =
            [...this.ctx.baseWindow.windows.keys()][0] ?? nanoid();
          kernel.windowStates = [
            ...kernel.windowStates,
            {
              id: firstWindowId,
              sessions: [{ id: sessionId, agentId, lastViewedAt: null }],
              panes: [],
              rootPaneId: null,
              focusedPaneId: null,
              sidebarOpen: false,
              tabSidebarOpen: true,
              sidebarPanel: "overview",
            },
          ];
        }
      }),
    )
      .then(async () => {
        if (evicted.length > 0) {
          await Effect.runPromise(
            client.plugin.kernel.archivedAgents.concat(evicted),
          ).catch(() => {});
        }
      })
      .catch((err) => {
        console.error("[cli-intent] Failed to apply CLI intent:", err);
      });

    console.log(
      `[cli-intent] applied${agent ? ` agent=${agent}` : ""}${existingAgentId ? ` agentId=${existingAgentId}` : ""}${cwd ? ` cwd=${cwd}` : ""}${fallbackToNewAgent ? " (fallback: new agent)" : ""}`,
    );
  }
}

runtime.register(CliIntentService, (import.meta as any).hot);
