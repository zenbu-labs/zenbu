import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import { makeCollection } from "@zenbu/kyju/schema";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";
import { MAIN_WINDOW_ID } from "../../../shared/schema";
import {
  insertHotAgent,
  validSelectionFromTemplate,
  findExistingAgentTab,
  activateAgentTab,
  type ArchivedAgent,
} from "../../../shared/agent-ops";

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
    let focusWindowId: string | null = null;

    Effect.runPromise(
      client.update((root) => {
        const kernel = root.plugin.kernel;

        // Prune orphaned windowStates (from prior cold-started sessions with
        // no matching live Electron window). Persisted entries (e.g. the
        // main window) are the source of truth across processes and must
        // survive the prune even when no Electron window has adopted them
        // yet.
        const liveWindowIds = new Set(this.ctx.baseWindow.windows.keys());
        const prunedCount = kernel.windowStates.filter(
          (ws) => !liveWindowIds.has(ws.id) && !ws.persisted,
        ).length;
        if (prunedCount > 0) {
          kernel.windowStates = kernel.windowStates.filter(
            (ws) => liveWindowIds.has(ws.id) || ws.persisted,
          );
          console.log(`[cli-intent] pruned ${prunedCount} orphaned windowStates`);
        }

        // Ensure the persisted main windowState exists. On first ever boot,
        // create it; on upgrade from pre-`persisted` DBs, self-heal the
        // flag; always prune sessions whose agentId no longer exists.
        let mainWs = kernel.windowStates.find((ws) => ws.id === MAIN_WINDOW_ID);
        if (!mainWs) {
          kernel.windowStates = [
            ...kernel.windowStates,
            {
              id: MAIN_WINDOW_ID,
              sessions: [],
              panes: [],
              rootPaneId: null,
              focusedPaneId: null,
              sidebarOpen: false,
              tabSidebarOpen: true,
              sidebarPanel: "overview",
              persisted: true,
            },
          ];
          mainWs = kernel.windowStates.find((ws) => ws.id === MAIN_WINDOW_ID)!;
        } else {
          if (!mainWs.persisted) mainWs.persisted = true;
          mainWs.sessions = mainWs.sessions.filter((s) =>
            kernel.agents.some((a) => a.id === s.agentId),
          );
        }

        if (existingAgentId) {
          const existingAgent = kernel.agents.find(
            (a) => a.id === existingAgentId,
          );
          if (!existingAgent) {
            console.warn(`[cli-intent] No agent with id "${existingAgentId}"`);
            return;
          }

          const existingTab = findExistingAgentTab(
            kernel.windowStates,
            existingAgentId,
          );
          if (existingTab) {
            activateAgentTab(kernel, existingTab);
            focusWindowId = existingTab.windowId;
            return;
          }

          mainWs.sessions = [
            ...mainWs.sessions,
            {
              id: nanoid(),
              agentId: existingAgentId,
              lastViewedAt: null,
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

          const template = kernel.agentConfigs.find((c) => c.id === matched.id);
          const seeded = template ? validSelectionFromTemplate(template) : {};

          const agentId = nanoid();
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
            ...seeded,
            title: { kind: "not-available" },
            reloadMode: "keep-alive",
            sessionId: null,
            firstPromptSentAt: null,
            createdAt: Date.now(),
          });

          mainWs.sessions = [
            ...mainWs.sessions,
            { id: nanoid(), agentId, lastViewedAt: null },
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
        if (focusWindowId) {
          const win = this.ctx.baseWindow.windows.get(focusWindowId);
          if (win && !win.isDestroyed()) win.focus();
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
