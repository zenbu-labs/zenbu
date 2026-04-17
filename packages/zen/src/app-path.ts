import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

const DEFAULT_APP_PATH = "/Applications/Zenbu.app/Contents/MacOS/Zenbu"

type KyjuRoot = {
  plugin?: {
    "zen-cli"?: {
      appPath?: string
    }
    kernel?: any
  }
}

function readZenCliSection(): KyjuRoot["plugin"] extends undefined
  ? null
  : { appPath?: string } | null {
  try {
    const rootJson = join(
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
    if (!existsSync(rootJson)) return null
    const root = JSON.parse(readFileSync(rootJson, "utf-8")) as KyjuRoot
    return root?.plugin?.["zen-cli"] ?? null
  } catch {
    return null
  }
}

/**
 * Resolves the Electron Zenbu binary path. Priority:
 *  1. --app-path <path> CLI flag (passed in explicitly)
 *  2. ZENBU_APP_PATH env var
 *  3. Kyju zen-cli section's appPath (set via `zen config set appPath`)
 *  4. Default: /Applications/Zenbu.app/Contents/MacOS/Zenbu
 *  5. Dev fallback: apps/kernel/dist/<arch>/Zenbu.app/Contents/MacOS/Zenbu
 *     relative to the zen source file (for running from a working tree).
 */
export function resolveAppPath(opts?: { explicit?: string }): string {
  if (opts?.explicit) return opts.explicit
  if (process.env.ZENBU_APP_PATH) return process.env.ZENBU_APP_PATH

  const section = readZenCliSection()
  if (section?.appPath && existsSync(section.appPath)) return section.appPath

  if (existsSync(DEFAULT_APP_PATH)) return DEFAULT_APP_PATH

  // Dev fallback: packages/zen/src/app-path.ts → repo root → apps/kernel/dist
  const arch = process.arch === "x64" ? "mac-x64" : "mac-arm64"
  const repoRoot = resolve(import.meta.dir, "..", "..", "..", "..")
  const devBin = resolve(
    repoRoot,
    `apps/kernel/dist/${arch}/Zenbu.app/Contents/MacOS/Zenbu`,
  )
  if (existsSync(devBin)) return devBin

  // Return default even if missing — callers log / error with a clear message
  return section?.appPath ?? DEFAULT_APP_PATH
}
