import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Registry } from "../../src/registry.ts";
import { catCommand, collectFiles } from "../../src/commands/cat.ts";

describe("catCommand", () => {
  let tempDir: string;
  let registry: Registry;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-cat-test-"));
    registry = new Registry(join(tempDir, "puter.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("prints a single file", async () => {
    const script = join(tempDir, "single.ts");
    await writeFile(script, 'console.log("hello")');
    await registry.register("single", script);

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await catCommand(["single"], registry);

    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("single.ts");
    expect(output).toContain('console.log("hello")');
    spy.mockRestore();
  });

  it("prints all files in a directory", async () => {
    const dir = join(tempDir, "proj");
    await mkdir(dir);
    await writeFile(join(dir, "main.ts"), "main()");
    await writeFile(join(dir, "lib.ts"), "export const x = 1");
    await registry.register("proj", dir);

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await catCommand(["proj"], registry);

    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("main.ts");
    expect(output).toContain("lib.ts");
    expect(output).toContain("main()");
    spy.mockRestore();
  });

  it("throws without a name argument", async () => {
    await expect(catCommand([], registry)).rejects.toThrow(
      "Usage: puter cat <name>"
    );
  });

  it("prints help with --help", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await catCommand(["--help"], registry);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("puter cat");
    spy.mockRestore();
  });
});

describe("collectFiles", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-collect-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("collects source files recursively", async () => {
    const sub = join(tempDir, "sub");
    await mkdir(sub);
    await writeFile(join(tempDir, "a.ts"), "a");
    await writeFile(join(sub, "b.ts"), "b");

    const files = await collectFiles(tempDir);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith("a.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("b.ts"))).toBe(true);
  });

  it("ignores node_modules and .git", async () => {
    await mkdir(join(tempDir, "node_modules"));
    await writeFile(join(tempDir, "node_modules", "dep.js"), "dep");
    await mkdir(join(tempDir, ".git"));
    await writeFile(join(tempDir, ".git", "config"), "git");
    await writeFile(join(tempDir, "real.ts"), "real");

    const files = await collectFiles(tempDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("real.ts");
  });

  it("ignores binary extensions", async () => {
    await writeFile(join(tempDir, "image.png"), "binary");
    await writeFile(join(tempDir, "code.ts"), "code");

    const files = await collectFiles(tempDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("code.ts");
  });

  it("returns sorted file list", async () => {
    await writeFile(join(tempDir, "z.ts"), "z");
    await writeFile(join(tempDir, "a.ts"), "a");
    await writeFile(join(tempDir, "m.ts"), "m");

    const files = await collectFiles(tempDir);
    const names = files.map((f) => f.split("/").pop());
    expect(names).toEqual(["a.ts", "m.ts", "z.ts"]);
  });
});
