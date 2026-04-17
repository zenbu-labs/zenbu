import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Registry } from "../src/registry.ts";
import { runCli, parseFlag, hasFlag, stripFlags } from "../src/cli.ts";

describe("CLI utilities", () => {
  describe("parseFlag", () => {
    it("extracts flag value", () => {
      expect(parseFlag(["--name", "foo"], "--name")).toBe("foo");
    });

    it("returns undefined for missing flag", () => {
      expect(parseFlag(["--other", "val"], "--name")).toBeUndefined();
    });

    it("returns undefined if flag is last arg", () => {
      expect(parseFlag(["--name"], "--name")).toBeUndefined();
    });
  });

  describe("hasFlag", () => {
    it("returns true when present", () => {
      expect(hasFlag(["--magic-help", "foo"], "--magic-help")).toBe(true);
    });

    it("returns false when absent", () => {
      expect(hasFlag(["foo", "bar"], "--magic-help")).toBe(false);
    });
  });

  describe("stripFlags", () => {
    it("removes boolean flags", () => {
      expect(stripFlags(["--magic-help", "arg"], ["--magic-help"])).toEqual([
        "arg",
      ]);
    });

    it("removes value-bearing flags with their values", () => {
      expect(
        stripFlags(["--name", "foo", "arg"], ["--name"])
      ).toEqual(["arg"]);
    });

    it("preserves unrelated args", () => {
      expect(
        stripFlags(["a", "b", "c"], ["--magic-help"])
      ).toEqual(["a", "b", "c"]);
    });
  });
});

describe("runCli", () => {
  let tempDir: string;
  let registry: Registry;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-cli-test-"));
    registry = new Registry(join(tempDir, "puter.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("prints help with no args", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await runCli([], { registry });
    expect(code).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("prints help with --help", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await runCli(["--help"], { registry });
    expect(code).toBe(0);
    spy.mockRestore();
  });

  it("registers a script", async () => {
    const scriptPath = join(tempDir, "test.ts");
    await writeFile(scriptPath, "console.log('hi')");

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await runCli(
      ["register", scriptPath, "--name", "test-script"],
      { registry }
    );
    expect(code).toBe(0);

    const entry = await registry.get("test-script");
    expect(entry.path).toBe(scriptPath);
    spy.mockRestore();
  });

  it("lists scripts", async () => {
    await registry.register("s1", "/tmp/s1");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await runCli(["list"], { registry });
    expect(code).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("updates a script", async () => {
    const oldPath = join(tempDir, "old.ts");
    const newPath = join(tempDir, "new.ts");
    await writeFile(oldPath, "old");
    await writeFile(newPath, "new");
    await registry.register("updatable", oldPath);

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await runCli(
      ["update", "--name", "updatable", newPath],
      { registry }
    );
    expect(code).toBe(0);
    const entry = await registry.get("updatable");
    expect(entry.path).toBe(newPath);
    spy.mockRestore();
  });

  it("archives a script", async () => {
    await registry.register("archivable", "/tmp/arch");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await runCli(["archive", "archivable"], { registry });
    expect(code).toBe(0);
    const entry = await registry.get("archivable");
    expect(entry.status).toBe("archived");
    spy.mockRestore();
  });

  it("cats a script file", async () => {
    const scriptPath = join(tempDir, "readable.ts");
    await writeFile(scriptPath, 'console.log("hello")');
    await registry.register("readable", scriptPath);

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await runCli(["cat", "readable"], { registry });
    expect(code).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("cats a script directory", async () => {
    const dir = join(tempDir, "myproject");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.ts"), "export default 42");
    await writeFile(join(dir, "util.ts"), "export const x = 1");
    await registry.register("myproject", dir);

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await runCli(["cat", "myproject"], { registry });
    expect(code).toBe(0);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("index.ts");
    expect(output).toContain("util.ts");
    spy.mockRestore();
  });

  it("returns error for unknown flag", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await runCli(["--unknown"], { registry });
    expect(code).toBe(1);
    spy.mockRestore();
  });

  it("returns error for missing script name", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await runCli(["nonexistent"], { registry });
    expect(code).toBe(1);
    spy.mockRestore();
  });
});
