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
import { Service, runtime } from "../runtime"

const CORE_REPO_ROOT = path.join(os.homedir(), ".zenbu", "plugins", "zenbu")

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

function runRepoSetup(cwd: string): Promise<void> {
  const script = path.join(cwd, "setup.sh")
  if (!fs.existsSync(script)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const proc = spawn("bash", [script], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0" },
    })
    let stderr = ""
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString()
    })
    proc.on("error", reject)
    proc.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`setup.sh exited ${code}: ${stderr.trim()}`))
    })
  })
}

export class GitUpdatesService extends Service {
  static key = "gitUpdates"
  static deps = {}

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
   * Pull upstream changes and then run the core repo's setup.sh idempotently
   * so any new dependencies / plugin install steps land. Returns whether any
   * commits were actually pulled so the UI can show a transient state.
   */
  async pullAndInstall(): Promise<
    | { ok: true; updated: boolean }
    | { ok: false; error: string }
  > {
    try {
      const branch = await getBranch(CORE_REPO_ROOT)
      if (!branch) return { ok: false, error: "Not on a branch" }
      const headBefore = await resolveRef(CORE_REPO_ROOT, "HEAD")
      await gitPull(CORE_REPO_ROOT, { ffOnly: true, remote: "origin", branch })
      const headAfter = await resolveRef(CORE_REPO_ROOT, "HEAD")
      const updated = headBefore !== headAfter
      this._invalidateCache()
      try {
        await runRepoSetup(CORE_REPO_ROOT)
      } catch (err) {
        return { ok: false, error: `setup.sh failed: ${formatError(err)}` }
      }
      return { ok: true, updated }
    } catch (err) {
      return { ok: false, error: formatError(err) }
    }
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
