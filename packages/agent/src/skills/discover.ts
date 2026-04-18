import { globby } from "globby";
import fsp from "node:fs/promises";
import yaml from "js-yaml";

export type Skill = {
  name: string;
  description: string;
  path: string;
  root: string;
};

export type SkillDiscoveryError = {
  path: string;
  reason: string;
};

export type SkillDiscoveryResult = {
  skills: Skill[];
  errors: SkillDiscoveryError[];
};

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateName(name: unknown): string | null {
  if (typeof name !== "string") return "name must be a string";
  if (name.length < 1 || name.length > 64) return "name length must be 1–64";
  if (!NAME_RE.test(name))
    return "name must be lowercase letters/digits separated by single hyphens";
  return null;
}

function validateDescription(desc: unknown): string | null {
  if (typeof desc !== "string") return "description must be a string";
  if (desc.length < 1 || desc.length > 1024)
    return "description length must be 1–1024";
  return null;
}

function parseFrontmatter(
  source: string,
): { frontmatter: Record<string, unknown> } | { error: string } {
  if (!source.startsWith("---")) return { error: "missing frontmatter fence" };
  const rest = source.slice(3);
  const end = rest.indexOf("\n---");
  if (end === -1) return { error: "unterminated frontmatter" };
  const raw = rest.slice(0, end).replace(/^\r?\n/, "");
  try {
    const parsed = yaml.load(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { frontmatter: parsed as Record<string, unknown> };
    }
    return { error: "frontmatter must be a YAML mapping" };
  } catch (e) {
    return { error: `yaml parse error: ${(e as Error).message}` };
  }
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const stat = await fsp.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function discoverSkills(
  roots: string[],
): Promise<SkillDiscoveryResult> {
  const skills: Skill[] = [];
  const errors: SkillDiscoveryError[] = [];
  const seen = new Set<string>();

  for (const root of roots) {
    if (!(await dirExists(root))) continue;
    let files: string[];
    try {
      files = await globby(["**/SKILL.md"], {
        cwd: root,
        absolute: true,
        gitignore: true,
        dot: false,
        followSymbolicLinks: false,
      });
    } catch (e) {
      errors.push({ path: root, reason: `glob failed: ${(e as Error).message}` });
      continue;
    }

    for (const file of files) {
      if (seen.has(file)) continue;
      seen.add(file);
      let content: string;
      try {
        content = await fsp.readFile(file, "utf8");
      } catch (e) {
        errors.push({ path: file, reason: `read failed: ${(e as Error).message}` });
        continue;
      }
      const parsed = parseFrontmatter(content);
      if ("error" in parsed) {
        errors.push({ path: file, reason: parsed.error });
        continue;
      }
      const { name, description } = parsed.frontmatter;
      const nameError = validateName(name);
      if (nameError) {
        errors.push({ path: file, reason: nameError });
        continue;
      }
      const descError = validateDescription(description);
      if (descError) {
        errors.push({ path: file, reason: descError });
        continue;
      }
      skills.push({
        name: name as string,
        description: description as string,
        path: file,
        root,
      });
    }
  }

  return { skills, errors };
}
