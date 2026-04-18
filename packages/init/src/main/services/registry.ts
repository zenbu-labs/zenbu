import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  GitCommandError,
  GitMissingError,
  clone as gitClone,
  getRemoteUrl,
  parseRemoteUrl,
} from "@zenbu/git"
import { Service, runtime } from "../runtime"
import { InstallerService } from "./installer"

const PLUGINS_ROOT = path.join(os.homedir(), ".zenbu", "plugins")
const CORE_REPO_ROOT = path.join(PLUGINS_ROOT, "zenbu")
const LOCAL_REGISTRY_PATH = path.join(CORE_REPO_ROOT, "registry.jsonl")

export type RegistryEntry = {
  name: string
  title?: string
  description: string
  repo: string
}

export type RegistryListing = {
  source: "remote" | "local"
  entries: Array<
    RegistryEntry & {
      installed: boolean
      installPath: string
      enabled: boolean
      manifestPath: string | null
    }
  >
  warning?: string
}

export type RegistryResult =
  | { ok: true; listing: RegistryListing }
  | { ok: false; error: string }

export type InstallResult =
  | { ok: true; manifestPath: string; log: string[] }
  | { ok: false; error: string; log?: string[] }

export type RepoInfo = {
  stars: number
  forks: number
  defaultBranch: string
  updatedAt: string
  htmlUrl: string
  description: string
  ownerLogin: string
}

export type RepoInfoResult =
  | { ok: true; info: RepoInfo }
  | { ok: false; error: string }

export type RepoReadmeResult =
  | { ok: true; content: string; defaultBranch: string }
  | { ok: false; error: string }

function parseJsonl(raw: string): RegistryEntry[] {
  const entries: RegistryEntry[] = []
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const obj = JSON.parse(trimmed)
      if (
        obj &&
        typeof obj.name === "string" &&
        typeof obj.repo === "string"
      ) {
        entries.push({
          name: obj.name,
          title: typeof obj.title === "string" ? obj.title : undefined,
          description: typeof obj.description === "string" ? obj.description : "",
          repo: obj.repo,
        })
      }
    } catch {
      // skip malformed lines
    }
  }
  return entries
}

async function fetchRemoteRegistry(): Promise<
  { entries: RegistryEntry[] } | { error: string }
> {
  const remote = await getRemoteUrl(CORE_REPO_ROOT)
  if (!remote) return { error: "No Core remote configured" }
  const parsed = parseRemoteUrl(remote)
  if (!parsed) return { error: `Unrecognised remote URL: ${remote}` }

  const rawUrl =
    parsed.host === "github.com"
      ? `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/main/registry.jsonl`
      : null
  if (!rawUrl) {
    return { error: `Remote host ${parsed.host} not supported yet` }
  }

  try {
    const response = await fetch(rawUrl, { redirect: "follow" })
    if (!response.ok) {
      return { error: `GET ${rawUrl} → ${response.status} ${response.statusText}` }
    }
    const text = await response.text()
    return { entries: parseJsonl(text) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

function readLocalRegistry(): RegistryEntry[] {
  if (!fs.existsSync(LOCAL_REGISTRY_PATH)) return []
  try {
    return parseJsonl(fs.readFileSync(LOCAL_REGISTRY_PATH, "utf8"))
  } catch {
    return []
  }
}

function installPathFor(name: string): string {
  return path.join(PLUGINS_ROOT, name)
}

function isInstalled(name: string): boolean {
  return fs.existsSync(installPathFor(name))
}

const BUN_BIN = path.join(
  os.homedir(),
  "Library",
  "Caches",
  "Zenbu",
  "bin",
  "bun",
)

function runSetupScript(
  cwd: string,
  script: string,
  onLog: (line: string) => void,
): Promise<void> {
  // Prefer bun for .ts scripts; fall back to bash for legacy .sh.
  const isTs = script.endsWith(".ts")
  const cmd = isTs ? BUN_BIN : "bash"
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, [script], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0" },
    })
    proc.stdout.on("data", (d: Buffer) => {
      const line = d.toString().trim()
      if (line) onLog(line)
    })
    proc.stderr.on("data", (d: Buffer) => {
      const line = d.toString().trim()
      if (line) onLog(line)
    })
    proc.on("error", reject)
    proc.on("close", (code) => {
      if (code === 0) resolve()
      else
        reject(
          new Error(`${path.basename(script)} exited with code ${code}`),
        )
    })
  })
}

function findManifest(dir: string): string | null {
  const root = path.join(dir, "zenbu.plugin.json")
  if (fs.existsSync(root)) return root
  // Shallow search: one level down (e.g., packages/foo/zenbu.plugin.json)
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
      const sub = path.join(dir, entry.name, "zenbu.plugin.json")
      if (fs.existsSync(sub)) return sub
    }
  } catch {}
  return null
}

export class RegistryService extends Service {
  static key = "registry"
  static deps = { installer: InstallerService }
  declare ctx: { installer: InstallerService }

  evaluate() {}

  async getRegistry(): Promise<RegistryResult> {
    const statuses = this.ctx.installer.listPluginsWithStatus()
    const byName = new Map<string, { manifestPath: string; enabled: boolean }>()
    for (const s of statuses) {
      byName.set(s.name, { manifestPath: s.manifestPath, enabled: s.enabled })
    }
    const enrich = <T extends { name: string }>(e: T) => {
      const status = byName.get(e.name)
      return {
        ...e,
        installed: isInstalled(e.name),
        installPath: installPathFor(e.name),
        enabled: status?.enabled ?? false,
        manifestPath: status?.manifestPath ?? null,
      }
    }

    const remote = await fetchRemoteRegistry()
    if ("entries" in remote) {
      return {
        ok: true,
        listing: {
          source: "remote",
          entries: remote.entries.map(enrich),
        },
      }
    }

    const local = readLocalRegistry()
    if (local.length === 0) return { ok: false, error: remote.error }
    return {
      ok: true,
      listing: {
        source: "local",
        warning: `Using local registry (${remote.error})`,
        entries: local.map(enrich),
      },
    }
  }

  async getRepoInfo(args: { repo: string }): Promise<RepoInfoResult> {
    const parsed = parseRemoteUrl(args.repo)
    if (!parsed) return { ok: false, error: `Unrecognised repo URL: ${args.repo}` }
    if (parsed.host !== "github.com") {
      return { ok: false, error: `Host ${parsed.host} not supported yet` }
    }
    const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`
    try {
      const response = await fetch(apiUrl, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "zenbu",
        },
      })
      if (!response.ok) {
        return {
          ok: false,
          error: `GET ${apiUrl} → ${response.status} ${response.statusText}`,
        }
      }
      const data = (await response.json()) as {
        stargazers_count?: number
        forks_count?: number
        default_branch?: string
        updated_at?: string
        pushed_at?: string
        html_url?: string
        description?: string | null
        owner?: { login?: string }
      }
      return {
        ok: true,
        info: {
          stars: data.stargazers_count ?? 0,
          forks: data.forks_count ?? 0,
          defaultBranch: data.default_branch ?? "main",
          updatedAt: data.pushed_at ?? data.updated_at ?? "",
          htmlUrl: data.html_url ?? parsed.webUrl,
          description: data.description ?? "",
          ownerLogin: data.owner?.login ?? parsed.owner,
        },
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async getRepoReadme(args: { repo: string }): Promise<RepoReadmeResult> {
    const parsed = parseRemoteUrl(args.repo)
    if (!parsed) return { ok: false, error: `Unrecognised repo URL: ${args.repo}` }
    if (parsed.host !== "github.com") {
      return { ok: false, error: `Host ${parsed.host} not supported yet` }
    }
    const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/readme`
    try {
      const response = await fetch(apiUrl, {
        headers: {
          Accept: "application/vnd.github.raw+json",
          "User-Agent": "zenbu",
        },
      })
      if (response.status === 404) {
        return { ok: false, error: "No README in this repository" }
      }
      if (!response.ok) {
        return {
          ok: false,
          error: `GET ${apiUrl} → ${response.status} ${response.statusText}`,
        }
      }
      const content = await response.text()
      // Find default branch for resolving relative links/images later if we want to.
      // We don't strictly need to re-fetch metadata here; callers can request it separately.
      return { ok: true, content, defaultBranch: "" }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async installFromRegistry(entry: RegistryEntry): Promise<InstallResult> {
    const log: string[] = []
    const append = (line: string) => log.push(line)
    try {
      if (!entry.name || !entry.repo) {
        return { ok: false, error: "Missing name or repo" }
      }
      const target = installPathFor(entry.name)
      if (fs.existsSync(target)) {
        return { ok: false, error: `${target} already exists` }
      }
      fs.mkdirSync(PLUGINS_ROOT, { recursive: true })

      append(`Cloning ${entry.repo} → ${target}`)
      await gitClone(entry.repo, target)

      const manifest = findManifest(target)
      if (!manifest) {
        return {
          ok: false,
          error: `No zenbu.plugin.json found in ${target}`,
          log,
        }
      }
      append(`Manifest: ${manifest}`)

      const manifestDir = path.dirname(manifest)
      // Prefer setup.ts (new convention); fall back to setup.sh for legacy.
      const setupTs = path.join(manifestDir, "setup.ts")
      const setupSh = path.join(manifestDir, "setup.sh")
      let setupScript: string | null = null
      if (fs.existsSync(setupTs)) setupScript = setupTs
      else if (fs.existsSync(setupSh)) setupScript = setupSh
      if (setupScript) {
        append(`Running ${path.basename(setupScript)}…`)
        await runSetupScript(manifestDir, setupScript, append)
      } else {
        append("No setup script (skipping)")
      }

      this.ctx.installer.addPluginToConfig(manifest)
      append(`Added to config`)

      return { ok: true, manifestPath: manifest, log }
    } catch (err) {
      let message: string
      if (err instanceof GitMissingError) message = "git isn't installed"
      else if (err instanceof GitCommandError)
        message = err.stderr.trim() || err.message
      else if (err instanceof Error) message = err.message
      else message = String(err)
      return { ok: false, error: message, log }
    }
  }
}

runtime.register(RegistryService, (import.meta as any).hot)
