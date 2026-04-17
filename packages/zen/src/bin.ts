#!/usr/bin/env bun
// zen CLI — hot-editable TypeScript source, interpreted by the bundled bun.
// Subcommand dispatcher. No positional subcommand = fall through to `open`
// (current behavior, backwards compatible).

import { runOpen } from "./commands/open"
import { runKyju } from "./commands/kyju"
import { runLink } from "./commands/link"
import { runDoctor } from "./commands/doctor"
import { runConfig } from "./commands/config"

const SUBCOMMANDS = new Set(["kyju", "link", "doctor", "config", "help", "--help", "-h"])

function printUsage() {
  console.log(`
zen — Zenbu CLI

Usage:
  zen [--agent <name>] [--resume] [--blocking]   Open a Zenbu window
  zen kyju <generate|db> [...]                   Run the kyju CLI
  zen link                                       Regenerate registry types
  zen doctor                                     Re-run setup.sh (idempotent)
  zen config <get|set> <key> [value]             Read/write CLI config
`)
}

async function main() {
  const argv = process.argv.slice(2)
  const first = argv[0]
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
