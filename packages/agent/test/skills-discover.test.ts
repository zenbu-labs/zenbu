import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { discoverSkills } from "../src/skills/discover.ts";

function makeSkill(root: string, relDir: string, frontmatter: string, body = "") {
  const dir = path.join(root, relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "SKILL.md"),
    `---\n${frontmatter}\n---\n${body}`,
  );
}

describe("discoverSkills", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "zenbu-skills-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("returns empty result for nonexistent root", async () => {
    const res = await discoverSkills([path.join(root, "nope")]);
    expect(res.skills).toEqual([]);
    expect(res.errors).toEqual([]);
  });

  it("finds a valid top-level skill", async () => {
    makeSkill(
      root,
      "hello",
      `name: hello\ndescription: Use when the user says hi.`,
      "Respond cheerfully.",
    );
    const { skills, errors } = await discoverSkills([root]);
    expect(errors).toEqual([]);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: "hello",
      description: "Use when the user says hi.",
      root,
    });
    expect(skills[0].path).toBe(path.join(root, "hello", "SKILL.md"));
  });

  it("finds skills nested at arbitrary depth", async () => {
    makeSkill(
      root,
      "a/b/c/deep",
      `name: deep\ndescription: A deeply nested skill.`,
    );
    const { skills } = await discoverSkills([root]);
    expect(skills.map((s) => s.name)).toContain("deep");
  });

  it("respects .gitignore", async () => {
    writeFileSync(path.join(root, ".gitignore"), "ignored/\n");
    makeSkill(
      root,
      "visible",
      `name: visible\ndescription: Should be discovered.`,
    );
    makeSkill(
      root,
      "ignored/secret",
      `name: secret\ndescription: Should be skipped.`,
    );
    const { skills } = await discoverSkills([root]);
    const names = skills.map((s) => s.name);
    expect(names).toContain("visible");
    expect(names).not.toContain("secret");
  });

  it("skips malformed frontmatter with an error", async () => {
    makeSkill(root, "bad", `name: bad`); // missing description
    makeSkill(
      root,
      "good",
      `name: good\ndescription: Valid.`,
    );
    const { skills, errors } = await discoverSkills([root]);
    expect(skills.map((s) => s.name)).toEqual(["good"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toMatch(/description/i);
  });

  it("rejects invalid name characters", async () => {
    makeSkill(
      root,
      "bad-name",
      `name: Has_Uppercase\ndescription: Should fail name validation.`,
    );
    const { skills, errors } = await discoverSkills([root]);
    expect(skills).toEqual([]);
    expect(errors[0].reason).toMatch(/name/);
  });

  it("dedupes when the same file is reachable from two roots", async () => {
    makeSkill(
      root,
      "dup",
      `name: dup\ndescription: Reachable from two roots.`,
    );
    const { skills } = await discoverSkills([root, root]);
    expect(skills).toHaveLength(1);
  });

  it("merges skills from multiple distinct roots", async () => {
    const rootB = mkdtempSync(path.join(tmpdir(), "zenbu-skills-b-"));
    try {
      makeSkill(root, "a", `name: first\ndescription: From root A.`);
      makeSkill(rootB, "b", `name: second\ndescription: From root B.`);
      const { skills } = await discoverSkills([root, rootB]);
      expect(skills.map((s) => s.name).sort()).toEqual(["first", "second"]);
    } finally {
      rmSync(rootB, { recursive: true, force: true });
    }
  });
});
