import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Registry } from "../../src/registry.ts";

vi.mock("../../src/magic-help.ts", () => ({
  magicHelp: vi.fn().mockResolvedValue(undefined),
}));

import { runCommand } from "../../src/commands/run.ts";

describe("runCommand", () => {
  let tempDir: string;
  let registry: Registry;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-run-test-"));
    registry = new Registry(join(tempDir, "puter.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("runs a registered script via bun", async () => {
    const script = join(tempDir, "hello.ts");
    await writeFile(script, 'console.log("hello from puter")');
    await registry.register("hello", script);

    const code = await runCommand("hello", [], registry);
    expect(code).toBe(0);
  });

  it("passes arguments through to the script", async () => {
    const script = join(tempDir, "args.ts");
    await writeFile(
      script,
      'const args = process.argv.slice(2); if (args[0] !== "foo") process.exit(1);'
    );
    await registry.register("args", script);

    const code = await runCommand("args", ["foo"], registry);
    expect(code).toBe(0);
  });

  it("throws for archived script", async () => {
    await registry.register("old", "/tmp/old");
    await registry.archive("old");

    await expect(runCommand("old", [], registry)).rejects.toThrow("archived");
  });

  it("invokes magic-help when --magic-help is present", async () => {
    const { magicHelp } = await import("../../src/magic-help.ts");
    const script = join(tempDir, "mh.ts");
    await writeFile(script, "console.log('x')");
    await registry.register("mh", script);

    const code = await runCommand("mh", ["--magic-help"], registry);
    expect(code).toBe(0);
    expect(magicHelp).toHaveBeenCalledWith(script, registry, { scriptName: "mh" });
  });
});
