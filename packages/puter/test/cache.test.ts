import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SummaryCache, hashBundle } from "../src/cache.ts";

describe("hashBundle", () => {
  it("returns a hex sha256 hash", () => {
    const h = hashBundle("hello");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic", () => {
    expect(hashBundle("same content")).toBe(hashBundle("same content"));
  });

  it("differs for different content", () => {
    expect(hashBundle("a")).not.toBe(hashBundle("b"));
  });
});

describe("SummaryCache", () => {
  let tempDir: string;
  let cache: SummaryCache;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-cache-test-"));
    cache = new SummaryCache(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("get", () => {
    it("returns null for missing entry", async () => {
      const result = await cache.get("foo", "some bundle");
      expect(result).toBeNull();
    });

    it("returns null when hash doesn't match (code changed)", async () => {
      await cache.set("tool", "original code", "original summary");
      const result = await cache.get("tool", "modified code");
      expect(result).toBeNull();
    });

    it("returns cached summary when hash matches", async () => {
      const bundle = "const x = 1;\nconsole.log(x);";
      await cache.set("tool", bundle, "Prints the number 1");

      const result = await cache.get("tool", bundle);
      expect(result).toBe("Prints the number 1");
    });
  });

  describe("set", () => {
    it("stores and retrieves a summary", async () => {
      await cache.set("my-cli", "code here", "It does stuff");
      const result = await cache.get("my-cli", "code here");
      expect(result).toBe("It does stuff");
    });

    it("overwrites previous entry for same script", async () => {
      await cache.set("cli", "v1 code", "v1 summary");
      await cache.set("cli", "v2 code", "v2 summary");

      expect(await cache.get("cli", "v1 code")).toBeNull();
      expect(await cache.get("cli", "v2 code")).toBe("v2 summary");
    });

    it("stores multiple scripts independently", async () => {
      await cache.set("a", "code-a", "summary-a");
      await cache.set("b", "code-b", "summary-b");

      expect(await cache.get("a", "code-a")).toBe("summary-a");
      expect(await cache.get("b", "code-b")).toBe("summary-b");
    });

    it("persists across instances", async () => {
      await cache.set("persist", "code", "cached result");

      const fresh = new SummaryCache(tempDir);
      expect(await fresh.get("persist", "code")).toBe("cached result");
    });
  });

  describe("invalidate", () => {
    it("removes a cached entry", async () => {
      await cache.set("rm-me", "code", "summary");
      const removed = await cache.invalidate("rm-me");
      expect(removed).toBe(true);
      expect(await cache.get("rm-me", "code")).toBeNull();
    });

    it("returns false for missing entry", async () => {
      const removed = await cache.invalidate("ghost");
      expect(removed).toBe(false);
    });

    it("does not affect other entries", async () => {
      await cache.set("keep", "code-k", "keep-summary");
      await cache.set("drop", "code-d", "drop-summary");

      await cache.invalidate("drop");
      expect(await cache.get("keep", "code-k")).toBe("keep-summary");
    });
  });

  describe("list", () => {
    it("returns empty object when no cache", async () => {
      const entries = await cache.list();
      expect(entries).toEqual({});
    });

    it("returns all cached script names with metadata", async () => {
      await cache.set("alpha", "code-a", "sum-a");
      await cache.set("beta", "code-b", "sum-b");

      const entries = await cache.list();
      expect(Object.keys(entries).sort()).toEqual(["alpha", "beta"]);
      expect(entries.alpha.hash).toBe(hashBundle("code-a"));
      expect(entries.alpha.cachedAt).toBeTruthy();
    });
  });

  describe("cache invalidation on code change", () => {
    it("automatically misses when source code changes", async () => {
      const v1 = "function main() { console.log('v1'); }";
      const v2 = "function main() { console.log('v2'); }";

      await cache.set("deploy", v1, "Deploys v1");

      expect(await cache.get("deploy", v1)).toBe("Deploys v1");
      expect(await cache.get("deploy", v2)).toBeNull();
    });

    it("updates cache when re-set with new code", async () => {
      const v1 = "old code";
      const v2 = "new code";

      await cache.set("tool", v1, "old summary");
      await cache.set("tool", v2, "new summary");

      expect(await cache.get("tool", v1)).toBeNull();
      expect(await cache.get("tool", v2)).toBe("new summary");
    });
  });
});
