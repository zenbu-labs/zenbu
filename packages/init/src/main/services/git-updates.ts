import os from "node:os"
import path from "node:path"
import {
  GitCommandError,
  GitMissingError,
  checkMerge,
  checkout as gitCheckout,
  commit as gitCommit,
  createBranch as gitCreateBranch,
  deleteBranch as gitDeleteBranch,
  fetch as gitFetch,
  getAheadBehind,
  getBranch,
  getBranches,
  getCommit,
  getLog,
  getRemoteUrl,
  getStatus,
  getWorktrees,
  isRepo,
  isShallow,
  parseRemoteUrl,
  pull as gitPull,
  push as gitPush,
  resolveRef,
  runGit,
  type Branch,
  type Commit,
  type WorkingTreeStatus,
  type Worktree,
} from "@zenbu/git"
import fs from "node:fs"
import { spawn } from "node:child_process"
import { app } from "electron"
import { Service, runtime } from "../runtime"
import { RpcService } from "./rpc"
import {
  readManifestSetup,
  readManifestName,
  getStoredSetupVersion,
  recordSetupVersion,
} from "../../../shared/plugin-setup-state"

const CORE_REPO_ROOT = path.join(os.homedir(), ".zenbu", "plugins", "zenbu")
const BUN_BIN = path.join(
  os.homedir(),
  "Library",
  "Caches",
  "Zenbu",
  "bin",
  "bun",
)

/**
 * Prefer `~/.zenbu/config.jsonc` if present (supports comments + trailing
 * commas), fall back to `config.json`. Mirrors `installer.ts`'s lookup.
 */
function resolveConfigPath(): string {
  const jsonc = path.join(os.homedir(), ".zenbu", "config.jsonc")
  if (fs.existsSync(jsonc)) return jsonc
  return path.join(os.homedir(), ".zenbu", "config.json")
}

/**
 * Strip comments + trailing commas from a JSONC source, then JSON.parse.
 * Same implementation as `installer.ts`'s local copy.
 */
function parseJsonc(str: string): unknown {
  let result = ""
  let i = 0
  while (i < str.length) {
    if (str[i] === '"') {
      let j = i + 1
      while (j < str.length) {
        if (str[j] === "\\") {
          j += 2
        } else if (str[j] === '"') {
          j++
          break
        } else {
          j++
        }
      }
      result += str.slice(i, j)
      i = j
    } else if (str[i] === "/" && str[i + 1] === "/") {
      i += 2
      while (i < str.length && str[i] !== "\n") i++
    } else if (str[i] === "/" && str[i + 1] === "*") {
      i += 2
      while (i < str.length && !(str[i] === "*" && str[i + 1] === "/")) i++
      i += 2
    } else {
      result += str[i]
      i++
    }
  }
  return JSON.parse(result.replace(/,\s*([\]}])/g, "$1"))
}

export type UpdateStatus =
  | { kind: "not-a-repo" }
  | { kind: "no-remote" }
  | { kind: "detached-head" }
  | { kind: "git-missing" }
  | { kind: "fetch-error"; message: string }
  | {
      kind: "ok"
      branch: string
      ahead: number
      behind: number
      dirty: boolean
      mergeable: boolean | null
      conflictingFiles: string[]
      head: Commit
      upstream: Commit
      commits: Commit[]
      checkedAt: number
    }

const CACHE_TTL_MS = 5 * 60 * 1000

export type GitOverview =
  | { kind: "not-a-repo" }
  | { kind: "git-missing" }
  | { kind: "error"; message: string }
  | {
      kind: "ok"
      root: string
      branch: string | null
      remote: string | null
      remoteHost: string | null
      remoteOwner: string | null
      remoteRepo: string | null
      remoteWebUrl: string | null
      status: WorkingTreeStatus
      branches: Branch[]
      worktrees: Worktree[]
      log: Commit[]
    }

export type MutationResult =
  | { ok: true; sha?: string; message?: string; url?: string }
  | { ok: false; error: string }

export type FileDiff =
  | { kind: "ok"; oldText: string; newText: string; binary: boolean }
  | { kind: "error"; message: string }

const BINARY_PROBE_BYTES = 8000
const MAX_DIFF_BYTES = 2 * 1024 * 1024

export type PullAndInstallOpts = {
  /** Plugin name (as declared in the manifest). Defaults to "kernel". */
  plugin?: string
}

export type PullAndInstallResult =
  | {
      ok: true
      /** true if `git pull` moved HEAD forward */
      updated: boolean
      /** true if setup.ts was spawned (manifest version > stored version) */
      setupRan: boolean
      /** true if setup completed and the runtime is in a staged state:
       *  git pull + setup.ts have been applied on disk, but `setupVersion`
       *  has NOT been recorded yet and new code/deps have not been
       *  loaded into the running process. The UI MUST call either
       *  `commitPluginUpdate` (relaunch) or `rollbackPluginUpdate`
       *  (git reset --hard to `headBefore`) to resolve the pending state. */
      pending: boolean
      /** Pre-pull git HEAD — pass to `rollbackPluginUpdate` to revert. */
      headBefore: string | null
      /** Declared setup.version that should be recorded on commit. */
      version: number | null
      /** The plugin that was updated (echoed back so the UI knows). */
      plugin: string
    }
  | {
      ok: false
      error: string
      stage: "lookup" | "pull" | "setup" | "state"
      plugin: string
    }

/**
 * Resolve a plugin name to its manifest path by scanning the user's zenbu
 * config (JSONC-aware). The kernel is special-cased to its canonical path
 * since the kernel manifest lives at a fixed location regardless of config.
 */
function resolvePluginManifest(pluginName: string): string | null {
  if (pluginName === "kernel") {
    return path.join(
      CORE_REPO_ROOT,
      "packages",
      "init",
      "zenbu.plugin.json",
    )
  }
  try {
    const configPath = resolveConfigPath()
    if (!fs.existsSync(configPath)) return null
    const raw = fs.readFileSync(configPath, "utf8")
    const cfg = parseJsonc(raw) as { plugins?: unknown }
    if (!Array.isArray(cfg.plugins)) return null
    for (const manifestPath of cfg.plugins) {
      if (typeof manifestPath !== "string") continue
      const name = readManifestName(manifestPath)
      if (name === pluginName) return manifestPath
    }
  } catch {}
  return null
}

/**
 * Plugins live at the directory that contains their manifest (typically a
 * git repo root, but for the kernel this is actually two levels up from the
 * manifest — the repo root, not the `packages/init/` subdir).
 */
function resolvePluginRepoDir(manifestPath: string, pluginName: string): string {
  if (pluginName === "kernel") return CORE_REPO_ROOT
  return path.dirname(manifestPath)
}

export class GitUpdatesService extends Service {
  static key = "gitUpdates"
  static deps = { rpc: RpcService }
  declare ctx: { rpc: RpcService }

  private cache: UpdateStatus | null = null
  private cacheAt = 0
  private inFlight: Promise<UpdateStatus> | null = null

  evaluate() {
    this.cache = null
    this.cacheAt = 0
    this.inFlight = null
  }

  async getCachedStatus(): Promise<UpdateStatus | null> {
    return this.cache
  }

  async getDiffSummary(opts: {
    paths?: string[]
  } = {}): Promise<Record<string, { additions: number; deletions: number; binary: boolean }>> {
    const cwd = CORE_REPO_ROOT
    const out: Record<string, { additions: number; deletions: number; binary: boolean }> = {}
    try {
      if (!(await isRepo(cwd))) return out
      const result = await runGit(cwd, ["diff", "--numstat", "HEAD"])
      if (result.code === 0) {
        for (const raw of result.stdout.split("\n")) {
          const line = raw.trim()
          if (!line) continue
          const parts = line.split("\t")
          if (parts.length < 3) continue
          const [addStr, delStr, ...rest] = parts
          const path = rest.join("\t")
          if (!path) continue
          const binary = addStr === "-" && delStr === "-"
          out[path] = {
            additions: binary ? 0 : Number(addStr) || 0,
            deletions: binary ? 0 : Number(delStr) || 0,
            binary,
          }
        }
      }
      const targets = opts.paths && opts.paths.length > 0 ? opts.paths : null
      if (targets) {
        for (const p of targets) {
          if (p in out) continue
          try {
            const abs = path.join(cwd, p)
            const stat = await fs.promises.stat(abs)
            if (stat.size > MAX_DIFF_BYTES) {
              out[p] = { additions: 0, deletions: 0, binary: false }
              continue
            }
            const text = await fs.promises.readFile(abs, "utf8")
            if (looksBinary(text)) {
              out[p] = { additions: 0, deletions: 0, binary: true }
            } else {
              const lineCount = text === "" ? 0 : text.split("\n").filter((_, i, a) => i < a.length - 1 || a[i] !== "").length
              out[p] = { additions: lineCount, deletions: 0, binary: false }
            }
          } catch {
            out[p] = { additions: 0, deletions: 0, binary: false }
          }
        }
      }
    } catch {
      // return what we have
    }
    return out
  }

  async getFileDiff(opts: { path: string; oldPath?: string | null }): Promise<FileDiff> {
    const cwd = CORE_REPO_ROOT
    const newPath = opts.path
    const oldPath = opts.oldPath ?? opts.path
    if (!newPath) return { kind: "error", message: "Path is required" }
    try {
      if (!(await isRepo(cwd))) return { kind: "error", message: "Not a git repo" }
      const [oldText, newText] = await Promise.all([
        readFromHead(cwd, oldPath),
        readFromWorktree(cwd, newPath),
      ])
      const binary = looksBinary(oldText) || looksBinary(newText)
      if (binary) return { kind: "ok", oldText: "", newText: "", binary: true }
      return { kind: "ok", oldText, newText, binary: false }
    } catch (err) {
      if (err instanceof GitMissingError) return { kind: "error", message: "git missing" }
      const message = err instanceof Error ? err.message : String(err)
      return { kind: "error", message }
    }
  }

  async getOverview(): Promise<GitOverview> {
    const cwd = CORE_REPO_ROOT
    try {
      if (!(await isRepo(cwd))) return { kind: "not-a-repo" }
      const branch = await getBranch(cwd)
      const remote = await getRemoteUrl(cwd)
      const [status, branches, worktrees, log] = await Promise.all([
        getStatus(cwd),
        getBranches(cwd),
        getWorktrees(cwd),
        getLog(cwd, { limit: 20 }),
      ])
      const remoteInfo = remote ? parseRemoteUrl(remote) : null
      return {
        kind: "ok",
        root: cwd,
        branch,
        remote,
        remoteHost: remoteInfo?.host ?? null,
        remoteOwner: remoteInfo?.owner ?? null,
        remoteRepo: remoteInfo?.repo ?? null,
        remoteWebUrl: remoteInfo?.webUrl ?? null,
        status,
        branches,
        worktrees,
        log,
      }
    } catch (err) {
      if (err instanceof GitMissingError) return { kind: "git-missing" }
      const message = err instanceof Error ? err.message : String(err)
      return { kind: "error", message }
    }
  }

  async checkUpdates(force?: boolean): Promise<UpdateStatus> {
    const now = Date.now()
    if (!force && this.cache && now - this.cacheAt < CACHE_TTL_MS) {
      return this.cache
    }
    if (this.inFlight) return this.inFlight

    this.inFlight = this._runCheck().then((status) => {
      this.cache = status
      this.cacheAt = Date.now()
      return status
    }).finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  private async _runCheck(): Promise<UpdateStatus> {
    const cwd = CORE_REPO_ROOT

    try {
      if (!(await isRepo(cwd))) return { kind: "not-a-repo" }

      const branch = await getBranch(cwd)
      if (!branch) return { kind: "detached-head" }

      const remote = await getRemoteUrl(cwd)
      if (!remote) return { kind: "no-remote" }

      const shallow = await isShallow(cwd)
      try {
        await gitFetch(cwd, {
          remote: "origin",
          branch,
          deepen: shallow ? 50 : undefined,
        })
      } catch (err) {
        if (err instanceof GitCommandError) {
          return { kind: "fetch-error", message: err.stderr.trim() || err.message }
        }
        throw err
      }

      const status = await getStatus(cwd)
      const dirty =
        status.staged.length > 0 ||
        status.unstaged.length > 0 ||
        status.conflicted.length > 0 ||
        status.untracked.length > 0

      const headSha = await resolveRef(cwd, "HEAD")
      const upstreamSha = await resolveRef(cwd, "FETCH_HEAD")
      const [head, upstream] = await Promise.all([
        getCommit(cwd, headSha),
        getCommit(cwd, upstreamSha),
      ])

      const { ahead, behind } = await getAheadBehind(cwd, "HEAD", "FETCH_HEAD")

      const [headLog, upstreamLog] = await Promise.all([
        getLog(cwd, { ref: headSha, limit: 15 }),
        behind > 0 ? getLog(cwd, { ref: upstreamSha, limit: 15 }) : Promise.resolve<Commit[]>([]),
      ])
      const bySha = new Map<string, Commit>()
      for (const c of upstreamLog) bySha.set(c.sha, c)
      for (const c of headLog) bySha.set(c.sha, c)
      const commits = [...bySha.values()]
        .sort((a, b) => b.authorDate - a.authorDate)
        .slice(0, 15)

      let mergeable: boolean | null = null
      let conflictingFiles: string[] = []
      if (behind > 0) {
        try {
          const result = await checkMerge(cwd, "HEAD", "FETCH_HEAD")
          mergeable = result.clean
          conflictingFiles = result.conflictingFiles
        } catch (err) {
          if (shallow) {
            try {
              await gitFetch(cwd, { remote: "origin", branch, unshallow: true })
              const retried = await checkMerge(cwd, "HEAD", "FETCH_HEAD")
              mergeable = retried.clean
              conflictingFiles = retried.conflictingFiles
            } catch (retryErr) {
              const message = retryErr instanceof Error ? retryErr.message : String(retryErr)
              return { kind: "fetch-error", message }
            }
          } else {
            const message = err instanceof Error ? err.message : String(err)
            return { kind: "fetch-error", message }
          }
        }
      }

      return {
        kind: "ok",
        branch,
        ahead,
        behind,
        dirty,
        mergeable,
        conflictingFiles,
        head,
        upstream,
        commits,
        checkedAt: Date.now(),
      }
    } catch (err) {
      if (err instanceof GitMissingError) return { kind: "git-missing" }
      throw err
    }
  }

  private _invalidateCache() {
    this.cache = null
    this.cacheAt = 0
  }

  async pullUpdates(): Promise<MutationResult> {
    try {
      const branch = await getBranch(CORE_REPO_ROOT)
      if (!branch) return { ok: false, error: "Not on a branch" }
      await gitPull(CORE_REPO_ROOT, { ffOnly: true, remote: "origin", branch })
      this._invalidateCache()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: formatError(err) }
    }
  }

  /**
   * Pull upstream changes for a plugin and conditionally run its setup.ts
   * (via the cached bun binary) when the manifest's declared `setup.version`
   * has advanced beyond what's recorded in the per-machine state file.
   *
   * Streams setup subprocess output live via `rpc.emit.setup.progress` so the
   * UI can render the log in real time.
   *
   * Returns `requiresRelaunch: true` whenever `setup.ts` actually ran. The
   * author bumped `setup.version` on purpose — that's a declaration that the
   * running process has stale state. Earlier attempts at smarter heuristics
   * (lockfile hash diffs) gave false negatives when `pnpm install`
   * materialised a lockfile-already-tracked dep into node_modules without
   * changing the lockfile itself. Default to "yes, restart" and let
   * no-bump-no-setup be the opt-out path.
   */
  async pullAndInstall(
    opts: PullAndInstallOpts = {},
  ): Promise<PullAndInstallResult> {
    const pluginName = opts.plugin ?? "kernel"

    const manifestPath = resolvePluginManifest(pluginName)
    if (!manifestPath || !fs.existsSync(manifestPath)) {
      return {
        ok: false,
        error: `No manifest found for plugin "${pluginName}"`,
        stage: "lookup",
        plugin: pluginName,
      }
    }
    const repoDir = resolvePluginRepoDir(manifestPath, pluginName)

    // --- Pull ---

    let updated = false
    let headBefore: string | null = null
    const isGitRepo = await isRepo(repoDir)
    try {
      if (isGitRepo) {
        const branch = await getBranch(repoDir)
        if (!branch) {
          return {
            ok: false,
            error: "Not on a branch",
            stage: "pull",
            plugin: pluginName,
          }
        }
        headBefore = await resolveRef(repoDir, "HEAD")
        await gitPull(repoDir, { ffOnly: true, remote: "origin", branch })
        const headAfter = await resolveRef(repoDir, "HEAD")
        updated = headBefore !== headAfter
      }
    } catch (err) {
      return {
        ok: false,
        error: `pull failed: ${formatError(err)}`,
        stage: "pull",
        plugin: pluginName,
      }
    }
    if (pluginName === "kernel") this._invalidateCache()

    // --- Gate: declared setup.version vs stored ---

    const setup = readManifestSetup(manifestPath)
    if (!setup) {
      // No setup declared; plugin doesn't need any host configuration.
      return {
        ok: true,
        updated,
        setupRan: false,
        pending: false,
        headBefore,
        version: null,
        plugin: pluginName,
      }
    }
    const stored = getStoredSetupVersion(pluginName)
    if (setup.version <= stored) {
      return {
        ok: true,
        updated,
        setupRan: false,
        pending: false,
        headBefore,
        version: null,
        plugin: pluginName,
      }
    }

    // --- Run setup.ts ---

    if (!fs.existsSync(BUN_BIN)) {
      await this._maybeRollback(repoDir, headBefore)
      return {
        ok: false,
        error: `bun binary missing at ${BUN_BIN} — relaunch the app or reinstall`,
        stage: "setup",
        plugin: pluginName,
      }
    }
    if (!fs.existsSync(setup.scriptAbs)) {
      await this._maybeRollback(repoDir, headBefore)
      return {
        ok: false,
        error: `setup script missing at ${setup.scriptAbs}`,
        stage: "setup",
        plugin: pluginName,
      }
    }

    try {
      await this._runSetupScript({
        pluginName,
        scriptAbs: setup.scriptAbs,
        cwd: repoDir,
      })
    } catch (err) {
      await this._maybeRollback(repoDir, headBefore)
      return {
        ok: false,
        error: formatError(err),
        stage: "setup",
        plugin: pluginName,
      }
    }

    // Staged. Deliberately DO NOT write setup-state yet — the UI must call
    // either `commitPluginUpdate` (writes state + relaunch) or
    // `rollbackPluginUpdate` (git reset --hard headBefore).
    return {
      ok: true,
      updated,
      setupRan: true,
      pending: true,
      headBefore,
      version: setup.version,
      plugin: pluginName,
    }
  }

  /**
   * Attempt to `git reset --hard <headBefore>` in the plugin's repo. Used
   * internally after a failed setup, and exposed via RPC for the UI to call
   * when the user dismisses the relaunch modal.
   */
  private async _maybeRollback(
    repoDir: string,
    headBefore: string | null,
  ): Promise<void> {
    if (!headBefore) return
    try {
      if (!(await isRepo(repoDir))) return
      await runGit(repoDir, ["reset", "--hard", headBefore])
    } catch (err) {
      console.error("[gitUpdates] rollback failed:", err)
    }
  }

  /**
   * Called by the UI after the user clicks "Relaunch now" in the relaunch
   * modal. Writes the setup-version state and restarts the app so the new
   * code + deps are picked up cleanly.
   */
  async commitPluginUpdate(opts: {
    plugin: string
    version: number
  }): Promise<{ ok: true }> {
    try {
      recordSetupVersion(opts.plugin, opts.version)
    } catch (err) {
      console.error("[gitUpdates] recordSetupVersion failed:", err)
      // Proceed with relaunch anyway — worst case, the gate re-fires on the
      // next update.
    }
    queueMicrotask(() => {
      // Fire and forget — awaiting would hang because we're tearing down the
      // transport carrying the RPC response.
      try {
        app.relaunch()
        app.exit(0)
      } catch (err) {
        console.error("[gitUpdates] relaunch failed:", err)
      }
    })
    return { ok: true }
  }

  /**
   * Called by the UI when the user dismisses the relaunch modal. Reverts
   * the plugin's git worktree to `headBefore` so the running process sees
   * its pre-pull files again. node_modules may retain extra deps that were
   * just installed — harmless, since the now-reverted code doesn't import
   * them.
   */
  async rollbackPluginUpdate(opts: {
    plugin: string
    headBefore: string | null
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    const manifestPath = resolvePluginManifest(opts.plugin)
    if (!manifestPath) return { ok: true }
    const repoDir = resolvePluginRepoDir(manifestPath, opts.plugin)
    try {
      await this._maybeRollback(repoDir, opts.headBefore)
      if (opts.plugin === "kernel") this._invalidateCache()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: formatError(err) }
    }
  }

  private _runSetupScript(args: {
    pluginName: string
    scriptAbs: string
    cwd: string
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(BUN_BIN, [args.scriptAbs], {
        cwd: args.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "0" },
      })
      let stderrBuf = ""

      const streamChunk = (chunk: string, saveStderr: boolean) => {
        if (saveStderr) stderrBuf += chunk
        for (const raw of chunk.split(/\r?\n/)) {
          const line = raw.trimEnd()
          if (!line) continue
          try {
            this.ctx.rpc.emit.setup.progress({
              pluginName: args.pluginName,
              line,
            })
          } catch {}
        }
      }
      proc.stdout.on("data", (d: Buffer) => streamChunk(d.toString(), false))
      proc.stderr.on("data", (d: Buffer) => streamChunk(d.toString(), true))

      proc.on("error", reject)
      proc.on("close", (code) => {
        if (code === 0) resolve()
        else
          reject(
            new Error(
              `setup exited ${code}${
                stderrBuf.trim() ? `: ${stderrBuf.trim()}` : ""
              }`,
            ),
          )
      })
    })
  }

  async commitChanges(opts: { message: string }): Promise<MutationResult> {
    try {
      const msg = opts.message?.trim()
      if (!msg) return { ok: false, error: "Commit message is required" }
      const sha = await gitCommit(CORE_REPO_ROOT, { message: msg, stageAll: true })
      this._invalidateCache()
      return { ok: true, sha }
    } catch (err) {
      return { ok: false, error: formatError(err) }
    }
  }

  async checkoutRef(ref: string): Promise<MutationResult> {
    try {
      if (!ref?.trim()) return { ok: false, error: "Ref is required" }
      await gitCheckout(CORE_REPO_ROOT, ref.trim())
      this._invalidateCache()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: formatError(err) }
    }
  }

  async createBranchAndCheckout(opts: { name: string; from?: string }): Promise<MutationResult> {
    try {
      const name = opts.name?.trim()
      if (!name) return { ok: false, error: "Branch name is required" }
      await gitCreateBranch(CORE_REPO_ROOT, name, { checkout: true, from: opts.from })
      this._invalidateCache()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: formatError(err) }
    }
  }

  async deleteBranchByName(name: string, opts: { force?: boolean } = {}): Promise<MutationResult> {
    try {
      if (!name?.trim()) return { ok: false, error: "Branch name is required" }
      await gitDeleteBranch(CORE_REPO_ROOT, name.trim(), opts)
      this._invalidateCache()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: formatError(err) }
    }
  }

  async pushCurrent(opts: { setUpstream?: boolean } = {}): Promise<MutationResult> {
    try {
      const branch = await getBranch(CORE_REPO_ROOT)
      if (!branch) return { ok: false, error: "Not on a branch" }
      await gitPush(CORE_REPO_ROOT, {
        remote: "origin",
        branch,
        setUpstream: opts.setUpstream ?? false,
      })
      this._invalidateCache()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: formatError(err) }
    }
  }

  async createPullRequest(opts: {
    branchName: string
    commitMessage?: string
    baseBranch?: string
  }): Promise<MutationResult> {
    const branchName = opts.branchName?.trim()
    if (!branchName) return { ok: false, error: "Branch name is required" }
    const base = opts.baseBranch?.trim() || "main"

    try {
      const remote = await getRemoteUrl(CORE_REPO_ROOT)
      if (!remote) return { ok: false, error: "No remote configured" }
      const remoteInfo = parseRemoteUrl(remote)
      if (!remoteInfo) return { ok: false, error: `Can't parse remote URL: ${remote}` }

      await gitCreateBranch(CORE_REPO_ROOT, branchName, { checkout: true })

      const status = await getStatus(CORE_REPO_ROOT)
      const hasChanges =
        status.staged.length > 0 ||
        status.unstaged.length > 0 ||
        status.untracked.length > 0
      if (hasChanges) {
        const message = opts.commitMessage?.trim()
        if (!message) {
          return { ok: false, error: "Commit message is required when there are uncommitted changes" }
        }
        await gitCommit(CORE_REPO_ROOT, { message, stageAll: true })
      }

      await gitPush(CORE_REPO_ROOT, {
        remote: "origin",
        branch: branchName,
        setUpstream: true,
      })

      this._invalidateCache()
      return { ok: true, url: remoteInfo.prUrl(base, branchName) }
    } catch (err) {
      return { ok: false, error: formatError(err) }
    }
  }
}

function formatError(err: unknown): string {
  if (err instanceof GitCommandError) {
    return err.stderr.trim() || err.message
  }
  if (err instanceof Error) return err.message
  return String(err)
}

async function readFromHead(cwd: string, relPath: string): Promise<string> {
  const result = await runGit(cwd, ["show", `HEAD:${relPath}`])
  if (result.code !== 0) {
    // File didn't exist at HEAD (added/untracked) → empty.
    return ""
  }
  if (result.stdout.length > MAX_DIFF_BYTES) {
    throw new Error(`File too large to diff (${result.stdout.length} bytes)`)
  }
  return result.stdout
}

async function readFromWorktree(cwd: string, relPath: string): Promise<string> {
  const abs = path.join(cwd, relPath)
  try {
    const stat = await fs.promises.stat(abs)
    if (stat.size > MAX_DIFF_BYTES) {
      throw new Error(`File too large to diff (${stat.size} bytes)`)
    }
    return await fs.promises.readFile(abs, "utf8")
  } catch (err: any) {
    if (err?.code === "ENOENT") return ""
    throw err
  }
}

function looksBinary(text: string): boolean {
  const probe = text.length > BINARY_PROBE_BYTES ? text.slice(0, BINARY_PROBE_BYTES) : text
  return probe.includes("\u0000")
}

runtime.register(GitUpdatesService, (import.meta as any).hot)
