#!/usr/bin/env bun
// zen CLI — hot-editable TypeScript source, interpreted by the bundled bun.
// Subcommand dispatcher. No positional subcommand = fall through to `open`
// (current behavior, backwards compatible).

import { runOpen } from "./commands/open"
import { runKyju } from "./commands/kyju"
import { runLink } from "./commands/link"
import { runDoctor } from "./commands/doctor"
import { runConfig } from "./commands/config"
import { runSetup } from "./commands/setup"
import { runInit } from "./commands/init"
import { runExec } from "./commands/exec"
import { runProfile } from "./commands/profile"

const SUBCOMMANDS = new Set([
  "kyju",
  "link",
  "doctor",
  "config",
  "setup",
  "init",
  "exec",
  "profile",
  "help",
  "--help",
  "-h",
])

function printUsage() {
  console.log(`
zen — Zenbu CLI

Usage:
  zen [--agent <name>] [--resume] [--blocking]   Open a Zenbu window
  zen kyju <generate|db> [...]                   Run the kyju CLI
  zen link                                       Regenerate registry types
  zen doctor                                     Re-run kernel setup.ts
  zen setup [--dir <path>]                       Run a plugin's setup.ts
  zen config <get|set> <key> [value]             Read/write CLI config
  zen init <plugin-name> [--dir <path>]          Scaffold a new plugin
  zen exec -e '<ts>' | zen exec <file.ts>        Run TS with rpc/events pre-opened
  zen profile [--duration <ms>] [--out <path>]   CPU profile the kernel main process
  zen profile heap [--out <path>]                Heap snapshot of the kernel main process
`)
}

async function main() {
  const argv = process.argv.slice(2)
  const first = argv[0]
  // A bare positional that isn't a subcommand is almost always a typo —
  // error instead of silently treating it as an agent name.
  if (first && !first.startsWith("-") && !SUBCOMMANDS.has(first)) {
    console.error(`zen: unknown subcommand "${first}"`)
    printUsage()
    process.exit(1)
  }
  if (!first || !SUBCOMMANDS.has(first)) {
    await runOpen(argv)
    return
  }
  const rest = argv.slice(1)
  switch (first) {
    case "kyju":
      await runKyju(rest)
      return
    case "link":
      await runLink(rest)
      return
    case "doctor":
      await runDoctor(rest)
      return
    case "config":
      await runConfig(rest)
      return
    case "setup":
      await runSetup(rest)
      return
    case "init":
      await runInit(rest)
      return
    case "exec":
      await runExec(rest)
      return
    case "profile":
      await runProfile(rest)
      return
    case "help":
    case "--help":
    case "-h":
      printUsage()
      return
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
