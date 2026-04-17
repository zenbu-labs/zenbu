import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, basename } from "node:path";
import type { Registry } from "../registry.ts";
import { hasFlag } from "../cli.ts";

export const CAT_HELP = `puter cat - Show script source

Usage:
  puter cat <name>

Displays the full source tree of a registered script. For single files,
prints the file content. For directories, walks the tree and prints every
source file with a header.

Ignores: node_modules, .git, dist, binary files.

Examples:
  puter cat my-tool`;

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  ".turbo",
  "__pycache__",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".zip",
  ".tar",
  ".gz",
  ".lock",
]);

async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;

      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const ext = entry.name.slice(entry.name.lastIndexOf("."));
        if (!BINARY_EXTENSIONS.has(ext)) {
          files.push(full);
        }
      }
    }
  }

  await walk(dir);
  return files.sort();
}

export async function catCommand(
  args: readonly string[],
  registry: Registry
): Promise<void> {
  if (hasFlag(args, "--help")) {
    console.log(CAT_HELP);
    return;
  }

  const name = args[0];
  if (!name) {
    throw new Error("Usage: puter cat <name>");
  }

  const entry = await registry.get(name);
  const scriptPath = entry.path;
  const info = await stat(scriptPath);

  if (info.isFile()) {
    const content = await readFile(scriptPath, "utf-8");
    console.log(`── ${basename(scriptPath)} ──`);
    console.log(content);
    return;
  }

  const files = await collectFiles(scriptPath);
  if (files.length === 0) {
    console.log("No source files found.");
    return;
  }

  console.log(`\n📁 ${scriptPath}\n`);

  for (const file of files) {
    const rel = relative(scriptPath, file);
    const content = await readFile(file, "utf-8");
    console.log(`── ${rel} ──`);
    console.log(content);
    console.log();
  }
}

export { collectFiles };
