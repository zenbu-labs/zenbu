import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { nanoid } from "nanoid";
import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputResponse,
  WaitForTerminalExitResponse,
  KillTerminalResponse,
  ReleaseTerminalResponse,
} from "@agentclientprotocol/sdk";

export type TerminalExitStatus = {
  exitCode: number | null;
  signal: string | null;
};

export type TerminalInfo = {
  terminalId: string;
  command: string;
  args: string[];
  cwd: string;
  output: string;
  truncated: boolean;
  exitStatus: TerminalExitStatus | null;
};

const DEFAULT_MAX_LIFETIME_MS = 5 * 60 * 1000;
const KILL_GRACE_MS = 5_000;

class ManagedTerminal {
  readonly terminalId: string;
  readonly command: string;
  readonly args: string[];
  readonly cwd: string;

  private proc: ChildProcess;
  private outputBuffer: string = "";
  private outputByteLength: number = 0;
  private outputByteLimit: number | null;
  private _truncated: boolean = false;
  private _exitStatus: TerminalExitStatus | null = null;
  private emitter = new EventEmitter();
  private killTimer: ReturnType<typeof setTimeout> | null = null;
  private lifetimeTimer: ReturnType<typeof setTimeout> | null = null;
  private exitPromise: Promise<TerminalExitStatus>;
  private _released = false;

  constructor(
    terminalId: string,
    command: string,
    args: string[],
    cwd: string,
    env: Record<string, string> | undefined,
    outputByteLimit: number | null,
    maxLifetimeMs: number,
  ) {
    this.terminalId = terminalId;
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.outputByteLimit = outputByteLimit;

    const spawnEnv = env ? { ...process.env, ...env } : { ...process.env };
    delete spawnEnv.NODE_OPTIONS;

    this.proc = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: spawnEnv,
    });

    this.exitPromise = new Promise<TerminalExitStatus>((resolve) => {
      // @ts-expect-error look into later
      this.proc.on("close", (code, signal) => {
        this._exitStatus = {
          exitCode: code ?? null,
          signal: signal ?? null,
        };
        this.clearTimers();
        this.emitter.emit("exit", this._exitStatus);
        resolve(this._exitStatus);
      });

      // @ts-expect-error look into later
      this.proc.on("error", (err) => {
        if (!this._exitStatus) {
          this._exitStatus = { exitCode: null, signal: null };
          this.clearTimers();
          this.emitter.emit("exit", this._exitStatus);
          resolve(this._exitStatus);
        }
      });
    });

    const onData = (chunk: Buffer) => {
      const str = chunk.toString("utf-8");
      this.appendOutput(str);
      this.emitter.emit("output", str);
    };

    this.proc.stdout?.on("data", onData);
    this.proc.stderr?.on("data", onData);

    if (maxLifetimeMs > 0) {
      this.lifetimeTimer = setTimeout(() => {
        this.killProcess();
      }, maxLifetimeMs);
    }
  }

  private appendOutput(str: string): void {
    this.outputBuffer += str;
    this.outputByteLength += Buffer.byteLength(str, "utf-8");

    if (
      this.outputByteLimit !== null &&
      this.outputByteLength > this.outputByteLimit
    ) {
      this.truncateOutput();
    }
  }

  private truncateOutput(): void {
    if (this.outputByteLimit === null) return;

    this._truncated = true;
    const buf = Buffer.from(this.outputBuffer, "utf-8");
    const excess = buf.length - this.outputByteLimit;
    if (excess <= 0) return;

    let start = excess;
    // Ensure we cut at a valid UTF-8 character boundary
    while (start < buf.length && (buf[start] & 0xc0) === 0x80) {
      start++;
    }

    const trimmed = buf.subarray(start);
    this.outputBuffer = trimmed.toString("utf-8");
    this.outputByteLength = trimmed.length;
  }

  private clearTimers(): void {
    if (this.killTimer) {
      clearTimeout(this.killTimer);
      this.killTimer = null;
    }
    if (this.lifetimeTimer) {
      clearTimeout(this.lifetimeTimer);
      this.lifetimeTimer = null;
    }
  }

  get exited(): boolean {
    return this._exitStatus !== null;
  }

  get released(): boolean {
    return this._released;
  }

  getOutput(): {
    output: string;
    truncated: boolean;
    exitStatus: TerminalExitStatus | null;
  } {
    return {
      output: this.outputBuffer,
      truncated: this._truncated,
      exitStatus: this._exitStatus,
    };
  }

  async waitForExit(): Promise<TerminalExitStatus> {
    if (this._exitStatus) return this._exitStatus;
    return this.exitPromise;
  }

  killProcess(): void {
    if (this._exitStatus) return;

    this.proc.kill("SIGTERM");

    this.killTimer = setTimeout(() => {
      if (!this._exitStatus) {
        this.proc.kill("SIGKILL");
      }
    }, KILL_GRACE_MS);
  }

  release(): void {
    if (this._released) return;
    this._released = true;
    if (!this._exitStatus) {
      this.killProcess();
    }
    this.clearTimers();
    this.emitter.removeAllListeners();
  }

  onOutput(cb: (chunk: string) => void): () => void {
    this.emitter.on("output", cb);
    return () => this.emitter.off("output", cb);
  }

  onExit(cb: (status: TerminalExitStatus) => void): () => void {
    if (this._exitStatus) {
      queueMicrotask(() => cb(this._exitStatus!));
      return () => {};
    }
    this.emitter.on("exit", cb);
    return () => this.emitter.off("exit", cb);
  }

  toInfo(): TerminalInfo {
    return {
      terminalId: this.terminalId,
      command: this.command,
      args: this.args,
      cwd: this.cwd,
      output: this.outputBuffer,
      truncated: this._truncated,
      exitStatus: this._exitStatus,
    };
  }
}

export class TerminalManager {
  private terminals = new Map<string, ManagedTerminal>();
  private maxLifetimeMs: number;

  constructor(opts?: { maxLifetimeMs?: number }) {
    this.maxLifetimeMs = opts?.maxLifetimeMs ?? DEFAULT_MAX_LIFETIME_MS;
  }

  create(params: CreateTerminalRequest): CreateTerminalResponse {
    const terminalId = nanoid();
    const args = params.args ?? [];
    console.log("creating terminal", args);

    const cwd = params.cwd ?? process.cwd();

    let env: Record<string, string> | undefined;
    if (params.env && params.env.length > 0) {
      env = {};
      for (const v of params.env) {
        env[v.name] = v.value;
      }
    }

    const outputByteLimit = params.outputByteLimit ?? null;

    const terminal = new ManagedTerminal(
      terminalId,
      params.command,
      args,
      cwd,
      env,
      outputByteLimit,
      this.maxLifetimeMs,
    );

    this.terminals.set(terminalId, terminal);
    return { terminalId };
  }

  getOutput(terminalId: string): TerminalOutputResponse {
    const terminal = this.getTerminal(terminalId);
    const { output, truncated, exitStatus } = terminal.getOutput();
    return {
      output,
      truncated,
      exitStatus: exitStatus
        ? { exitCode: exitStatus.exitCode, signal: exitStatus.signal }
        : undefined,
    };
  }

  async waitForExit(terminalId: string): Promise<WaitForTerminalExitResponse> {
    const terminal = this.getTerminal(terminalId);
    const status = await terminal.waitForExit();
    return {
      exitCode: status.exitCode,
      signal: status.signal,
    };
  }

  kill(terminalId: string): KillTerminalResponse {
    const terminal = this.getTerminal(terminalId);
    terminal.killProcess();
    return {};
  }

  release(terminalId: string): ReleaseTerminalResponse {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return {};
    terminal.release();
    this.terminals.delete(terminalId);
    return {};
  }

  releaseAll(): void {
    for (const terminal of this.terminals.values()) {
      terminal.release();
    }
    this.terminals.clear();
  }

  getAll(): TerminalInfo[] {
    return [...this.terminals.values()].map((t) => t.toInfo());
  }

  get(terminalId: string): TerminalInfo | undefined {
    return this.terminals.get(terminalId)?.toInfo();
  }

  onOutput(terminalId: string, cb: (chunk: string) => void): () => void {
    const terminal = this.getTerminal(terminalId);
    return terminal.onOutput(cb);
  }

  onExit(
    terminalId: string,
    cb: (status: TerminalExitStatus) => void,
  ): () => void {
    const terminal = this.getTerminal(terminalId);
    return terminal.onExit(cb);
  }

  private getTerminal(terminalId: string): ManagedTerminal {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }
    return terminal;
  }
}
