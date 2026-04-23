import { app } from "electron";
import * as Effect from "effect/Effect";
import { nanoid } from "nanoid";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";
import { RpcService } from "./rpc";
import { kernelUpdaterBus } from "../../../shared/kernel-updater-bus";

type CmdChannel =
  | "updater.cmd.check"
  | "updater.cmd.download"
  | "updater.cmd.install";

type AckResult = { ok: boolean; error?: string };

type UpdateStatePatch = {
  status?:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error";
  availableVersion?: string | null;
  releaseNotes?: string | null;
  downloadPercent?: number | null;
  downloadBytesPerSecond?: number | null;
  error?: string | null;
  lastCheckedAt?: number | null;
  dismissedVersion?: string | null;
};

const CMD_TIMEOUT_MS = 15_000;
const PROGRESS_MIN_INTERVAL_MS = 750;

/**
 * Listens on the `kernel-updater` bus (emitted from apps/kernel's
 * updater.ts), mirrors state into Kyju under
 * `root.plugin.kernel.updateState` so the renderer can render a banner
 * and settings UI, and exposes user-triggered actions as RPC methods.
 *
 * The bus is fire-and-forget, so request/response is layered on top by
 * pairing each `updater.cmd.<x>` with an `updater.cmd.ack` that carries
 * the same `requestId` (same pattern used by the zenrpc bidirectional
 * pending-map flow).
 */
export class KernelUpdaterService extends Service {
  static key = "kernelUpdater";
  static deps = { db: DbService, rpc: RpcService };
  declare ctx: { db: DbService; rpc: RpcService };

  private unsubs: Array<() => void> = [];
  private pendingCmds = new Map<string, (r: AckResult) => void>();
  private lastProgressWriteAt = 0;

  evaluate() {
    this.setup("bus-subscriptions", () => {
      const offs = [
        kernelUpdaterBus.on("updater.checking", () => {
          this.write({ status: "checking", error: null });
        }),
        kernelUpdaterBus.on("updater.available", (p) => {
          this.write({
            status: "available",
            availableVersion: p.version,
            releaseNotes: p.releaseNotes,
            error: null,
            lastCheckedAt: p.ts,
          });
        }),
        kernelUpdaterBus.on("updater.not-available", (p) => {
          this.write({
            status: "not-available",
            availableVersion: null,
            releaseNotes: null,
            downloadPercent: null,
            downloadBytesPerSecond: null,
            error: null,
            lastCheckedAt: p.ts,
          });
        }),
        kernelUpdaterBus.on("updater.download-progress", (p) => {
          this.onProgress(p);
        }),
        kernelUpdaterBus.on("updater.downloaded", () => {
          this.write({
            status: "downloaded",
            downloadPercent: 100,
            downloadBytesPerSecond: null,
            error: null,
          });
        }),
        kernelUpdaterBus.on("updater.error", (p) => {
          this.write({ status: "error", error: p.message });
        }),
        kernelUpdaterBus.on("updater.cmd.ack", (p) => {
          const resolve = this.pendingCmds.get(p.requestId);
          if (resolve) {
            this.pendingCmds.delete(p.requestId);
            resolve({ ok: p.ok, error: p.error });
          }
        }),
      ];
      return () => {
        for (const off of offs) off();
        for (const [, resolve] of this.pendingCmds) {
          resolve({ ok: false, error: "service reloaded" });
        }
        this.pendingCmds.clear();
      };
    });

    // Re-drive a check so the DB gets populated even if the kernel
    // fired events before this subscription was live.
    this.checkForUpdates().catch(() => {});
  }

  // ---- Public RPC (auto-exposed as `rpc.kernelUpdater.*` after `zen link`) ----

  getCurrentVersion(): string {
    return app.getVersion();
  }

  async checkForUpdates(): Promise<AckResult> {
    return this.sendCmd("updater.cmd.check");
  }

  async downloadUpdate(): Promise<AckResult> {
    return this.sendCmd("updater.cmd.download");
  }

  async quitAndInstall(): Promise<AckResult> {
    return this.sendCmd("updater.cmd.install");
  }

  async dismissAvailable(): Promise<void> {
    const v = this.ctx.db.effectClient.readRoot().plugin.kernel.updateState
      .availableVersion as string | null;
    if (!v) return;
    await this.write({ dismissedVersion: v, status: "idle" });
  }

  // ---- Internal ----

  private onProgress(p: { percent: number; bytesPerSecond: number }): void {
    // electron-updater can fire many progress events per second. Throttle
    // DB writes so we don't thrash replica subscribers.
    const now = Date.now();
    if (now - this.lastProgressWriteAt < PROGRESS_MIN_INTERVAL_MS) return;
    this.lastProgressWriteAt = now;
    this.write({
      status: "downloading",
      downloadPercent: Math.floor(p.percent),
      downloadBytesPerSecond: p.bytesPerSecond,
      error: null,
    });
  }

  private async sendCmd(channel: CmdChannel): Promise<AckResult> {
    const requestId = nanoid();
    const waiter = new Promise<AckResult>((resolve) => {
      this.pendingCmds.set(requestId, resolve);
    });
    kernelUpdaterBus.emit(channel, { requestId });

    let timeoutId: NodeJS.Timeout | null = null;
    const timeout = new Promise<AckResult>((resolve) => {
      timeoutId = setTimeout(() => {
        this.pendingCmds.delete(requestId);
        resolve({ ok: false, error: "command timed out" });
      }, CMD_TIMEOUT_MS);
    });

    try {
      return await Promise.race([waiter, timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private write(patch: UpdateStatePatch): void {
    const client = this.ctx.db.effectClient;
    Effect.runPromise(
      client.update((root) => {
        const s = root.plugin.kernel.updateState;
        for (const [k, v] of Object.entries(patch)) {
          (s as any)[k] = v;
        }
      }),
    ).catch((err) => {
      console.error("[kernel-updater] DB write failed:", err);
    });
  }
}

runtime.register(KernelUpdaterService, (import.meta as any).hot);
