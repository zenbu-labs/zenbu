import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { homedir } from "node:os"

const ROOT_JSON = join(
  homedir(),
  ".zenbu",
  "plugins",
  "zenbu",
  "packages",
  "init",
  ".zenbu",
  "db",
  "root.json",
)

/**
 * Read/write the "zen-cli" kyju section directly on the DB's root.json.
 * This is eventually consistent with the running DbService: if the app
 * is running, writes from here will be picked up on next evaluation,
 * but concurrent writes from the service could lose — prefer running
 * `zen config` when the app is quit for deterministic semantics.
 */
function readRoot(): any {
  if (!existsSync(ROOT_JSON)) {
    return { plugin: { "zen-cli": {} } }
  }
  return JSON.parse(readFileSync(ROOT_JSON, "utf-8"))
}

function writeRoot(root: any) {
  mkdirSync(dirname(ROOT_JSON), { recursive: true })
  writeFileSync(ROOT_JSON, JSON.stringify(root, null, 2))
}

function getSection(root: any): Record<string, unknown> {
  root.plugin ??= {}
  root.plugin["zen-cli"] ??= {}
  return root.plugin["zen-cli"]
}

function printUsage() {
  console.log(`
Usage: zen config <get|set> <key> [value]

Examples:
  zen config get appPath
  zen config set appPath /Applications/Zenbu.app/Contents/MacOS/Zenbu
`)
}

export async function runConfig(argv: string[]) {
  const [op, key, value, ...rest] = argv
  if (!op || (op !== "get" && op !== "set")) {
    printUsage()
    process.exit(op ? 1 : 0)
  }
  if (!key) {
    printUsage()
    process.exit(1)
  }
  const root = readRoot()
  const section = getSection(root)
  if (op === "get") {
    const v = section[key]
    if (v === undefined) process.exit(1)
    if (typeof v === "string") console.log(v)
    else console.log(JSON.stringify(v))
    return
  }
  // set
  if (value === undefined) {
    console.error("zen config set requires a value")
    process.exit(1)
  }
  const full = [value, ...rest].join(" ")
  section[key] = full
  writeRoot(root)
  console.log(`${key} = ${full}`)
}
