import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import { makeCollection } from "@zenbu/kyju/schema";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";
import { INTERNAL_DIR, RUNTIME_JSON, SOCKET_DIR, CLI_SOCKET_PATH } from "../../../shared/paths";

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

type Command =
  | { cmd: "ping" }
  | { cmd: "create-window"; agent?: string; cwd?: string; agentId?: string }
  | { cmd: "list-agents" };

export class CliSocketService extends Service {
  static key = "cli-socket";
  static deps = { db: DbService, baseWindow: "base-window", window: "window" };
  declare ctx: { db: DbService; baseWindow: any; window: any };

  private server: net.Server | null = null;

  private writeRuntimeJson() {
    fs.mkdirSync(INTERNAL_DIR, { recursive: true });
    fs.writeFileSync(
      RUNTIME_JSON,
      JSON.stringify({
        socketPath: CLI_SOCKET_PATH,
        dbPath: DB_PATH,
        pid: process.pid,
      }),
    );
  }

  private cleanupRuntimeJson() {
    try { fs.unlinkSync(RUNTIME_JSON); } catch {}
  }

  private cleanupSocket() {
    try { fs.unlinkSync(CLI_SOCKET_PATH); } catch {}
  }

  private handleCommand(cmd: Command): any {
    if (cmd.cmd === "ping") {
      return { ok: true };
    }

    if (cmd.cmd === "list-agents") {
      const kernel = this.ctx.db.client.readRoot().plugin.kernel;
      const agents = (kernel.agents ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        configId: a.configId,
        status: a.status,
      }));
      return { agents };
    }

    if (cmd.cmd === "create-window") {
      const client = this.ctx.db.client;
      const kernel = client.readRoot().plugin.kernel;
      const windowId = nanoid();

      let agentId = cmd.agentId;

      if (!agentId && cmd.agent) {
        const configs = kernel.agentConfigs ?? [];
        const matched = matchAgentConfig(configs, cmd.agent);
        if (!matched) {
          return { error: `No agent config matching "${cmd.agent}"` };
        }

        agentId = nanoid();
        const sessionId = nanoid();

        Effect.runPromise(
          client.update((root) => {
            const k = root.plugin.kernel;

            k.agents = [
              ...(k.agents ?? []),
              {
                id: agentId!,
                name: matched!.name,
                startCommand: matched!.startCommand,
                configId: matched!.id,
                status: "idle" as const,
                metadata: { cwd: cmd.cwd ?? DEFAULT_CWD },
                eventLog: makeCollection({ collectionId: nanoid(), debugName: "eventLog" }),
                title: {kind: "not-available"}
              },
            ];

            k.windowStates = [
              ...(k.windowStates ?? []),
              {
                id: windowId,
                sessions: [{ id: sessionId, agentId: agentId!,lastViewedAt: null }],
                panes: [],
                rootPaneId: null,
                focusedPaneId: null,
                sidebarOpen: false,
                tabSidebarOpen: true,
                sidebarPanel: "overview",

              },
            ];
          }),
        ).catch((err) => console.error("[cli-socket] DB update failed:", err));
      } else if (agentId) {
        const sessionId = nanoid();
        Effect.runPromise(
          client.update((root) => {
            root.plugin.kernel.windowStates = [
              ...(root.plugin.kernel.windowStates ?? []),
              {
                id: windowId,
                sessions: [{ id: sessionId, agentId: agentId!,lastViewedAt :null }],
                panes: [],
                rootPaneId: null,
                focusedPaneId: null,
                sidebarOpen: false,
                tabSidebarOpen: true,
                sidebarPanel: "overview",
              },
            ];
          }),
        ).catch((err) => console.error("[cli-socket] DB update failed:", err));
      } else {
        Effect.runPromise(
          client.update((root) => {
            root.plugin.kernel.windowStates = [
              ...(root.plugin.kernel.windowStates ?? []),
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
        ).catch((err) => console.error("[cli-socket] DB update failed:", err));
      }

      this.ctx.baseWindow.createWindow({ windowId });

      setTimeout(() => {
        this.ctx.window.evaluate();
      }, 50);

      if (agentId) {
        setTimeout(() => {
          try {
            
            const rpcService =runtime.get({key: "rpc"})
            if (rpcService) {
              const router = runtime.buildRouter();
              router.agent?.init?.(agentId).catch(() => {});
            }
          } catch {}
        }, 200);
      }

      return { windowId };
    }

    return { error: "Unknown command" };
  }

  evaluate() {
    this.effect("socket-server", () => {
      fs.mkdirSync(SOCKET_DIR, { recursive: true });
      this.cleanupSocket();
      this.writeRuntimeJson();

      const server = net.createServer((conn) => {
        let buffer = "";
        conn.on("data", (chunk) => {
          buffer += chunk.toString();
          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            if (!line) continue;
            try {
              const cmd = JSON.parse(line) as Command;
              const result = this.handleCommand(cmd);
              conn.write(JSON.stringify(result) + "\n");
            } catch (err) {
              conn.write(JSON.stringify({ error: String(err) }) + "\n");
            }
          }
        });
      });

      server.listen(CLI_SOCKET_PATH, () => {
        console.log(`[cli-socket] listening on ${CLI_SOCKET_PATH}`);
      });

      server.on("error", (err) => {
        console.error("[cli-socket] server error:", err);
      });

      this.server = server;

      return () => {
        server.close();
        this.cleanupSocket();
        this.cleanupRuntimeJson();
        this.server = null;
      };
    });

    console.log("[cli-socket] service ready");
  }
}

runtime.register(CliSocketService, (import.meta as any).hot);
