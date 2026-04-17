import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const CacheEntrySchema = z.object({
  hash: z.string(),
  summary: z.string(),
  cachedAt: z.string().datetime(),
});

const CacheStoreSchema = z.record(z.string(), CacheEntrySchema).default({});

export type CacheEntry = z.infer<typeof CacheEntrySchema>;

export function defaultCacheDir(): string {
  return join(homedir(), ".puter");
}

export function hashBundle(bundle: string): string {
  return createHash("sha256").update(bundle).digest("hex");
}

export class SummaryCache {
  private filePath: string;

  constructor(cacheDir: string = defaultCacheDir()) {
    this.filePath = join(cacheDir, "summary-cache.json");
  }

  private async load(): Promise<Record<string, CacheEntry>> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return CacheStoreSchema.parse(JSON.parse(raw));
    } catch (err: any) {
      if (err?.code === "ENOENT") return {};
      throw err;
    }
  }

  private async save(store: Record<string, CacheEntry>): Promise<void> {
    await mkdir(join(this.filePath, ".."), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(store, null, 2) + "\n");
  }

  async get(scriptName: string, bundle: string): Promise<string | null> {
    const store = await this.load();
    const entry = store[scriptName];
    if (!entry) return null;
    if (entry.hash !== hashBundle(bundle)) return null;
    return entry.summary;
  }

  async set(
    scriptName: string,
    bundle: string,
    summary: string
  ): Promise<void> {
    const store = await this.load();
    store[scriptName] = {
      hash: hashBundle(bundle),
      summary,
      cachedAt: new Date().toISOString(),
    };
    await this.save(store);
  }

  async invalidate(scriptName: string): Promise<boolean> {
    const store = await this.load();
    if (!store[scriptName]) return false;
    delete store[scriptName];
    await this.save(store);
    return true;
  }

  async list(): Promise<
    Record<string, { hash: string; cachedAt: string }>
  > {
    const store = await this.load();
    return Object.fromEntries(
      Object.entries(store).map(([k, v]) => [
        k,
        { hash: v.hash, cachedAt: v.cachedAt },
      ])
    );
  }
}
