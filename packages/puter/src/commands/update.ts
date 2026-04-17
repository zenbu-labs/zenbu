import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import type { Registry } from "../registry.ts";
import { parseFlag, hasFlag } from "../cli.ts";

export const UPDATE_HELP = `puter update - Update a script's path

Usage:
  puter update --name <name> <path>

Arguments:
  <path>              New path to script file or directory

Flags:
  --name <name>       Name of the script to update (required)

Examples:
  puter update --name deploy ./new-deploy.ts`;

export async function updateCommand(
  args: readonly string[],
  registry: Registry
): Promise<void> {
  if (hasFlag(args, "--help")) {
    console.log(UPDATE_HELP);
    return;
  }

  const name = parseFlag(args, "--name");
  const rawPath = args.find((a) => !a.startsWith("-") && a !== name);

  if (!name) {
    throw new Error("Missing required flag: --name");
  }
  if (!rawPath) {
    throw new Error("Usage: puter update --name <name> <path>");
  }

  const absPath = resolve(rawPath);

  const info = await stat(absPath).catch(() => null);
  if (!info) {
    throw new Error(`Path does not exist: ${absPath}`);
  }

  const entry = await registry.update(name, absPath);
  console.log(`Updated "${name}" → ${entry.path}`);
}
