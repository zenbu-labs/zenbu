import type { Skill } from "./discover.ts";

export function formatSkillsPrompt(skills: Skill[]): string {
  if (skills.length === 0) return "";
  const lines = skills
    .map(
      (s) =>
        `- **${s.name}** — ${s.description}\n  Path: ${s.path}`,
    )
    .join("\n");
  return `# Available Skills

The following agent skills are available. Each has a short description; the full instructions live on disk at the given path. If a skill is relevant to the user's request, use your file-reading tool to read the SKILL.md at the path before proceeding.

${lines}
`;
}
