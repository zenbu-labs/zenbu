import { describe, it, expect, afterEach } from "vitest";
import { Effect } from "effect";
import { TerminalManager } from "../src/terminal.ts";
import { Agent, type AgentConfig } from "../src/agent.ts";
import type { EventLog } from "../src/event-log.ts";
import type { AgentStore } from "../src/store.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTestEventLog(): EventLog {
  const events: unknown[] = [];
  return {
    append: (updates) => {
      events.push(...updates);
      return Effect.void;
    },
  };
}

function createTestStore(): AgentStore {
  const map = new Map<string, string>();
  return {
    getSessionId: (agentId) =>
      Effect.sync(() => map.get(agentId) ?? null),
    setSessionId: (agentId, sessionId) =>
      Effect.sync(() => { map.set(agentId, sessionId); }),
    deleteSessionId: (agentId) =>
      Effect.sync(() => { map.delete(agentId); }),
  };
}

describe("Terminal + AcpClient handler wiring", () => {
  describe("TerminalManager as AcpClient handler", () => {
    let manager: TerminalManager;

    afterEach(() => {
      manager?.releaseAll();
    });

    it("createTerminal handler delegates to TerminalManager.create", async () => {
      manager = new TerminalManager();
      const handler = (params: any) => Promise.resolve(manager.create(params));

      const result = await handler({
        command: "echo",
        args: ["test"],
        sessionId: "sess-1",
      });
      expect(result.terminalId).toBeDefined();
      expect(manager.getAll().length).toBe(1);
    });

    it("terminalOutput handler delegates to TerminalManager.getOutput", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "echo",
        args: ["output test"],
        sessionId: "",
      });

      await manager.waitForExit(terminalId);

      const handler = (params: any) =>
        Promise.resolve(manager.getOutput(params.terminalId));

      const output = await handler({ terminalId, sessionId: "" });
      expect(output.output).toContain("output test");
      expect(output.truncated).toBe(false);
    });

    it("waitForTerminalExit handler delegates to TerminalManager.waitForExit", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", "process.exit(3)"],
        sessionId: "",
      });

      const handler = (params: any) => manager.waitForExit(params.terminalId);

      const result = await handler({ terminalId, sessionId: "" });
      expect(result.exitCode).toBe(3);
    });

    it("killTerminal handler delegates to TerminalManager.kill", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "sleep",
        args: ["60"],
        sessionId: "",
      });

      const handler = (params: any) =>
        Promise.resolve(manager.kill(params.terminalId));

      await handler({ terminalId, sessionId: "" });
      const result = await manager.waitForExit(terminalId);
      expect(result.signal).toBe("SIGTERM");
    });

    it("releaseTerminal handler delegates to TerminalManager.release", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "sleep",
        args: ["60"],
        sessionId: "",
      });

      const handler = (params: any) =>
        Promise.resolve(manager.release(params.terminalId));

      await handler({ terminalId, sessionId: "" });
      expect(manager.get(terminalId)).toBeUndefined();
    });

    it("full lifecycle: create -> output -> kill -> output -> release", async () => {
      manager = new TerminalManager();

      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", "process.stdout.write('running'); setInterval(() => {}, 1000)"],
        sessionId: "",
      });

      await sleep(100);

      const output1 = manager.getOutput(terminalId);
      expect(output1.output).toContain("running");
      expect(output1.exitStatus).toBeUndefined();

      manager.kill(terminalId);
      await manager.waitForExit(terminalId);

      const output2 = manager.getOutput(terminalId);
      expect(output2.exitStatus).toBeDefined();
      expect(output2.exitStatus!.signal).toBe("SIGTERM");

      manager.release(terminalId);
      expect(manager.getAll().length).toBe(0);
    });
  });

  describe("Agent.create wires TerminalManager", () => {
    let agent: any;
    let removeBeforeCreate: (() => void) | undefined;
    let removeDestroy: (() => void) | undefined;

    afterEach(async () => {
      removeBeforeCreate?.();
      removeDestroy?.();
      if (agent) {
        try {
          await Effect.runPromise(agent.close());
        } catch {}
      }
    });

    it("exposes a TerminalManager via getTerminalManager()", async () => {
      // We need a mock agent process. Use a simple node script that speaks
      // minimal ACP (just exits after a delay so create doesn't hang forever).
      // Since Agent.create forks the init sequence, we can inspect the manager
      // before init completes by not waiting for the deferred.
      const config: AgentConfig = {
        id: "test-terminal-agent",
        clientConfig: {
          command: "node",
          args: ["-e", "setTimeout(() => {}, 30000)"],
          handlers: {
            requestPermission: async () => ({
              outcome: { outcome: "selected" as const, optionId: "allow" },
            }),
          },
        },
        cwd: process.cwd(),
        eventLog: createTestEventLog(),
        store: createTestStore(),
      };

      agent = await Effect.runPromise(Agent.create(config));

      const tm = agent.getTerminalManager();
      expect(tm).toBeDefined();
      expect(tm).toBeInstanceOf(TerminalManager);

      const { terminalId } = tm.create({
        command: "echo",
        args: ["via-agent"],
        sessionId: "",
      });
      await tm.waitForExit(terminalId);
      const output = tm.getOutput(terminalId);
      expect(output.output).toContain("via-agent");
    });

    it("releaseAll is called when agent is closed", async () => {
      const config: AgentConfig = {
        id: "test-terminal-cleanup",
        clientConfig: {
          command: "node",
          args: ["-e", "setTimeout(() => {}, 30000)"],
          handlers: {
            requestPermission: async () => ({
              outcome: { outcome: "selected" as const, optionId: "allow" },
            }),
          },
        },
        cwd: process.cwd(),
        eventLog: createTestEventLog(),
        store: createTestStore(),
      };

      agent = await Effect.runPromise(Agent.create(config));

      const tm = agent.getTerminalManager();
      tm.create({ command: "sleep", args: ["60"], sessionId: "" });
      tm.create({ command: "sleep", args: ["60"], sessionId: "" });
      expect(tm.getAll().length).toBe(2);

      await Effect.runPromise(agent.close());
      agent = null;
      expect(tm.getAll().length).toBe(0);
    });
  });

  describe("concurrent terminal operations don't block agent", () => {
    it("creating terminals while agent initializes doesn't deadlock", async () => {
      const manager = new TerminalManager();

      const terminals: string[] = [];
      for (let i = 0; i < 3; i++) {
        const { terminalId } = manager.create({
          command: "node",
          args: ["-e", `setTimeout(() => process.stdout.write('t${i}'), 20); setTimeout(() => {}, 100)`],
          sessionId: "",
        });
        terminals.push(terminalId);
      }

      const results = await Promise.all(
        terminals.map((id) => manager.waitForExit(id)),
      );

      for (const r of results) {
        expect(r.exitCode).toBe(0);
      }

      for (let i = 0; i < 3; i++) {
        const output = manager.getOutput(terminals[i]);
        expect(output.output).toContain(`t${i}`);
      }

      manager.releaseAll();
    });
  });
});
