import type { Registry } from "../registry.ts";
import { hasFlag } from "../cli.ts";

export const ARCHIVE_HELP = `puter archive - Archive a script

Usage:
  puter archive <name>

Removes the script from \`puter list\` without deleting the registry entry.
The script can be re-registered later with \`puter register\`.

Examples:
  puter archive old-deploy`;

export async function archiveCommand(
  args: readonly string[],
  registry: Registry
): Promise<void> {
  if (hasFlag(args, "--help")) {
    console.log(ARCHIVE_HELP);
    return;
  }

  const name = args[0];
  if (!name) {
    throw new Error("Usage: puter archive <name>");
  }

  await registry.archive(name);
  console.log(`Archived "${name}"`);
}
