import { execFileSync } from "node:child_process"
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
  // app.getPath("cache") returns the user cache root (e.g. ~/Library/Caches
  // on macOS), NOT app-namespaced. Append "Zenbu" ourselves so we get
  // ~/Library/Caches/Zenbu which matches what setup.ts writes to.
  const cacheRoot = path.join(app.getPath("cache"), "Zenbu")
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

// GUI-launched Electron inherits launchd's minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin),
// so any tool the user installed via a custom dotfile (e.g. ~/.hades/bin, rbenv shims,
// brew on non-default prefix) is invisible. Run the user's login shell and grab its
// PATH — same trick as the `fix-path` npm package. Timed out short so a broken rc
// doesn't block app launch.
function probeLoginShellPath(): string[] {
  try {
    const shell = process.env.SHELL || "/bin/zsh"
    const out = execFileSync(shell, ["-ilc", "echo -n __ZENBU_PATH__$PATH"], {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    })
    const marker = "__ZENBU_PATH__"
    const idx = out.lastIndexOf(marker)
    if (idx < 0) return []
    return out
      .slice(idx + marker.length)
      .trim()
      .split(path.delimiter)
      .filter(Boolean)
  } catch {
    return []
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

function setEnvVars(paths: ZenbuPaths, toolchainReady: boolean): void {
  // Only apply isolation env vars when our toolchain has actually been
  // downloaded. Pointing BUN_INSTALL / PNPM_HOME / XDG_* at empty dirs
  // forces pnpm/bun to rebuild their store from scratch on every spawn —
  // catastrophic slowdown for existing users who have a populated store
  // elsewhere. (see https://pnpm.io/settings, https://bun.sh/docs/installation)
  if (toolchainReady) {
    if (!process.env.BUN_INSTALL || process.env.ZENBU_FORCE_OWN_TOOLCHAIN === "1") {
      process.env.BUN_INSTALL = paths.bunInstall
    }
    if (!process.env.PNPM_HOME || process.env.ZENBU_FORCE_OWN_TOOLCHAIN === "1") {
      process.env.PNPM_HOME = paths.pnpmHome
    }
    if (!process.env.XDG_CACHE_HOME) process.env.XDG_CACHE_HOME = paths.xdgCacheHome
    if (!process.env.XDG_DATA_HOME) process.env.XDG_DATA_HOME = paths.xdgDataHome
    if (!process.env.XDG_STATE_HOME) process.env.XDG_STATE_HOME = paths.xdgStateHome
  }

  // PATH: always prepend known user-tool locations (brew/bun/pnpm/nvm/volta/
  // asdf/mise/cargo) so GUI-launched Electron can find tools the user has
  // installed. When toolchainReady, also prepend our binDir so our own
  // bun/pnpm win by default (still overridable via ZENBU_BUN etc.). Also
  // merge in the user's login-shell PATH to pick up custom install dirs
  // (~/.hades/bin, rbenv shims, non-default brew prefix, etc.).
  const userDirs = probeUserToolPaths()
  const shellDirs = probeLoginShellPath()
  const pathParts = toolchainReady
    ? [paths.binDir, ...userDirs, ...shellDirs, process.env.PATH ?? ""]
    : [...userDirs, ...shellDirs, process.env.PATH ?? ""]
  // Deduplicate while preserving order (earlier entries win).
  const seen = new Set<string>()
  process.env.PATH = pathParts
    .flatMap((p) => p.split(path.delimiter))
    .filter((p) => {
      if (!p || seen.has(p)) return false
      seen.add(p)
      return true
    })
    .join(path.delimiter)
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

  // Only create the bin dir eagerly — the rest is populated lazily by setup.ts
  // when the user runs zen doctor / first-install. We don't want empty
  // BUN_INSTALL / PNPM_HOME dirs around on every launch.
  mkdirpSafe(paths.binDir)

  const toolchainReady =
    fs.existsSync(paths.bunPath) && fs.existsSync(paths.pnpmPath)

  setEnvVars(paths, toolchainReady)
  writePathsJson(paths)

  return { paths, needsToolchainDownload: !toolchainReady }
}
