import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Registry } from "../../src/registry.ts";

vi.mock("../../src/agents/resolve.ts", () => ({
  resolveAgent: vi.fn().mockResolvedValue({
    name: "codex",
    createSession: vi.fn().mockResolvedValue({
      prompt: vi.fn().mockResolvedValue(
        "<puter-answer>Script A does X, Script B does Y.</puter-answer>"
      ),
      close: vi.fn(),
    }),
  }),
}));

vi.mock("../../src/spinner.ts", () => ({
  createSpinner: () => ({
    update: vi.fn(),
    stop: vi.fn(),
  }),
}));

import { magicCommand } from "../../src/commands/magic.ts";

describe("magicCommand", () => {
  let tempDir: string;
  let registry: Registry;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-magic-test-"));
    registry = new Registry(join(tempDir, "puter.json"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("prints help with --help", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await magicCommand(["--help"], registry);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("puter magic");
    expect(output).toContain("<prompt>");
    spy.mockRestore();
  });

  it("prints help with no args", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await magicCommand([], registry);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("puter magic");
    spy.mockRestore();
  });

  it("throws when no scripts are registered", async () => {
    await expect(
      magicCommand(["what do my tools do?"], registry)
    ).rejects.toThrow("No scripts registered");
  });

  it("sends prompt to agent and prints extracted answer", async () => {
    const script = join(tempDir, "tool.ts");
    await writeFile(script, 'console.log("hello")');
    await registry.register("tool", script, "A tool");

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await magicCommand(["what does tool do?"], registry);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Script A does X");
    spy.mockRestore();
  });

  it("joins multiple args into a single prompt", async () => {
    const script = join(tempDir, "x.ts");
    await writeFile(script, "x");
    await registry.register("x", script);

    const { resolveAgent } = await import("../../src/agents/resolve.ts");
    const mockResolve = resolveAgent as ReturnType<typeof vi.fn>;
    const mockPrompt = vi.fn().mockResolvedValue(
      "<puter-answer>joined answer</puter-answer>"
    );
    mockResolve.mockResolvedValueOnce({
      name: "codex",
      createSession: vi.fn().mockResolvedValue({
        prompt: mockPrompt,
        close: vi.fn(),
      }),
    });

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await magicCommand(["tell", "me", "about", "x"], registry);

    const promptArg = mockPrompt.mock.calls[0][0] as string;
    expect(promptArg).toContain("tell me about x");
    spy.mockRestore();
  });

  it("includes script source code in the prompt", async () => {
    const script = join(tempDir, "src.ts");
    await writeFile(script, "export function deploy() { /* deploy logic */ }");
    await registry.register("deploy", script, "Deploy script");

    const { resolveAgent } = await import("../../src/agents/resolve.ts");
    const mockResolve = resolveAgent as ReturnType<typeof vi.fn>;
    const mockPrompt = vi.fn().mockResolvedValue(
      "<puter-answer>it deploys</puter-answer>"
    );
    mockResolve.mockResolvedValueOnce({
      name: "codex",
      createSession: vi.fn().mockResolvedValue({
        prompt: mockPrompt,
        close: vi.fn(),
      }),
    });

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await magicCommand(["what does deploy do?"], registry);

    const promptArg = mockPrompt.mock.calls[0][0] as string;
    expect(promptArg).toContain("[deploy]");
    expect(promptArg).toContain("deploy logic");
    expect(promptArg).toContain("Deploy script");
    spy.mockRestore();
  });

  it("handles multiple scripts in context", async () => {
    const s1 = join(tempDir, "a.ts");
    const s2 = join(tempDir, "b.ts");
    await writeFile(s1, "script a");
    await writeFile(s2, "script b");
    await registry.register("alpha", s1, "First tool");
    await registry.register("beta", s2, "Second tool");

    const { resolveAgent } = await import("../../src/agents/resolve.ts");
    const mockResolve = resolveAgent as ReturnType<typeof vi.fn>;
    const mockPrompt = vi.fn().mockResolvedValue(
      "<puter-answer>both tools</puter-answer>"
    );
    mockResolve.mockResolvedValueOnce({
      name: "codex",
      createSession: vi.fn().mockResolvedValue({
        prompt: mockPrompt,
        close: vi.fn(),
      }),
    });

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await magicCommand(["compare alpha and beta"], registry);

    const promptArg = mockPrompt.mock.calls[0][0] as string;
    expect(promptArg).toContain("[alpha]");
    expect(promptArg).toContain("[beta]");
    expect(promptArg).toContain("First tool");
    expect(promptArg).toContain("Second tool");
    spy.mockRestore();
  });
});
