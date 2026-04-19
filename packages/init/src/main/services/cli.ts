import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { app } from "electron";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import { makeCollection } from "@zenbu/kyju/schema";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";
import { HttpService } from "./http";
import { RpcService } from "./rpc";
import { INTERNAL_DIR, RUNTIME_JSON } from "../../../shared/paths";
import {
  insertHotAgent,
  validSelectionFromTemplate,
  type ArchivedAgent,
} from "../../../shared/agent-ops";

const DB_PATH = path.join(process.cwd(), ".zenbu", "db");
const DEFAULT_CWD = path.join(os.homedir(), ".zenbu");

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

export type CliCreateWindowArgs = {
  agent?: string;
  agentId?: string;
  cwd?: string;
};

export type RelaunchDecision = "accept" | "reject";

export class CliService extends Service {
  static key = "cli";
  static deps = {
    db: DbService,
    http: HttpService,
    rpc: RpcService,
    baseWindow: "base-window",
    window: "window",
  };
  declare ctx: {
    db: DbService;
    http: HttpService;
    rpc: RpcService;
    baseWindow: any;
    window: any;
  };

  private pendingRelaunches = new Map<string, (d: RelaunchDecision) => void>();

  ping() {
    return { ok: true, pid: process.pid, wsPort: this.ctx.http.port , extra: 'yes'};
  }

  listAgents() {
    const kernel = this.ctx.db.client.readRoot().plugin.kernel;
    return {
      agents: kernel.agents.map((a) => ({
        id: a.id,
        name: a.name,
        configId: a.configId,
        status: a.status,
        lastUserMessageAt: a.lastUserMessageAt ?? null,
      })),
    };
  }

  async createWindow(args: CliCreateWindowArgs = {}): Promise<{
    windowId: string;
    agentId: string | null;
  }> {
    const client = this.ctx.db.client;
    const kernel = client.readRoot().plugin.kernel;
    const windowId = nanoid();

    let agentId = args.agentId ?? null;

    if (!agentId && args.agent) {
      const matched = matchAgentConfig(kernel.agentConfigs, args.agent);
      if (!matched) {
        throw new Error(`No agent config matching "${args.agent}"`);
      }

      const newAgentId = nanoid();
      const sessionId = nanoid();
      let evicted: ArchivedAgent[] = [];

      await Effect.runPromise(
        client.update((root) => {
          const k = root.plugin.kernel;
          const template = k.agentConfigs.find((c) => c.id === matched.id);
          const seeded = template ? validSelectionFromTemplate(template) : {};

          evicted = insertHotAgent(k, {
            id: newAgentId,
            name: matched.name,
            startCommand: matched.startCommand,
            configId: matched.id,
            status: "idle",
            metadata: { cwd: args.cwd ?? DEFAULT_CWD },
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

          k.windowStates = [
            ...k.windowStates,
            {
              id: windowId,
              sessions: [
                { id: sessionId, agentId: newAgentId, lastViewedAt: null },
              ],
              panes: [],
              rootPaneId: null,
              focusedPaneId: null,
              sidebarOpen: false,
              tabSidebarOpen: true,
              sidebarPanel: "overview",
            },
          ];
        }),
      );

      if (evicted.length > 0) {
        await Effect.runPromise(
          client.plugin.kernel.archivedAgents.concat(evicted),
        ).catch(() => {});
      }

      agentId = newAgentId;
    } else if (agentId) {
      const sessionId = nanoid();
      await Effect.runPromise(
        client.update((root) => {
          root.plugin.kernel.windowStates = [
            ...root.plugin.kernel.windowStates,
            {
              id: windowId,
              sessions: [
                { id: sessionId, agentId: agentId!, lastViewedAt: null },
              ],
              panes: [],
              rootPaneId: null,
              focusedPaneId: null,
              sidebarOpen: false,
              tabSidebarOpen: true,
              sidebarPanel: "overview",
            },
          ];
        }),
      );
    } else {
      await Effect.runPromise(
        client.update((root) => {
          root.plugin.kernel.windowStates = [
            ...root.plugin.kernel.windowStates,
            {
              id: windowId,
              sessions: [],
              panes: [],
              rootPaneId: null,
              focusedPaneId: null,
              sidebarOpen: false,
              tabSidebarOpen: true,
              sidebarPanel: "overview",
            },
          ];
        }),
      );
    }

    this.ctx.baseWindow.createWindow({ windowId });

    setTimeout(() => {
      this.ctx.window.evaluate();
    }, 50);

    if (agentId) {
      const agentIdToInit = agentId;
      setTimeout(() => {
        try {
          const router = runtime.buildRouter() as any;
          router.agent?.init?.(agentIdToInit).catch(() => {});
        } catch {}
      }, 200);
    }

    return { windowId, agentId };
  }

  /**
   * Ask the UI whether to relaunch the app. Returns the user's decision.
   * Called from the CLI after `setup.ts` modifies files outside the module
   * graph (e.g. `node_modules`) that dynohot can't hot-reload. If accepted,
   * the app relaunches shortly after the RPC response ships.
   */
  async requestRelaunch(
    pluginName: string,
    reason: string,
  ): Promise<RelaunchDecision> {
    const requestId = nanoid();
    const promise = new Promise<RelaunchDecision>((resolve) => {
      this.pendingRelaunches.set(requestId, resolve);
    });
    this.ctx.rpc.emit.cli.relaunchRequested({ requestId, pluginName, reason });
    return promise;
  }

  /** Called by the frontend modal when the user makes a choice. */
  confirmRelaunch(requestId: string, decision: RelaunchDecision) {
    const resolve = this.pendingRelaunches.get(requestId);
    if (!resolve) return { ok: false as const, error: "unknown requestId" };
    this.pendingRelaunches.delete(requestId);
    resolve(decision);
    if (decision === "accept") {
      setTimeout(() => {
        app.relaunch();
        app.quit();
      }, 50);
    }
    return { ok: true as const };
  }

  /**
   * Canonical handshake file for external processes (the zen CLI, scripts).
   * Carries the live WS port so they can speak zenrpc on the same transport
   * the renderer uses. Because `HttpService` is a declared dep, any port
   * change re-evaluates this service and rewrites the file.
   */
  private writeRuntimeJson() {
    fs.mkdirSync(INTERNAL_DIR, { recursive: true });
    fs.writeFileSync(
      RUNTIME_JSON,
      JSON.stringify({
        wsPort: this.ctx.http.port,
        dbPath: DB_PATH,
        pid: process.pid,
      }),
    );
  }

  evaluate() {
    this.writeRuntimeJson();
    this.effect("runtime-json-cleanup", () => {
      return () => {
        try { fs.unlinkSync(RUNTIME_JSON); } catch {}
      };
    });
    console.log("[cli] service ready");
  }
}

runtime.register(CliService, (import.meta as any).hot);
