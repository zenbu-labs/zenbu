import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Registry } from "../src/registry.ts";

describe("Registry", () => {
  let tempDir: string;
  let registry: Registry;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-test-"));
    registry = new Registry(join(tempDir, "puter.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("load", () => {
    it("returns empty state when file does not exist", async () => {
      const state = await registry.load();
      expect(state.config).toEqual({});
      expect(state.scripts).toEqual({});
    });

    it("parses existing state file", async () => {
      await registry.register("test", "/tmp/test.ts");
      const state = await registry.load();
      expect(state.scripts.test).toBeDefined();
      expect(state.scripts.test.path).toBe("/tmp/test.ts");
      expect(state.scripts.test.status).toBe("active");
    });
  });

  describe("register", () => {
    it("adds a new script entry", async () => {
      const entry = await registry.register("hello", "/usr/local/bin/hello");
      expect(entry.path).toBe("/usr/local/bin/hello");
      expect(entry.status).toBe("active");
      expect(entry.registeredAt).toBeTruthy();
    });

    it("throws on duplicate name", async () => {
      await registry.register("dup", "/tmp/a");
      await expect(registry.register("dup", "/tmp/b")).rejects.toThrow(
        'Script "dup" is already registered'
      );
    });

    it("persists across load cycles", async () => {
      await registry.register("persist", "/tmp/persist.ts");
      const fresh = new Registry(join(tempDir, "puter.json"));
      const state = await fresh.load();
      expect(state.scripts.persist.path).toBe("/tmp/persist.ts");
    });
  });

  describe("list / listActive", () => {
    it("lists all scripts", async () => {
      await registry.register("a", "/tmp/a");
      await registry.register("b", "/tmp/b");
      const all = await registry.list();
      expect(Object.keys(all)).toEqual(["a", "b"]);
    });

    it("listActive filters archived scripts", async () => {
      await registry.register("keep", "/tmp/keep");
      await registry.register("drop", "/tmp/drop");
      await registry.archive("drop");
      const active = await registry.listActive();
      expect(Object.keys(active)).toEqual(["keep"]);
    });
  });

  describe("get", () => {
    it("returns existing entry", async () => {
      await registry.register("foo", "/tmp/foo");
      const entry = await registry.get("foo");
      expect(entry.path).toBe("/tmp/foo");
    });

    it("throws for missing script", async () => {
      await expect(registry.get("nope")).rejects.toThrow(
        'Script "nope" not found'
      );
    });
  });

  describe("update", () => {
    it("updates path for existing script", async () => {
      await registry.register("upd", "/tmp/old");
      const entry = await registry.update("upd", "/tmp/new");
      expect(entry.path).toBe("/tmp/new");

      const reloaded = await registry.get("upd");
      expect(reloaded.path).toBe("/tmp/new");
    });

    it("throws for missing script", async () => {
      await expect(registry.update("missing", "/tmp/x")).rejects.toThrow(
        'Script "missing" not found'
      );
    });
  });

  describe("archive", () => {
    it("sets status to archived", async () => {
      await registry.register("arc", "/tmp/arc");
      const entry = await registry.archive("arc");
      expect(entry.status).toBe("archived");
    });

    it("throws for missing script", async () => {
      await expect(registry.archive("ghost")).rejects.toThrow(
        'Script "ghost" not found'
      );
    });

    it("throws if already archived", async () => {
      await registry.register("twice", "/tmp/twice");
      await registry.archive("twice");
      await expect(registry.archive("twice")).rejects.toThrow(
        'Script "twice" is already archived'
      );
    });
  });

  describe("config", () => {
    it("returns empty config by default", async () => {
      const config = await registry.getConfig();
      expect(config).toEqual({});
    });

    it("sets and retrieves agent preference", async () => {
      await registry.setConfig({ agent: "opencode" });
      const config = await registry.getConfig();
      expect(config.agent).toBe("opencode");
    });

    it("merges partial config updates", async () => {
      await registry.setConfig({ agent: "codex" });
      await registry.setConfig({ agent: "opencode" });
      const config = await registry.getConfig();
      expect(config.agent).toBe("opencode");
    });
  });
});
