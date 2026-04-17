import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Registry } from "../../src/registry.ts";
import { updateCommand } from "../../src/commands/update.ts";

describe("updateCommand", () => {
  let tempDir: string;
  let registry: Registry;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-update-test-"));
    registry = new Registry(join(tempDir, "puter.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("updates the path of an existing script", async () => {
    const oldPath = join(tempDir, "old.ts");
    const newPath = join(tempDir, "new.ts");
    await writeFile(oldPath, "old");
    await writeFile(newPath, "new");
    await registry.register("target", oldPath);

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await updateCommand(["--name", "target", newPath], registry);

    const entry = await registry.get("target");
    expect(entry.path).toBe(newPath);
    spy.mockRestore();
  });

  it("throws when name is missing", async () => {
    await expect(
      updateCommand(["/tmp/x"], registry)
    ).rejects.toThrow("Missing required flag: --name");
  });

  it("throws when path is missing", async () => {
    await registry.register("np", "/tmp/np");
    await expect(
      updateCommand(["--name", "np"], registry)
    ).rejects.toThrow("Usage:");
  });

  it("throws when script does not exist", async () => {
    const p = join(tempDir, "exists.ts");
    await writeFile(p, "x");
    await expect(
      updateCommand(["--name", "ghost", p], registry)
    ).rejects.toThrow('Script "ghost" not found');
  });

  it("throws when new path does not exist on disk", async () => {
    await registry.register("pathcheck", "/tmp/pathcheck");
    await expect(
      updateCommand(["--name", "pathcheck", "/nonexistent"], registry)
    ).rejects.toThrow("Path does not exist");
  });

  it("prints help with --help", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await updateCommand(["--help"], registry);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("puter update");
    expect(output).toContain("--name");
    spy.mockRestore();
  });
});
