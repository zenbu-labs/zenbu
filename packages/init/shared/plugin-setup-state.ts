import fs from "node:fs";
import path from "node:path";
import { PLUGIN_SETUP_STATE_JSON, INTERNAL_DIR } from "./paths";

/**
 * Per-plugin record of the last setup.version that was successfully applied
 * on this machine. Forward-only: we only ever write a version >= what's
 * currently stored. Rolling back setup.version in a manifest is a no-op.
 */
export type PluginSetupRecord = {
  version: number;
  at: number;
};

export type PluginSetupState = Record<string, PluginSetupRecord>;

export function readPluginSetupState(): PluginSetupState {
  try {
    if (!fs.existsSync(PLUGIN_SETUP_STATE_JSON)) return {};
    const raw = fs.readFileSync(PLUGIN_SETUP_STATE_JSON, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: PluginSetupState = {};
    for (const [name, rec] of Object.entries(parsed)) {
      if (!rec || typeof rec !== "object") continue;
      const v = (rec as any).version;
      const at = (rec as any).at;
      if (typeof v !== "number" || typeof at !== "number") continue;
      out[name] = { version: v, at };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Atomic write-rename so a crash mid-write can't corrupt the state file.
 */
export function writePluginSetupState(next: PluginSetupState): void {
  fs.mkdirSync(INTERNAL_DIR, { recursive: true });
  const tmp = PLUGIN_SETUP_STATE_JSON + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, PLUGIN_SETUP_STATE_JSON);
}

export function getStoredSetupVersion(pluginName: string): number {
  const state = readPluginSetupState();
  return state[pluginName]?.version ?? 0;
}

export function recordSetupVersion(
  pluginName: string,
  version: number,
): void {
  const state = readPluginSetupState();
  const current = state[pluginName]?.version ?? 0;
  if (version <= current) return;
  state[pluginName] = { version, at: Date.now() };
  writePluginSetupState(state);
}

/**
 * Read a plugin manifest's declared setup entry. Returns null when the
 * manifest has no `setup` field (or it's malformed), meaning no gate runs
 * for this plugin.
 */
export function readManifestSetup(manifestPath: string): {
  script: string;
  version: number;
  scriptAbs: string;
} | null {
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(raw);
    const setup = manifest?.setup;
    if (!setup || typeof setup !== "object") return null;
    const script = setup.script;
    const version = setup.version;
    if (typeof script !== "string" || typeof version !== "number") return null;
    const scriptAbs = path.resolve(path.dirname(manifestPath), script);
    return { script, version, scriptAbs };
  } catch {
    return null;
  }
}

export function readManifestName(manifestPath: string): string | null {
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(raw);
    const name = manifest?.name;
    return typeof name === "string" && name ? name : null;
  } catch {
    return null;
  }
}
