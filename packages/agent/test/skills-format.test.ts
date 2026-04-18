import { describe, it, expect } from "vitest";
import { formatSkillsPrompt } from "../src/skills/format.ts";
import type { Skill } from "../src/skills/discover.ts";

describe("formatSkillsPrompt", () => {
  it("returns empty string for no skills", () => {
    expect(formatSkillsPrompt([])).toBe("");
  });

  it("includes each skill's name, description, and absolute path", () => {
    const skills: Skill[] = [
      {
        name: "alpha",
        description: "First skill.",
        path: "/tmp/skills/alpha/SKILL.md",
        root: "/tmp/skills",
      },
      {
        name: "beta",
        description: "Second skill.",
        path: "/tmp/skills/beta/SKILL.md",
        root: "/tmp/skills",
      },
    ];
    const out = formatSkillsPrompt(skills);
    expect(out).toContain("alpha");
    expect(out).toContain("First skill.");
    expect(out).toContain("/tmp/skills/alpha/SKILL.md");
    expect(out).toContain("beta");
    expect(out).toContain("Second skill.");
    expect(out).toContain("/tmp/skills/beta/SKILL.md");
  });

  it("instructs the agent how to load the full SKILL.md on demand", () => {
    const skills: Skill[] = [
      {
        name: "x",
        description: "A skill.",
        path: "/x/SKILL.md",
        root: "/",
      },
    ];
    const out = formatSkillsPrompt(skills);
    expect(out.toLowerCase()).toMatch(/read/);
    expect(out).toContain("SKILL.md");
  });
});
