import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Registry } from "../../src/registry.ts";
import { listCommand } from "../../src/commands/list.ts";

describe("listCommand", () => {
  let tempDir: string;
  let registry: Registry;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-list-test-"));
    registry = new Registry(join(tempDir, "puter.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("shows empty message when no scripts", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await listCommand(registry);
    expect(spy.mock.calls[0][0]).toContain("No scripts registered");
    spy.mockRestore();
  });

  it("lists active scripts with aligned columns", async () => {
    await registry.register("short", "/tmp/short");
    await registry.register("much-longer-name", "/tmp/long");

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await listCommand(registry);
    const lines = spy.mock.calls.map((c) => c[0]);
    expect(lines.some((l: string) => l.includes("short"))).toBe(true);
    expect(lines.some((l: string) => l.includes("much-longer-name"))).toBe(true);
    spy.mockRestore();
  });

  it("excludes archived scripts", async () => {
    await registry.register("active", "/tmp/active");
    await registry.register("hidden", "/tmp/hidden");
    await registry.archive("hidden");

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await listCommand(registry);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("active");
    expect(output).not.toContain("hidden");
    spy.mockRestore();
  });

  it("shows descriptions when present", async () => {
    await registry.register("tool", "/tmp/tool", "A handy tool");

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await listCommand(registry);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("A handy tool");
    spy.mockRestore();
  });

  it("shows archived scripts with --all", async () => {
    await registry.register("alive", "/tmp/alive");
    await registry.register("dead", "/tmp/dead");
    await registry.archive("dead");

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await listCommand(registry, ["--all"]);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("alive");
    expect(output).toContain("dead");
    expect(output).toContain("archived");
    spy.mockRestore();
  });

  it("prints help with --help", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await listCommand(registry, ["--help"]);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("puter list");
    expect(output).toContain("--all");
    spy.mockRestore();
  });
});
