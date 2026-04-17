import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Registry } from "../../src/registry.ts";
import { registerCommand } from "../../src/commands/register.ts";

describe("registerCommand", () => {
  let tempDir: string;
  let registry: Registry;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-reg-test-"));
    registry = new Registry(join(tempDir, "puter.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("registers a script with --name flag", async () => {
    const script = join(tempDir, "myscript.ts");
    await writeFile(script, "console.log('hi')");

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await registerCommand([script, "--name", "myname"], registry);

    const entry = await registry.get("myname");
    expect(entry.path).toBe(script);
    expect(entry.status).toBe("active");
    spy.mockRestore();
  });

  it("resolves relative paths to absolute", async () => {
    const script = join(tempDir, "relative.ts");
    await writeFile(script, "x");

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await registerCommand([script, "--name", "rel"], registry);

    const entry = await registry.get("rel");
    expect(entry.path).toMatch(/^\//);
    spy.mockRestore();
  });

  it("throws when path does not exist", async () => {
    await expect(
      registerCommand(["/nonexistent/path.ts", "--name", "bad"], registry)
    ).rejects.toThrow("Path does not exist");
  });

  it("throws when --name is missing", async () => {
    const script = join(tempDir, "noname.ts");
    await writeFile(script, "x");
    await expect(
      registerCommand([script], registry)
    ).rejects.toThrow("Missing required flag: --name");
  });

  it("throws when path is missing", async () => {
    await expect(
      registerCommand(["--name", "orphan"], registry)
    ).rejects.toThrow("Usage:");
  });

  it("stores description when provided", async () => {
    const script = join(tempDir, "desc.ts");
    await writeFile(script, "x");

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await registerCommand(
      [script, "--name", "desc", "--description", "A cool tool"],
      registry
    );

    const entry = await registry.get("desc");
    expect(entry.description).toBe("A cool tool");
    spy.mockRestore();
  });

  it("prints help with --help", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await registerCommand(["--help"], registry);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("puter register");
    expect(output).toContain("--name");
    spy.mockRestore();
  });
});
