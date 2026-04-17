import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { app } from "electron"

export type ZenbuPaths = {
  cacheRoot: string
  binDir: string
  bunInstall: string
  bunPath: string
  pnpmHome: string
  pnpmPath: string
  xdgCacheHome: string
  xdgDataHome: string
  xdgStateHome: string
  resourcesPath: string
  appPath: string
  writtenAt: number
}

const INTERNAL_DIR = path.join(os.homedir(), ".zenbu", ".internal")
const PATHS_JSON = path.join(INTERNAL_DIR, "paths.json")

function computePaths(): ZenbuPaths {
  const cacheRoot = app.getPath("cache")
  const binDir = path.join(cacheRoot, "bin")
  return {
    cacheRoot,
    binDir,
    bunInstall: path.join(cacheRoot, "bun"),
    bunPath: path.join(binDir, "bun"),
    pnpmHome: path.join(cacheRoot, "pnpm"),
    pnpmPath: path.join(binDir, "pnpm"),
    xdgCacheHome: path.join(cacheRoot, "xdg", "cache"),
    xdgDataHome: path.join(cacheRoot, "xdg", "data"),
    xdgStateHome: path.join(cacheRoot, "xdg", "state"),
    resourcesPath: process.resourcesPath ?? "",
    appPath: app.getAppPath(),
    writtenAt: Date.now(),
  }
}

function probeUserToolPaths(): string[] {
  const home = os.homedir()
  const candidates = [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    path.join(home, ".bun", "bin"),
    path.join(home, "Library", "pnpm"),
    path.join(home, ".local", "share", "pnpm"),
    path.join(home, ".volta", "bin"),
    path.join(home, ".asdf", "shims"),
    path.join(home, ".local", "share", "mise", "shims"),
    path.join(home, ".cargo", "bin"),
  ]
  const found = candidates.filter((p) => {
    try {
      return fs.statSync(p).isDirectory()
    } catch {
      return false
    }
  })
  // nvm glob — pick newest
  try {
    const nvmDir = path.join(home, ".nvm", "versions", "node")
    if (fs.statSync(nvmDir).isDirectory()) {
      const versions = fs.readdirSync(nvmDir)
      for (const v of versions) {
        const bin = path.join(nvmDir, v, "bin")
        if (fs.statSync(bin).isDirectory()) found.push(bin)
      }
    }
  } catch {}
  return found
}

function mkdirpSafe(p: string): void {
  try {
    fs.mkdirSync(p, { recursive: true })
  } catch {}
}

function setEnvVars(paths: ZenbuPaths): void {
  // Isolate our bun/pnpm from user's installs via official env vars
  // (see https://pnpm.io/settings, https://bun.sh/docs/installation)
  if (!process.env.BUN_INSTALL || process.env.ZENBU_FORCE_OWN_TOOLCHAIN === "1") {
    process.env.BUN_INSTALL = paths.bunInstall
  }
  if (!process.env.PNPM_HOME || process.env.ZENBU_FORCE_OWN_TOOLCHAIN === "1") {
    process.env.PNPM_HOME = paths.pnpmHome
  }
  if (!process.env.XDG_CACHE_HOME) process.env.XDG_CACHE_HOME = paths.xdgCacheHome
  if (!process.env.XDG_DATA_HOME) process.env.XDG_DATA_HOME = paths.xdgDataHome
  if (!process.env.XDG_STATE_HOME) process.env.XDG_STATE_HOME = paths.xdgStateHome

  // PATH: our binDir first (so spawn("bun", ...) resolves to ours by default),
  // then user-tool locations (for agent CLIs, git overrides, etc.), then existing PATH.
  const userDirs = probeUserToolPaths()
  const parts = [paths.binDir, ...userDirs, process.env.PATH ?? ""]
    .filter(Boolean)
    .join(path.delimiter)
  process.env.PATH = parts
}

function writePathsJson(paths: ZenbuPaths): void {
  try {
    mkdirpSafe(INTERNAL_DIR)
    fs.writeFileSync(PATHS_JSON, JSON.stringify(paths, null, 2))
  } catch (err) {
    console.error("[env-bootstrap] failed to write paths.json", err)
  }
}

export type BootstrapResult = {
  paths: ZenbuPaths
  needsToolchainDownload: boolean
}

/**
 * Must run as the very first thing inside `app.whenReady()` — before any
 * `child_process.spawn`, before `needsBootstrapper()`, before loaders are
 * registered. Mutates `process.env` in place so every subsequent spawn
 * inherits the isolated toolchain env + augmented PATH.
 *
 * macOS-first; uses Electron's `app.getPath("cache")` which returns
 * `~/Library/Caches/Zenbu/` on macOS, `~/.cache/Zenbu/` on Linux,
 * `%LOCALAPPDATA%\Zenbu\Cache` on Windows. So the shape generalizes
 * across platforms without code changes.
 */
export function bootstrapEnv(): BootstrapResult {
  const paths = computePaths()

  // Ensure all cache subtrees exist so spawned subprocesses can write.
  mkdirpSafe(paths.binDir)
  mkdirpSafe(paths.bunInstall)
  mkdirpSafe(paths.pnpmHome)
  mkdirpSafe(paths.xdgCacheHome)
  mkdirpSafe(paths.xdgDataHome)
  mkdirpSafe(paths.xdgStateHome)

  setEnvVars(paths)
  writePathsJson(paths)

  const needsToolchainDownload =
    !fs.existsSync(paths.bunPath) || !fs.existsSync(paths.pnpmPath)

  return { paths, needsToolchainDownload }
}
