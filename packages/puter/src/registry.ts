import { z } from "zod";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const ScriptStatusSchema = z.enum(["active", "archived"]);

const ScriptEntrySchema = z.object({
  path: z.string(),
  description: z.string().optional(),
  registeredAt: z.string().datetime(),
  status: ScriptStatusSchema,
});

const ConfigSchema = z.object({
  agent: z.enum(["codex", "opencode"]).optional(),
});

const PuterStateSchema = z.object({
  config: ConfigSchema.default({}),
  scripts: z.record(z.string(), ScriptEntrySchema).default({}),
});

export type ScriptStatus = z.infer<typeof ScriptStatusSchema>;
export type ScriptEntry = z.infer<typeof ScriptEntrySchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type PuterState = z.infer<typeof PuterStateSchema>;

export function defaultRegistryPath(): string {
  return join(homedir(), "puter.json");
}

export class Registry {
  constructor(private filePath: string = defaultRegistryPath()) {}

  async load(): Promise<PuterState> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return PuterStateSchema.parse(JSON.parse(raw));
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        return PuterStateSchema.parse({});
      }
      throw err;
    }
  }

  async save(state: PuterState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2) + "\n");
  }

  async register(
    name: string,
    path: string,
    description?: string
  ): Promise<ScriptEntry> {
    const state = await this.load();
    if (state.scripts[name]) {
      throw new Error(`Script "${name}" is already registered`);
    }
    const entry: ScriptEntry = {
      path,
      ...(description ? { description } : {}),
      registeredAt: new Date().toISOString(),
      status: "active",
    };
    state.scripts[name] = entry;
    await this.save(state);
    return entry;
  }

  async list(): Promise<Record<string, ScriptEntry>> {
    const state = await this.load();
    return state.scripts;
  }

  async listActive(): Promise<Record<string, ScriptEntry>> {
    const scripts = await this.list();
    return Object.fromEntries(
      Object.entries(scripts).filter(([, e]) => e.status === "active")
    );
  }

  async get(name: string): Promise<ScriptEntry> {
    const state = await this.load();
    const entry = state.scripts[name];
    if (!entry) {
      throw new Error(`Script "${name}" not found`);
    }
    return entry;
  }

  async update(name: string, newPath: string): Promise<ScriptEntry> {
    const state = await this.load();
    const entry = state.scripts[name];
    if (!entry) {
      throw new Error(`Script "${name}" not found`);
    }
    entry.path = newPath;
    await this.save(state);
    return entry;
  }

  async archive(name: string): Promise<ScriptEntry> {
    const state = await this.load();
    const entry = state.scripts[name];
    if (!entry) {
      throw new Error(`Script "${name}" not found`);
    }
    if (entry.status === "archived") {
      throw new Error(`Script "${name}" is already archived`);
    }
    entry.status = "archived";
    await this.save(state);
    return entry;
  }

  async getConfig(): Promise<Config> {
    const state = await this.load();
    return state.config;
  }

  async setConfig(config: Partial<Config>): Promise<Config> {
    const state = await this.load();
    state.config = { ...state.config, ...config };
    await this.save(state);
    return state.config;
  }
}
