import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(__dirname, "../../../shared/default-icons");

const SEEDED_IDS = ["codex", "claude", "cursor", "opencode", "copilot"] as const;

export class AgentIconsSeedService extends Service {
  static key = "agent-icons-seed";
  static deps = { db: DbService };
  declare ctx: { db: DbService };

  private _seeded = false;

  async evaluate() {
    if (this._seeded) return;
    this._seeded = true;

    const client = this.ctx.db.client;
    const kernel = client.readRoot().plugin.kernel;
    const configs = kernel.agentConfigs ?? [];

    const needsIcon = SEEDED_IDS.filter((id) => {
      const cfg = configs.find((c) => c.id === id);
      return cfg && !cfg.iconBlobId;
    });

    if (needsIcon.length === 0) return;

    const blobIds: Record<string, string> = {};
    for (const id of needsIcon) {
      const svgPath = path.join(ICONS_DIR, `${id}.svg`);
      if (!fs.existsSync(svgPath)) {
        console.warn(`[agent-icons-seed] missing ${svgPath}`);
        continue;
      }
      const data = new Uint8Array(fs.readFileSync(svgPath));
      const blobId = await Effect.runPromise(client.createBlob(data, true));
      blobIds[id] = blobId;
    }

    if (Object.keys(blobIds).length === 0) return;

    await Effect.runPromise(
      client.update((root) => {
        const k = root.plugin.kernel;
        k.agentConfigs = (k.agentConfigs ?? []).map((c) =>
          blobIds[c.id] && !c.iconBlobId
            ? { ...c, iconBlobId: blobIds[c.id] }
            : c,
        );
      }),
    );

    console.log(
      `[agent-icons-seed] seeded ${Object.keys(blobIds).length} default icon(s): ${Object.keys(blobIds).join(", ")}`,
    );
  }
}

runtime.register(AgentIconsSeedService, (import.meta as any).hot);
