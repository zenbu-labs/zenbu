import { readFile, stat } from "node:fs/promises";
import { relative, basename } from "node:path";
import { collectFiles } from "./commands/cat.ts";
import { Registry } from "./registry.ts";
import { resolveAgent } from "./agents/resolve.ts";
import { createSpinner } from "./spinner.ts";
import { SummaryCache } from "./cache.ts";

const PROMPT_TEMPLATE = `You are a helpful assistant. The user has a CLI script and wants to understand what it does.

Below is the full source code of the script. Read it carefully and provide a concise, practical explanation of what the script does, what arguments/flags it accepts, and any important behavior.

Wrap your answer in <puter-answer> tags. Only the content inside these tags will be shown to the user.

<source-bundle>
{BUNDLE}
</source-bundle>

Respond with your explanation inside <puter-answer>...</puter-answer> tags.`;

export async function buildCodeBundle(scriptPath: string): Promise<string> {
  const info = await stat(scriptPath);

  if (info.isFile()) {
    const content = await readFile(scriptPath, "utf-8");
    return `── ${basename(scriptPath)} ──\n${content}`;
  }

  const files = await collectFiles(scriptPath);
  if (files.length === 0) {
    throw new Error("No source files found in script directory.");
  }

  const parts: string[] = [];
  for (const file of files) {
    const rel = relative(scriptPath, file);
    const content = await readFile(file, "utf-8");
    parts.push(`── ${rel} ──\n${content}`);
  }
  return parts.join("\n\n");
}

export function buildPrompt(bundle: string): string {
  return PROMPT_TEMPLATE.replace("{BUNDLE}", bundle);
}

export function extractAnswer(text: string): string | null {
  const open = "<puter-answer>";
  const close = "</puter-answer>";
  const start = text.indexOf(open);
  const end = text.indexOf(close);
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start + open.length, end).trim();
}

export async function magicHelp(
  scriptPath: string,
  registry: Registry,
  opts?: { scriptName?: string; cache?: SummaryCache }
): Promise<void> {
  const bundle = await buildCodeBundle(scriptPath);
  const cache = opts?.cache ?? new SummaryCache();
  const cacheKey = opts?.scriptName ?? scriptPath;

  const cached = await cache.get(cacheKey, bundle);
  if (cached) {
    process.stderr.write("\x1b[2m✓ Cached\x1b[0m\n");
    console.log(cached);
    return;
  }

  const prompt = buildPrompt(bundle);
  const spinner = createSpinner("Thinking");

  const provider = await resolveAgent(registry);
  const session = await provider.createSession();

  try {
    const response = await session.prompt(prompt, {
      onDelta(_delta, accumulated) {
        spinner.update(accumulated.length);
      },
    });

    spinner.stop("Done");

    const answer = extractAnswer(response) ?? response;
    await cache.set(cacheKey, bundle, answer);
    console.log(answer);
  } catch (err) {
    spinner.stop();
    throw err;
  } finally {
    session.close();
  }
}
