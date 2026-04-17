import { readFile, stat } from "node:fs/promises";
import { relative, basename } from "node:path";
import type { Registry } from "../registry.ts";
import { hasFlag } from "../cli.ts";
import { resolveAgent } from "../agents/resolve.ts";
import { createSpinner } from "../spinner.ts";
import { extractAnswer } from "../magic-help.ts";
import { collectFiles } from "./cat.ts";

export const MAGIC_HELP = `puter magic - Ask an AI agent anything about your scripts

Usage:
  puter magic "<prompt>"

Loads all your registered scripts as context and sends your freeform
prompt to an AI agent (codex or opencode). Great for:

  - Searching across your CLIs ("which tool deploys to staging?")
  - Understanding code ("how does my build script handle errors?")
  - Getting usage help ("how do I use my db-migrate tool?")
  - Comparing tools ("what's the difference between deploy and deploy-v2?")

Examples:
  puter magic "which of my scripts handles database migrations?"
  puter magic "show me how to use the deploy tool with a dry-run flag"
  puter magic "summarize all my registered CLIs in a table"`;

const MAX_BUNDLE_CHARS = 80_000;

async function buildScriptBundle(
  name: string,
  path: string,
  description?: string
): Promise<string> {
  const header = description
    ? `[${name}] ${path}\n  ${description}`
    : `[${name}] ${path}`;

  try {
    const info = await stat(path);

    if (info.isFile()) {
      const content = await readFile(path, "utf-8");
      return `${header}\n\n── ${basename(path)} ──\n${content}`;
    }

    const files = await collectFiles(path);
    if (files.length === 0) return header;

    const parts = [header, ""];
    for (const file of files) {
      const rel = relative(path, file);
      const content = await readFile(file, "utf-8");
      parts.push(`── ${rel} ──\n${content}`);
    }
    return parts.join("\n");
  } catch {
    return `${header}\n  (source not accessible)`;
  }
}

const PROMPT_TEMPLATE = `You are a helpful assistant. The user manages a collection of personal CLI scripts via a tool called "puter". Below is the full registry of their scripts, including source code.

Answer the user's question based on this context. Be concise and practical.

Wrap your answer in <puter-answer> tags. Only the content inside these tags will be shown to the user.

<scripts>
{SCRIPTS}
</scripts>

User's question: {QUESTION}

Respond inside <puter-answer>...</puter-answer> tags.`;

export async function magicCommand(
  args: readonly string[],
  registry: Registry
): Promise<void> {
  if (hasFlag(args, "--help") || args.length === 0) {
    console.log(MAGIC_HELP);
    return;
  }

  const question = args.join(" ");
  const scripts = await registry.listActive();
  const entries = Object.entries(scripts);

  if (entries.length === 0) {
    throw new Error(
      "No scripts registered. Register some with `puter register` first."
    );
  }

  const bundles: string[] = [];
  let totalChars = 0;

  for (const [name, entry] of entries) {
    const bundle = await buildScriptBundle(name, entry.path, entry.description);
    if (totalChars + bundle.length > MAX_BUNDLE_CHARS) {
      const header = entry.description
        ? `[${name}] ${entry.path}\n  ${entry.description}\n  (source omitted — bundle too large)`
        : `[${name}] ${entry.path}\n  (source omitted — bundle too large)`;
      bundles.push(header);
    } else {
      bundles.push(bundle);
      totalChars += bundle.length;
    }
  }

  const prompt = PROMPT_TEMPLATE.replace("{SCRIPTS}", bundles.join("\n\n---\n\n")).replace(
    "{QUESTION}",
    question
  );

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
    console.log(extractAnswer(response) ?? response);
  } catch (err) {
    spinner.stop();
    throw err;
  } finally {
    session.close();
  }
}
