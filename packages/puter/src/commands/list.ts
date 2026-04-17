import type { Registry } from "../registry.ts";
import { hasFlag } from "../cli.ts";

export const LIST_HELP = `puter list - List registered scripts

Usage:
  puter list [--all]

Flags:
  --all    Include archived scripts

Shows all active scripts with their name, path, and description.`;

export async function listCommand(
  registry: Registry,
  args: readonly string[] = []
): Promise<void> {
  if (hasFlag(args, "--help")) {
    console.log(LIST_HELP);
    return;
  }

  const showAll = hasFlag(args, "--all");
  const scripts = showAll
    ? await registry.list()
    : await registry.listActive();
  const entries = Object.entries(scripts);

  if (entries.length === 0) {
    console.log("No scripts registered. Use `puter register` to add one.");
    return;
  }

  const maxName = Math.max(...entries.map(([n]) => n.length));

  for (const [name, entry] of entries) {
    const desc = entry.description ? `  ${entry.description}` : "";
    const status = entry.status === "archived" ? " \x1b[2m(archived)\x1b[0m" : "";
    console.log(
      `  \x1b[1m${name.padEnd(maxName)}\x1b[0m  ${entry.path}${status}${desc ? `\n  ${" ".repeat(maxName)}  \x1b[2m${entry.description}\x1b[0m` : ""}`
    );
  }
}
