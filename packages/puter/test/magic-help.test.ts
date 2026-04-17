import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildCodeBundle,
  buildPrompt,
  extractAnswer,
} from "../src/magic-help.ts";

describe("buildCodeBundle", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "puter-magic-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("bundles a single file", async () => {
    const file = join(tempDir, "script.ts");
    await writeFile(file, 'console.log("hello")');

    const bundle = await buildCodeBundle(file);
    expect(bundle).toContain("script.ts");
    expect(bundle).toContain('console.log("hello")');
  });

  it("bundles a directory with multiple files", async () => {
    const dir = join(tempDir, "project");
    await mkdir(dir);
    await writeFile(join(dir, "main.ts"), "main()");
    await writeFile(join(dir, "lib.ts"), "export const x = 1");

    const bundle = await buildCodeBundle(dir);
    expect(bundle).toContain("main.ts");
    expect(bundle).toContain("lib.ts");
    expect(bundle).toContain("main()");
    expect(bundle).toContain("export const x = 1");
  });

  it("includes nested files", async () => {
    const dir = join(tempDir, "nested");
    const sub = join(dir, "sub");
    await mkdir(sub, { recursive: true });
    await writeFile(join(dir, "root.ts"), "root");
    await writeFile(join(sub, "deep.ts"), "deep");

    const bundle = await buildCodeBundle(dir);
    expect(bundle).toContain("root.ts");
    expect(bundle).toContain("sub/deep.ts");
  });

  it("throws for empty directory", async () => {
    const dir = join(tempDir, "empty");
    await mkdir(dir);

    await expect(buildCodeBundle(dir)).rejects.toThrow("No source files");
  });
});

describe("buildPrompt", () => {
  it("embeds the bundle in the prompt template", () => {
    const prompt = buildPrompt("file content here");
    expect(prompt).toContain("file content here");
    expect(prompt).toContain("<source-bundle>");
    expect(prompt).toContain("</source-bundle>");
    expect(prompt).toContain("<puter-answer>");
  });

  it("preserves the bundle content exactly", () => {
    const bundle = "line 1\nline 2\nspecial chars: <>\"'&";
    const prompt = buildPrompt(bundle);
    expect(prompt).toContain(bundle);
  });
});

describe("extractAnswer", () => {
  it("extracts content between puter-answer tags", () => {
    const text =
      "Some preamble\n<puter-answer>This is the answer.</puter-answer>\nSuffix";
    expect(extractAnswer(text)).toBe("This is the answer.");
  });

  it("handles multiline answers", () => {
    const text = `<puter-answer>
Line 1
Line 2
Line 3
</puter-answer>`;
    const answer = extractAnswer(text);
    expect(answer).toContain("Line 1");
    expect(answer).toContain("Line 2");
    expect(answer).toContain("Line 3");
  });

  it("returns null when no opening tag", () => {
    expect(extractAnswer("No tags here")).toBeNull();
  });

  it("returns null when no closing tag", () => {
    expect(extractAnswer("<puter-answer>unclosed")).toBeNull();
  });

  it("returns null when tags are in wrong order", () => {
    expect(
      extractAnswer("</puter-answer>reversed<puter-answer>")
    ).toBeNull();
  });

  it("trims whitespace from extracted answer", () => {
    const text = "<puter-answer>  spaces  </puter-answer>";
    expect(extractAnswer(text)).toBe("spaces");
  });

  it("handles tags with content before and after", () => {
    const text =
      'Here is my analysis:\n\n<puter-answer>This CLI tool processes CSV files and outputs JSON.</puter-answer>\n\nHope that helps!';
    expect(extractAnswer(text)).toBe(
      "This CLI tool processes CSV files and outputs JSON."
    );
  });

  it("works with streaming chunks that arrive as a complete string", () => {
    const chunks = [
      "Let me analyze",
      " this code.\n\n<puter-answer>",
      "This script converts markdown to HTML",
      " using a custom parser.</puter-answer>",
      "\n\nDone.",
    ];
    const full = chunks.join("");
    expect(extractAnswer(full)).toBe(
      "This script converts markdown to HTML using a custom parser."
    );
  });
});
