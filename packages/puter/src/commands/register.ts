import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import type { Registry } from "../registry.ts";
import { parseFlag, hasFlag } from "../cli.ts";

export const REGISTER_HELP = `puter register - Register a script

Usage:
  puter register <path> --name <name> [--description <text>]

Arguments:
  <path>                  Path to script file or directory

Flags:
  --name <name>           Name to register the script under (required)
  --description <text>    Short description of what the script does

Examples:
  puter register ./build.ts --name build
  puter register ./tools/deploy --name deploy --description "Deploy to prod"`;

export async function registerCommand(
  args: readonly string[],
  registry: Registry
): Promise<void> {
  if (hasFlag(args, "--help")) {
    console.log(REGISTER_HELP);
    return;
  }

  const name = parseFlag(args, "--name");
  const description = parseFlag(args, "--description");
  const rawPath = args.find(
    (a) => !a.startsWith("-") && a !== name && a !== description
  );

  if (!rawPath) {
    throw new Error("Usage: puter register <path> --name <name>");
  }
  if (!name) {
    throw new Error("Missing required flag: --name");
  }

  const absPath = resolve(rawPath);

  const info = await stat(absPath).catch(() => null);
  if (!info) {
    throw new Error(`Path does not exist: ${absPath}`);
  }

  const entry = await registry.register(name, absPath, description);
  console.log(`Registered "${name}" → ${entry.path}`);
}
