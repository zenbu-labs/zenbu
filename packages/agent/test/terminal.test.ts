import { describe, it, expect, afterEach } from "vitest";
import { TerminalManager } from "../src/terminal.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("TerminalManager", () => {
  let manager: TerminalManager;

  afterEach(() => {
    manager?.releaseAll();
  });

  describe("create", () => {
    it("returns a terminalId immediately without blocking", () => {
      manager = new TerminalManager();
      const result = manager.create({ command: "echo", args: ["hello"], sessionId: "" });
      expect(result.terminalId).toBeDefined();
      expect(typeof result.terminalId).toBe("string");
      expect(result.terminalId.length).toBeGreaterThan(0);
    });

    it("allows concurrent terminal creation", () => {
      manager = new TerminalManager();
      const t1 = manager.create({ command: "echo", args: ["one"], sessionId: "" });
      const t2 = manager.create({ command: "echo", args: ["two"], sessionId: "" });
      const t3 = manager.create({ command: "echo", args: ["three"], sessionId: "" });

      expect(t1.terminalId).not.toBe(t2.terminalId);
      expect(t2.terminalId).not.toBe(t3.terminalId);

      const all = manager.getAll();
      expect(all.length).toBe(3);
    });

    it("uses cwd from params when provided", () => {
      manager = new TerminalManager();
      const result = manager.create({
        command: "pwd",
        cwd: "/tmp",
        sessionId: "",
      });
      const info = manager.get(result.terminalId);
      expect(info?.cwd).toBe("/tmp");
    });

    it("defaults cwd to process.cwd() when not provided", () => {
      manager = new TerminalManager();
      const result = manager.create({ command: "echo", args: ["hi"], sessionId: "" });
      const info = manager.get(result.terminalId);
      expect(info?.cwd).toBe(process.cwd());
    });
  });

  describe("getOutput", () => {
    it("captures stdout", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "echo",
        args: ["hello world"],
        sessionId: "",
      });

      await manager.waitForExit(terminalId);
      const output = manager.getOutput(terminalId);
      expect(output.output).toContain("hello world");
      expect(output.truncated).toBe(false);
    });

    it("captures stderr", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", "process.stderr.write('error output')"],
        sessionId: "",
      });

      await manager.waitForExit(terminalId);
      const output = manager.getOutput(terminalId);
      expect(output.output).toContain("error output");
    });

    it("merges stdout and stderr", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", "process.stdout.write('out'); process.stderr.write('err')"],
        sessionId: "",
      });

      await manager.waitForExit(terminalId);
      const output = manager.getOutput(terminalId);
      expect(output.output).toContain("out");
      expect(output.output).toContain("err");
    });

    it("returns exitStatus after process completes", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "echo",
        args: ["done"],
        sessionId: "",
      });

      await manager.waitForExit(terminalId);
      const output = manager.getOutput(terminalId);
      expect(output.exitStatus).toBeDefined();
      expect(output.exitStatus!.exitCode).toBe(0);
      expect(output.exitStatus!.signal).toBeNull();
    });

    it("returns undefined exitStatus while process is running", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "sleep",
        args: ["60"],
        sessionId: "",
      });

      const output = manager.getOutput(terminalId);
      expect(output.exitStatus).toBeUndefined();
    });

    it("throws for unknown terminal id", () => {
      manager = new TerminalManager();
      expect(() => manager.getOutput("nonexistent")).toThrow("Terminal not found");
    });
  });

  describe("waitForExit", () => {
    it("resolves with exit code 0 for successful command", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "echo",
        args: ["success"],
        sessionId: "",
      });

      const result = await manager.waitForExit(terminalId);
      expect(result.exitCode).toBe(0);
      expect(result.signal).toBeNull();
    });

    it("resolves with non-zero exit code", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", "process.exit(42)"],
        sessionId: "",
      });

      const result = await manager.waitForExit(terminalId);
      expect(result.exitCode).toBe(42);
    });

    it("resolves immediately if process already exited", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "echo",
        args: ["fast"],
        sessionId: "",
      });

      await manager.waitForExit(terminalId);

      const start = Date.now();
      const result = await manager.waitForExit(terminalId);
      const elapsed = Date.now() - start;
      expect(result.exitCode).toBe(0);
      expect(elapsed).toBeLessThan(100);
    });

    it("does not block the event loop while waiting", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "sleep",
        args: ["60"],
        sessionId: "",
      });

      let ticked = false;
      setTimeout(() => { ticked = true; }, 10);

      const exitPromise = manager.waitForExit(terminalId);

      await sleep(50);
      expect(ticked).toBe(true);

      manager.kill(terminalId);
      await exitPromise;
    });

    it("throws for unknown terminal id", async () => {
      manager = new TerminalManager();
      await expect(manager.waitForExit("nonexistent")).rejects.toThrow("Terminal not found");
    });
  });

  describe("kill", () => {
    it("terminates a running process", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "sleep",
        args: ["60"],
        sessionId: "",
      });

      manager.kill(terminalId);
      const result = await manager.waitForExit(terminalId);
      expect(result.exitCode === null || result.signal !== null).toBe(true);
    });

    it("reports SIGTERM signal", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "sleep",
        args: ["60"],
        sessionId: "",
      });

      manager.kill(terminalId);
      const result = await manager.waitForExit(terminalId);
      expect(result.signal).toBe("SIGTERM");
    });

    it("is safe to call on already exited process", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "echo",
        args: ["done"],
        sessionId: "",
      });

      await manager.waitForExit(terminalId);
      expect(() => manager.kill(terminalId)).not.toThrow();
    });

    it("terminal remains valid after kill", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", "process.stdout.write('output before kill'); setInterval(() => {}, 1000)"],
        sessionId: "",
      });

      await sleep(100);
      manager.kill(terminalId);
      await manager.waitForExit(terminalId);

      const output = manager.getOutput(terminalId);
      expect(output.output).toContain("output before kill");
      expect(output.exitStatus).toBeDefined();
    });
  });

  describe("release", () => {
    it("kills a running process and removes from the map", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "sleep",
        args: ["60"],
        sessionId: "",
      });

      expect(manager.get(terminalId)).toBeDefined();
      manager.release(terminalId);
      expect(manager.get(terminalId)).toBeUndefined();
    });

    it("is safe to call on already released terminal", () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "echo",
        args: ["hi"],
        sessionId: "",
      });

      manager.release(terminalId);
      expect(() => manager.release(terminalId)).not.toThrow();
    });

    it("is safe to call on already exited process", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "echo",
        args: ["done"],
        sessionId: "",
      });

      await manager.waitForExit(terminalId);
      expect(() => manager.release(terminalId)).not.toThrow();
      expect(manager.get(terminalId)).toBeUndefined();
    });
  });

  describe("releaseAll", () => {
    it("releases all terminals", async () => {
      manager = new TerminalManager();
      manager.create({ command: "sleep", args: ["60"], sessionId: "" });
      manager.create({ command: "sleep", args: ["60"], sessionId: "" });
      manager.create({ command: "sleep", args: ["60"], sessionId: "" });

      expect(manager.getAll().length).toBe(3);
      manager.releaseAll();
      expect(manager.getAll().length).toBe(0);
    });
  });

  describe("output byte limit", () => {
    it("truncates output from the front when exceeding limit", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", "process.stdout.write('A'.repeat(200))"],
        outputByteLimit: 50,
        sessionId: "",
      });

      await manager.waitForExit(terminalId);
      const output = manager.getOutput(terminalId);
      expect(Buffer.byteLength(output.output, "utf-8")).toBeLessThanOrEqual(50);
      expect(output.truncated).toBe(true);
    });

    it("sets truncated flag correctly", async () => {
      manager = new TerminalManager();

      const { terminalId: small } = manager.create({
        command: "node",
        args: ["-e", "process.stdout.write('hi')"],
        outputByteLimit: 1000,
        sessionId: "",
      });
      await manager.waitForExit(small);
      expect(manager.getOutput(small).truncated).toBe(false);

      const { terminalId: big } = manager.create({
        command: "node",
        args: ["-e", "process.stdout.write('X'.repeat(2000))"],
        outputByteLimit: 100,
        sessionId: "",
      });
      await manager.waitForExit(big);
      expect(manager.getOutput(big).truncated).toBe(true);
    });

    it("does not truncate when no limit is set", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", "process.stdout.write('X'.repeat(5000))"],
        sessionId: "",
      });

      await manager.waitForExit(terminalId);
      const output = manager.getOutput(terminalId);
      expect(output.output.length).toBe(5000);
      expect(output.truncated).toBe(false);
    });
  });

  describe("environment variables", () => {
    it("passes env variables to the spawned process", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", "process.stdout.write(process.env.TEST_VAR || 'missing')"],
        env: [{ name: "TEST_VAR", value: "hello_from_env" }],
        sessionId: "",
      });

      await manager.waitForExit(terminalId);
      const output = manager.getOutput(terminalId);
      expect(output.output).toBe("hello_from_env");
    });
  });

  describe("non-blocking behavior", () => {
    it("creating a long-running command returns immediately", () => {
      manager = new TerminalManager();
      const start = Date.now();
      const { terminalId } = manager.create({
        command: "sleep",
        args: ["60"],
        sessionId: "",
      });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500);
      expect(terminalId).toBeDefined();
    });

    it("multiple terminals can run concurrently", async () => {
      manager = new TerminalManager();
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const { terminalId } = manager.create({
          command: "node",
          args: ["-e", `setTimeout(() => { process.stdout.write('done-${i}'); }, 50)`],
          sessionId: "",
        });
        ids.push(terminalId);
      }

      await Promise.all(ids.map((id) => manager.waitForExit(id)));

      for (let i = 0; i < 5; i++) {
        const output = manager.getOutput(ids[i]);
        expect(output.output).toContain(`done-${i}`);
        expect(output.exitStatus?.exitCode).toBe(0);
      }
    });
  });

  describe("bad command", () => {
    it("exits quickly with error for nonexistent command", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "this_command_does_not_exist_xyzzy",
        sessionId: "",
      });

      const result = await manager.waitForExit(terminalId);
      expect(result.exitCode !== 0 || result.signal !== null || result.exitCode === null).toBe(true);
    });
  });

  describe("max lifetime", () => {
    it("kills process after max lifetime", async () => {
      manager = new TerminalManager({ maxLifetimeMs: 200 });
      const { terminalId } = manager.create({
        command: "sleep",
        args: ["60"],
        sessionId: "",
      });

      const result = await manager.waitForExit(terminalId);
      expect(result.signal).toBe("SIGTERM");
    }, 10_000);
  });

  describe("onOutput subscription", () => {
    it("receives output chunks as they arrive", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", `
          process.stdout.write('chunk1');
          setTimeout(() => process.stdout.write('chunk2'), 50);
          setTimeout(() => process.stdout.write('chunk3'), 100);
          setTimeout(() => {}, 200);
        `],
        sessionId: "",
      });

      const chunks: string[] = [];
      manager.onOutput(terminalId, (chunk) => chunks.push(chunk));

      await manager.waitForExit(terminalId);
      await sleep(50);

      const combined = chunks.join("");
      expect(combined).toContain("chunk1");
      expect(combined).toContain("chunk2");
      expect(combined).toContain("chunk3");
    });

    it("unsubscribe stops receiving chunks", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", `
          process.stdout.write('before');
          setTimeout(() => process.stdout.write('after'), 100);
          setTimeout(() => {}, 200);
        `],
        sessionId: "",
      });

      const chunks: string[] = [];
      const unsub = manager.onOutput(terminalId, (chunk) => chunks.push(chunk));

      await sleep(50);
      unsub();
      await manager.waitForExit(terminalId);
      await sleep(50);

      const combined = chunks.join("");
      expect(combined).toContain("before");
      expect(combined).not.toContain("after");
    });
  });

  describe("onExit subscription", () => {
    it("fires callback when process exits", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "node",
        args: ["-e", "process.exit(7)"],
        sessionId: "",
      });

      const status = await new Promise<{ exitCode: number | null; signal: string | null }>(
        (resolve) => manager.onExit(terminalId, resolve),
      );
      expect(status.exitCode).toBe(7);
    });

    it("fires immediately if process already exited", async () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "echo",
        args: ["fast"],
        sessionId: "",
      });

      await manager.waitForExit(terminalId);

      const status = await new Promise<{ exitCode: number | null; signal: string | null }>(
        (resolve) => manager.onExit(terminalId, resolve),
      );
      expect(status.exitCode).toBe(0);
    });
  });

  describe("getAll and get", () => {
    it("lists all active terminals", () => {
      manager = new TerminalManager();
      const t1 = manager.create({ command: "sleep", args: ["60"], sessionId: "" });
      const t2 = manager.create({ command: "sleep", args: ["60"], sessionId: "" });

      const all = manager.getAll();
      expect(all.length).toBe(2);
      const ids = all.map((t) => t.terminalId);
      expect(ids).toContain(t1.terminalId);
      expect(ids).toContain(t2.terminalId);
    });

    it("get returns terminal info by id", () => {
      manager = new TerminalManager();
      const { terminalId } = manager.create({
        command: "echo",
        args: ["test"],
        sessionId: "",
      });

      const info = manager.get(terminalId);
      expect(info).toBeDefined();
      expect(info!.command).toBe("echo");
      expect(info!.args).toEqual(["test"]);
    });

    it("get returns undefined for unknown id", () => {
      manager = new TerminalManager();
      expect(manager.get("nonexistent")).toBeUndefined();
    });
  });
});
