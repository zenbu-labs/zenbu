import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Registry } from "../../src/registry.ts";
import { archiveCommand } from "../../src/commands/archive.ts";

describe("archiveCommand", () => {
  let tempDir: string;
  let registry: Registry;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-archive-test-"));
    registry = new Registry(join(tempDir, "puter.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("archives an active script", async () => {
    await registry.register("target", "/tmp/target");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await archiveCommand(["target"], registry);

    const entry = await registry.get("target");
    expect(entry.status).toBe("archived");
    spy.mockRestore();
  });

  it("throws without a name argument", async () => {
    await expect(archiveCommand([], registry)).rejects.toThrow(
      "Usage: puter archive <name>"
    );
  });

  it("throws for nonexistent script", async () => {
    await expect(archiveCommand(["nope"], registry)).rejects.toThrow(
      'Script "nope" not found'
    );
  });

  it("prints help with --help", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await archiveCommand(["--help"], registry);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("puter archive");
    spy.mockRestore();
  });
});
