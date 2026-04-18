#!/usr/bin/env bun
/**
 * Zenbu install/reinstall script.
 *
 * Run via the cached bun binary: `bun /path/to/setup.ts`
 *
 * - Idempotent: every ensure_* function reads state first and no-ops if satisfied.
 * - Emits machine-readable ##ZENBU_STEP: lines for the Electron setup window.
 *   Harmless prints when run in a terminal.
 * - Canonical entry point: first-install (from setup window) and `zen doctor`.
 * - macOS-only today; shape generalizes for Linux/Windows later.
 *
 * Tools (bun, pnpm) are downloaded into the Zenbu-isolated cache tree
 * (~/Library/Caches/Zenbu/) so they never collide with the user's toolchain.
 */

import { $ } from "bun"
import fs from "node:fs"
import fsp from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

// ---------- paths + env ----------

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
// setup.ts lives at `packages/init/setup.ts`; repo root is two levels up.
const REPO_DIR = path.resolve(SCRIPT_DIR, "..", "..")
const REPO_URL = "https://github.com/zenbu-labs/zenbu.git"

const HOME_DIR = os.homedir()
const CACHE_ROOT = path.join(HOME_DIR, "Library/Caches/Zenbu")
const BIN_DIR = path.join(CACHE_ROOT, "bin")
const BUN_INSTALL = path.join(CACHE_ROOT, "bun")
const PNPM_HOME = path.join(CACHE_ROOT, "pnpm")
const XDG_CACHE_HOME = path.join(CACHE_ROOT, "xdg/cache")
const XDG_DATA_HOME = path.join(CACHE_ROOT, "xdg/data")
const XDG_STATE_HOME = path.join(CACHE_ROOT, "xdg/state")

const INTERNAL_DIR = path.join(HOME_DIR, ".zenbu/.internal")
const REGISTRY_DIR = path.join(HOME_DIR, ".zenbu/registry")
const CLI_BIN_DIR = path.join(HOME_DIR, ".zenbu/bin")

const PATH_SENTINEL = "# added by zenbu"
const ZEN_SHIM = path.join(CLI_BIN_DIR, "zen")

const VERSIONS_JSON = path.join(REPO_DIR, "setup/versions.json")

// Export so pnpm / bun subprocesses pick these up.
process.env.BUN_INSTALL = BUN_INSTALL
process.env.PNPM_HOME = PNPM_HOME
process.env.XDG_CACHE_HOME = XDG_CACHE_HOME
process.env.XDG_DATA_HOME = XDG_DATA_HOME
process.env.XDG_STATE_HOME = XDG_STATE_HOME
process.env.PATH = `${BIN_DIR}:${process.env.PATH ?? ""}`

// ---------- UI protocol helpers ----------

const stepStart = (id: string, label: string) =>
  console.log(`##ZENBU_STEP:start:${id}:${label}`)
const stepDone = (id: string) => console.log(`##ZENBU_STEP:done:${id}`)
const stepError = (id: string, msg: string) =>
  console.log(`##ZENBU_STEP:error:${id}:${msg}`)
const stepOffer = (tool: string, cmd: string) =>
  console.log(`##ZENBU_STEP:offer-install:${tool}:${cmd}`)

const logOk = (s: string) => console.log(`  ✓ ${s}`)
const logDo = (s: string) => console.log(`  → ${s}`)

// ---------- versions.json readers ----------

type Versions = {
  bun: {
    version: string
    releaseTag: string
    urlTemplate: string
    targets: Record<string, { asset: string; sha256: string }>
  }
  pnpm: {
    version: string
    releaseTag: string
    urlTemplate: string
    targets: Record<string, { asset: string; sha256: string }>
  }
}

function readVersions(): Versions {
  return JSON.parse(fs.readFileSync(VERSIONS_JSON, "utf8")) as Versions
}

function detectBunTarget(): "darwin-aarch64" | "darwin-x64" {
  const arch = os.arch()
  if (arch === "arm64") return "darwin-aarch64"
  if (arch === "x64") return "darwin-x64"
  throw new Error(`unsupported architecture: ${arch}`)
}

function detectPnpmTarget(): "darwin-arm64" | "darwin-x64" {
  const arch = os.arch()
  if (arch === "arm64") return "darwin-arm64"
  if (arch === "x64") return "darwin-x64"
  throw new Error(`unsupported architecture: ${arch}`)
}

// ---------- hash / sig helpers ----------

async function sha256File(filePath: string): Promise<string> {
  const data = await fsp.readFile(filePath)
  return crypto.createHash("sha256").update(data).digest("hex")
}

async function verifySha256(
  filePath: string,
  expected: string,
): Promise<void> {
  const actual = await sha256File(filePath)
  if (actual !== expected) {
    throw new Error(`sha256 mismatch: expected ${expected}, got ${actual}`)
  }
}

/**
 * Hash a list of files together into a single signature. Missing files
 * contribute their absolute path but no content, so absence is a stable
 * input (consistent across runs).
 */
async function fileSig(...files: string[]): Promise<string> {
  const hash = crypto.createHash("sha256")
  for (const f of files) {
    try {
      const stat = await fsp.stat(f)
      if (stat.isFile()) {
        const data = await fsp.readFile(f)
        hash.update(data)
      }
    } catch {
      // missing; skip contents
    }
    hash.update("\0")
    hash.update(f)
    hash.update("\0")
  }
  return hash.digest("hex")
}

function readSig(sigPath: string): string {
  try {
    return fs.readFileSync(sigPath, "utf8")
  } catch {
    return ""
  }
}

function writeSig(sigPath: string, value: string): void {
  fs.mkdirSync(path.dirname(sigPath), { recursive: true })
  fs.writeFileSync(sigPath, value)
}

// ---------- ensure_* steps ----------

async function ensureDirs(): Promise<void> {
  const dirs = [
    BIN_DIR,
    BUN_INSTALL,
    PNPM_HOME,
    XDG_CACHE_HOME,
    XDG_DATA_HOME,
    XDG_STATE_HOME,
    INTERNAL_DIR,
    REGISTRY_DIR,
    CLI_BIN_DIR,
  ]
  for (const d of dirs) {
    await fsp.mkdir(d, { recursive: true })
  }
}

async function ensureGit(): Promise<void> {
  try {
    const res = await $`git --version`.quiet().nothrow()
    if (res.exitCode !== 0) {
      stepOffer("xcode-cli", "xcode-select --install")
      throw new Error("git stub — install Xcode Command Line Tools")
    }
    logOk(`git: ${(await $`command -v git`.text()).trim()}`)
  } catch {
    stepOffer("xcode-cli", "xcode-select --install")
    throw new Error("git not found — install Xcode Command Line Tools")
  }
}

async function ensureBun(): Promise<void> {
  const target = detectBunTarget()
  const versions = readVersions()
  const { version } = versions.bun
  const { asset, sha256: expectedSha } = versions.bun.targets[target]

  const marker = path.join(BIN_DIR, ".bun.version")
  const current = readSig(marker)
  const bunBin = path.join(BIN_DIR, "bun")
  if (fs.existsSync(bunBin) && current === version) {
    // Always re-ensure the node->bun symlink exists (may have been removed).
    try {
      fs.unlinkSync(path.join(BIN_DIR, "node"))
    } catch {}
    fs.symlinkSync("bun", path.join(BIN_DIR, "node"))
    logOk(`bun ${version} already installed`)
    return
  }

  const tag = `bun-v${version}`
  const url = `https://github.com/oven-sh/bun/releases/download/${tag}/${asset}`
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), "bun-download-"))
  const zipPath = path.join(tmpdir, asset)

  logDo(`downloading bun ${version}`)
  await $`curl -fL --progress-bar -o ${zipPath} ${url}`
  await verifySha256(zipPath, expectedSha)
  await $`unzip -q ${asset}`.cwd(tmpdir)

  // bun releases extract to a dir like bun-darwin-aarch64/bun
  const extracted = await findBunBinary(tmpdir)
  if (!extracted) {
    throw new Error(`could not locate bun binary in ${asset}`)
  }
  await fsp.copyFile(extracted, bunBin)
  await fsp.chmod(bunBin, 0o755)
  writeSig(marker, version)
  await fsp.rm(tmpdir, { recursive: true, force: true })

  // Symlink node -> bun so pnpm lifecycle scripts with `#!/usr/bin/env node`
  // shebangs (e.g. the tsc shim that fails dynohot's prepare hook) resolve
  // to our bun via PATH. Bun runs in node-compat mode when invoked as `node`.
  try {
    fs.unlinkSync(path.join(BIN_DIR, "node"))
  } catch {}
  fs.symlinkSync("bun", path.join(BIN_DIR, "node"))
  logOk(`bun ${version} installed (node->bun symlinked)`)
}

async function findBunBinary(dir: string): Promise<string | null> {
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = await findBunBinary(full)
      if (nested) return nested
    } else if (entry.isFile() && entry.name === "bun") {
      try {
        const stat = await fsp.stat(full)
        if (stat.mode & 0o111) return full
      } catch {}
      return full
    }
  }
  return null
}

async function ensurePnpm(): Promise<void> {
  const target = detectPnpmTarget()
  const versions = readVersions()
  const { version } = versions.pnpm
  const { asset, sha256: expectedSha } = versions.pnpm.targets[target]

  const marker = path.join(BIN_DIR, ".pnpm.version")
  const current = readSig(marker)
  const pnpmBin = path.join(BIN_DIR, "pnpm")
  if (fs.existsSync(pnpmBin) && current === version) {
    logOk(`pnpm ${version} already installed`)
    return
  }

  const tag = `v${version}`
  const url = `https://github.com/pnpm/pnpm/releases/download/${tag}/${asset}`
  const tmp = path.join(BIN_DIR, ".pnpm.download")

  logDo(`downloading pnpm ${version}`)
  await $`curl -fL --progress-bar -o ${tmp} ${url}`
  await verifySha256(tmp, expectedSha)
  await fsp.chmod(tmp, 0o755)
  await fsp.rename(tmp, pnpmBin)
  writeSig(marker, version)
  logOk(`pnpm ${version} installed`)
}

async function ensureRemote(): Promise<void> {
  const gitDir = path.join(REPO_DIR, ".git")
  if (fs.existsSync(gitDir)) return
  await $`git init -q`.cwd(REPO_DIR)
  await $`git remote add origin ${REPO_URL}`.cwd(REPO_DIR)
  await $`git fetch --depth 1 origin main -q`.cwd(REPO_DIR)
  await $`git reset origin/main -q`.cwd(REPO_DIR)
  logOk("linked to remote")
}

async function ensureDepsInstalled(): Promise<void> {
  const marker = path.join(BIN_DIR, ".deps.sig")
  const sig = await fileSig(
    path.join(REPO_DIR, "pnpm-lock.yaml"),
    path.join(REPO_DIR, "pnpm-workspace.yaml"),
    path.join(BIN_DIR, ".pnpm.version"),
  )
  const nodeModules = path.join(REPO_DIR, "node_modules")
  if (fs.existsSync(nodeModules) && readSig(marker) === sig) {
    logOk("deps up-to-date")
    return
  }
  logDo("installing pnpm deps")
  // CI=true makes pnpm non-interactive; otherwise it prompts on node_modules
  // divergence and aborts when there's no TTY.
  const pnpmBin = path.join(BIN_DIR, "pnpm")
  const proc = Bun.spawn([pnpmBin, "install", "--filter=!@zenbu/kernel"], {
    cwd: REPO_DIR,
    env: { ...process.env, CI: "true" },
    stdio: ["ignore", "inherit", "inherit"],
  })
  const exit = await proc.exited
  if (exit !== 0) {
    throw new Error(`pnpm install exited with code ${exit}`)
  }
  writeSig(marker, sig)
}

async function ensureTsconfigLocal(): Promise<void> {
  const packagesDir = path.join(REPO_DIR, "packages")
  const tsconfig = path.join(REPO_DIR, "packages/init/tsconfig.local.json")
  const expected =
    JSON.stringify(
      {
        compilerOptions: {
          paths: {
            "@/*": ["./src/renderer/*"],
            "@testbu/*": [`${packagesDir}/*`],
            "#registry/*": [`${REGISTRY_DIR}/*`],
          },
          // setup.ts uses Bun-specific APIs (`Bun.*`, `$`) alongside the
          // normal Node types the rest of the package relies on. Both type
          // packages must be explicitly listed so the LSP resolves them.
          types: ["node", "bun"],
        },
        include: ["src", "shared", "test", "setup.ts", REGISTRY_DIR],
      },
      null,
      2,
    ) + "\n"
  try {
    const current = await fsp.readFile(tsconfig, "utf8")
    if (current === expected) return
  } catch {}
  await fsp.writeFile(tsconfig, expected)
}

async function ensureKernelManifestRegistered(): Promise<void> {
  const configJson = path.join(HOME_DIR, ".zenbu/config.json")
  const kernelManifest = path.join(
    REPO_DIR,
    "packages/init/zenbu.plugin.json",
  )
  const zenManifest = path.join(REPO_DIR, "packages/zen/zenbu.plugin.json")
  await fsp.mkdir(path.dirname(configJson), { recursive: true })
  let cfg: { plugins?: string[] } = { plugins: [] }
  try {
    cfg = JSON.parse(await fsp.readFile(configJson, "utf8"))
  } catch {
    // file missing or malformed; start fresh
  }
  const plugins = Array.isArray(cfg.plugins) ? cfg.plugins : []
  let changed = false
  for (const m of [kernelManifest, zenManifest]) {
    if (!fs.existsSync(m)) continue
    if (!plugins.includes(m)) {
      plugins.push(m)
      changed = true
    }
  }
  if (changed) {
    cfg.plugins = plugins
    await fsp.writeFile(configJson, JSON.stringify(cfg, null, 2) + "\n")
    logDo("registered plugin manifests")
  } else {
    logOk("plugin manifests already registered")
  }
}

async function ensureZenShim(): Promise<void> {
  const expected = `#!/usr/bin/env bash
# zen CLI shim — interprets packages/zen/src/bin.ts via isolated bun.
# Refreshed on every setup run.
set -e

CACHE="$HOME/Library/Caches/Zenbu"

# Resolve bun: env override → paths.json → standard cache → system bun.
# Each candidate is taken only if it points at an executable file, so a
# stale paths.json can't poison the lookup.
BUN=""
try_bun() {
  if [ -n "$1" ] && [ -x "$1" ] && [ -z "$BUN" ]; then
    BUN="$1"
  fi
}

try_bun "\${ZENBU_BUN:-}"
PATHS="$HOME/.zenbu/.internal/paths.json"
if [ -z "$BUN" ] && [ -f "$PATHS" ]; then
  try_bun "$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['bunPath'])" "$PATHS" 2>/dev/null || true)"
fi
try_bun "$CACHE/bin/bun"
try_bun "$(command -v bun 2>/dev/null || true)"

if [ -z "$BUN" ]; then
  echo "zen: bun not found. Launch Zenbu.app once to bootstrap, or run:" >&2
  echo "     bun \\"$HOME/.zenbu/plugins/zenbu/packages/init/setup.ts\\"" >&2
  exit 127
fi

if [ -x "$CACHE/bin/pnpm" ]; then
  export BUN_INSTALL="$CACHE/bun"
  export PNPM_HOME="$CACHE/pnpm"
  export XDG_CACHE_HOME="$CACHE/xdg/cache"
  export XDG_DATA_HOME="$CACHE/xdg/data"
  export XDG_STATE_HOME="$CACHE/xdg/state"
  export PATH="$CACHE/bin:$PATH"
fi
exec "$BUN" "$HOME/.zenbu/plugins/zenbu/packages/zen/src/bin.ts" "$@"
`
  try {
    const current = await fsp.readFile(ZEN_SHIM, "utf8")
    if (current === expected) return
  } catch {}
  await fsp.writeFile(ZEN_SHIM, expected)
  await fsp.chmod(ZEN_SHIM, 0o755)
}

async function ensurePathWired(): Promise<void> {
  const shellName = path.basename(process.env.SHELL ?? "/bin/zsh")
  let rc: string
  switch (shellName) {
    case "zsh":
      rc = path.join(process.env.ZDOTDIR ?? HOME_DIR, ".zshrc")
      break
    case "bash":
      rc = path.join(HOME_DIR, ".bash_profile")
      if (!fs.existsSync(rc)) rc = path.join(HOME_DIR, ".bashrc")
      break
    case "fish":
      rc = path.join(HOME_DIR, ".config/fish/config.fish")
      break
    default:
      rc = path.join(HOME_DIR, ".profile")
  }

  await fsp.mkdir(path.dirname(rc), { recursive: true })
  if (fs.existsSync(rc)) {
    const content = await fsp.readFile(rc, "utf8")
    if (content.includes(PATH_SENTINEL)) return
  }
  const line =
    shellName === "fish"
      ? `\n${PATH_SENTINEL}\nset -x PATH $HOME/.zenbu/bin $PATH\n`
      : `\n${PATH_SENTINEL}\nexport PATH="$HOME/.zenbu/bin:$PATH"\n`
  await fsp.appendFile(rc, line)
  logOk(`PATH wired in ${rc}`)
}

async function ensureRegistryTypes(): Promise<void> {
  const marker = path.join(REGISTRY_DIR, ".types.sig")
  const configJson = path.join(HOME_DIR, ".zenbu/config.json")
  const sig = await fileSig(
    configJson,
    path.join(REPO_DIR, "packages/init/zenbu.plugin.json"),
    path.join(REPO_DIR, "packages/zen/zenbu.plugin.json"),
    path.join(REPO_DIR, "packages/init/shared/schema/index.ts"),
    path.join(REPO_DIR, "packages/zen/shared/schema.ts"),
  )
  const dbSections = path.join(REGISTRY_DIR, "db-sections.ts")
  if (fs.existsSync(dbSections) && readSig(marker) === sig) {
    logOk("registry types up-to-date")
    return
  }
  logDo("regenerating registry types")
  const bunBin = path.join(BIN_DIR, "bun")
  const zenCli = path.join(REPO_DIR, "packages/zen/src/bin.ts")

  for (const manifest of [
    path.join(REPO_DIR, "packages/init/zenbu.plugin.json"),
    path.join(REPO_DIR, "packages/zen/zenbu.plugin.json"),
  ]) {
    const proc = Bun.spawn([bunBin, zenCli, "link", manifest], {
      stdio: ["ignore", "inherit", "inherit"],
    })
    const exit = await proc.exited
    if (exit !== 0) {
      throw new Error(`zen link exited with code ${exit} for ${manifest}`)
    }
  }
  writeSig(marker, sig)
}

async function ensureDbConfig(): Promise<void> {
  const dbPath = path.join(REPO_DIR, "packages/init/.zenbu/db")
  const dbJson = path.join(INTERNAL_DIR, "db.json")
  let prev: { dbPath?: string } = {}
  try {
    prev = JSON.parse(await fsp.readFile(dbJson, "utf8"))
  } catch {}
  if (prev.dbPath === dbPath) {
    logOk("db.json already current")
    return
  }
  await fsp.writeFile(dbJson, JSON.stringify({ dbPath }, null, 2))
  logDo(`wrote ${dbJson}`)
}

async function ensureAppPath(): Promise<void> {
  const defaultPath = "/Applications/Zenbu.app/Contents/MacOS/Zenbu"
  try {
    await fsp.access(defaultPath, fs.constants.X_OK)
  } catch {
    return
  }
  // `zen config` writes into packages/init/.zenbu/db/root.json under
  // plugin["zen-cli"].appPath. Read it directly to avoid spawning bun+zen
  // every setup run.
  const rootJson = path.join(REPO_DIR, "packages/init/.zenbu/db/root.json")
  let current = ""
  try {
    const root = JSON.parse(await fsp.readFile(rootJson, "utf8"))
    current = root?.plugin?.["zen-cli"]?.appPath ?? ""
  } catch {}
  if (current === defaultPath) return
  const bunBin = path.join(BIN_DIR, "bun")
  const zenCli = path.join(REPO_DIR, "packages/zen/src/bin.ts")
  const proc = Bun.spawn(
    [bunBin, zenCli, "config", "set", "appPath", defaultPath],
    { stdio: ["ignore", "ignore", "ignore"] },
  )
  await proc.exited
}

// ---------- grouped step runner ----------

async function runStep(
  id: string,
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  stepStart(id, label)
  try {
    await fn()
    stepDone(id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    stepError(id, msg)
    process.exit(1)
  }
}

async function groupPrepare(): Promise<void> {
  await ensureDirs()
  await ensureGit()
}
async function groupToolchain(): Promise<void> {
  await ensureBun()
  await ensurePnpm()
}
async function groupInstall(): Promise<void> {
  await ensureRemote()
  await ensureDepsInstalled()
}
async function groupWire(): Promise<void> {
  await ensureTsconfigLocal()
  await ensureKernelManifestRegistered()
  await ensureZenShim()
  await ensurePathWired()
  await ensureDbConfig()
  await ensureAppPath()
}
async function groupTypes(): Promise<void> {
  await ensureRegistryTypes()
}

// ---------- main ----------

async function main(): Promise<void> {
  process.chdir(REPO_DIR)
  await runStep("prepare", "Checking git", groupPrepare)
  await runStep("toolchain", "Installing bun + pnpm", groupToolchain)
  await runStep("install", "Installing packages", groupInstall)
  await runStep("types", "Generating registry", groupTypes)
  await runStep("wire", "Wiring environment", groupWire)
  console.log("\n##ZENBU_STEP:all-done")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
