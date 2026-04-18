import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import { Service, runtime } from "../runtime"

type InstalledPlugin = {
  manifestPath: string
  name: string
  services: string[]
}

type RegistryEntry = {
  name: string
  title?: string
  description: string
  repo: string
}

type FileNode = {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileNode[]
}

function resolveConfigPath(): string {
  const jsonc = path.join(os.homedir(), ".zenbu", "config.jsonc")
  if (fs.existsSync(jsonc)) return jsonc
  return path.join(os.homedir(), ".zenbu", "config.json")
}

function parseJsonc(str: string): unknown {
  let result = ""
  let i = 0
  while (i < str.length) {
    if (str[i] === '"') {
      let j = i + 1
      while (j < str.length) {
        if (str[j] === "\\") { j += 2 }
        else if (str[j] === '"') { j++; break }
        else { j++ }
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

function readZenbuConfig(): { plugins: string[] } {
  const configPath = resolveConfigPath()
  if (!fs.existsSync(configPath)) return { plugins: [] }
  try {
    const raw = fs.readFileSync(configPath, "utf8")
    const parsed = parseJsonc(raw)
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).plugins)) {
      return { plugins: [] }
    }
    return parsed as { plugins: string[] }
  } catch {
    return { plugins: [] }
  }
}

function expandGlob(pattern: string): string[] {
  const dir = path.dirname(pattern)
  const filePattern = path.basename(pattern)
  const regex = new RegExp(
    "^" + filePattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
  )
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => regex.test(f))
    .map((f) => path.resolve(dir, f))
}

function resolveManifestServices(
  manifestPath: string,
  visited = new Set<string>(),
): string[] {
  const resolved = path.resolve(manifestPath)
  if (visited.has(resolved)) return []
  visited.add(resolved)

  try {
    const raw = fs.readFileSync(resolved, "utf8")
    const manifest = JSON.parse(raw)
    const entries: string[] = manifest.services ?? []
    const baseDir = path.dirname(resolved)
    const services: string[] = []

    for (const entry of entries) {
      const full = path.resolve(baseDir, entry)
      if (full.includes("*")) {
        for (const file of expandGlob(full)) {
          services.push(path.relative(baseDir, file))
        }
      } else if (full.endsWith(".json")) {
        services.push(...resolveManifestServices(full, visited))
      } else {
        services.push(path.relative(baseDir, full))
      }
    }
    return services
  } catch {
    return []
  }
}

function derivePluginName(manifestPath: string): string {
  try {
    const raw = fs.readFileSync(manifestPath, "utf8")
    const manifest = JSON.parse(raw)
    if (manifest.name) return manifest.name
  } catch {}
  const dir = path.dirname(path.resolve(manifestPath))
  return path.basename(dir)
}

function readFileTree(dir: string, depth = 0, maxDepth = 4): FileNode[] {
  if (depth >= maxDepth) return []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries
      .filter(
        (e) =>
          !e.name.startsWith(".") &&
          e.name !== "node_modules" &&
          e.name !== "dist" &&
          e.name !== ".git",
      )
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })
      .map((entry): FileNode => {
        const fullPath = path.join(dir, entry.name)
        const relativePath = path.relative(process.cwd(), fullPath)
        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: relativePath,
            type: "directory",
            children: readFileTree(fullPath, depth + 1, maxDepth),
          }
        }
        return { name: entry.name, path: relativePath, type: "file" }
      })
  } catch {
    return []
  }
}

export class InstallerService extends Service {
  static key = "installer"
  static deps = {}

  needsSetup = false
  private pluginRoot = ""

  evaluate() {
    const config = (globalThis as any).__zenbu_config__ ?? { plugins: [] }
    if (config.plugins.length > 0) {
      const firstPlugin = config.plugins[0]
      let dir = path.dirname(path.resolve(firstPlugin))
      while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, "package.json"))) {
          this.pluginRoot = dir
          break
        }
        dir = path.dirname(dir)
      }
    }

    this.needsSetup = this.pluginRoot !== "" && !fs.existsSync(path.join(this.pluginRoot, "node_modules"))
    console.log(`[installer] service ready (needsSetup: ${this.needsSetup}, root: ${this.pluginRoot})`)
  }

  getPluginRoot(): string {
    return this.pluginRoot
  }

  getInstalledPlugins(): InstalledPlugin[] {
    const config = readZenbuConfig()
    return config.plugins.map((manifestPath) => ({
      manifestPath,
      name: derivePluginName(manifestPath),
      services: resolveManifestServices(manifestPath),
    }))
  }

  listPluginsWithStatus(): { manifestPath: string; name: string; enabled: boolean }[] {
    const configPath = resolveConfigPath()
    if (!fs.existsSync(configPath)) return []
    const raw = fs.readFileSync(configPath, "utf8")
    const results: { manifestPath: string; name: string; enabled: boolean }[] = []
    const pluginLineRe = /^\s*(\/\/)?\s*"([^"]+\.json)"/

    for (const line of raw.split("\n")) {
      const match = line.match(pluginLineRe)
      if (!match) continue
      const commented = !!match[1]
      const manifestPath = match[2]!
      results.push({
        manifestPath,
        name: derivePluginName(manifestPath),
        enabled: !commented,
      })
    }
    return results
  }

  addPluginToConfig(manifestPath: string): void {
    const configPath = resolveConfigPath()
    if (!fs.existsSync(configPath)) {
      const initial = `{\n  "plugins": [\n    "${manifestPath}",\n  ],\n}\n`
      fs.writeFileSync(configPath, initial)
      return
    }
    const raw = fs.readFileSync(configPath, "utf8")
    const lines = raw.split("\n")

    const pluginLineRe = /^(\s*)(\/\/\s*)?"([^"]+\.json)"/
    let lastPluginIdx = -1
    let arrayCloseIdx = -1
    let pluginsKeyIdx = -1
    let indent = "    "

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      if (pluginsKeyIdx === -1 && /"plugins"\s*:\s*\[/.test(line)) {
        pluginsKeyIdx = i
        continue
      }
      if (pluginsKeyIdx !== -1) {
        const match = line.match(pluginLineRe)
        if (match) {
          lastPluginIdx = i
          indent = match[1]!
          if (match[3] === manifestPath) return
        }
        if (/^\s*\]/.test(line)) {
          arrayCloseIdx = i
          break
        }
      }
    }

    if (arrayCloseIdx === -1) return

    const newLine = `${indent}"${manifestPath}",`
    const insertAt = lastPluginIdx >= 0 ? lastPluginIdx + 1 : arrayCloseIdx

    if (lastPluginIdx >= 0 && !lines[lastPluginIdx]!.trimEnd().endsWith(",")) {
      lines[lastPluginIdx] = lines[lastPluginIdx]!.replace(/(\s*)$/, ",$1")
    }

    lines.splice(insertAt, 0, newLine)
    fs.writeFileSync(configPath, lines.join("\n"))
  }

  togglePlugin(manifestPath: string, enabled: boolean): void {
    const configPath = resolveConfigPath()
    if (!fs.existsSync(configPath)) return
    const raw = fs.readFileSync(configPath, "utf8")
    const lines = raw.split("\n")
    const escaped = manifestPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const re = new RegExp(`^(\\s*)(//\\s*)?("${escaped}")`)

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i]!.match(re)
      if (!match) continue
      const indent = match[1]!
      const quoted = match[3]!
      const rest = lines[i]!.slice(match[0].length)
      lines[i] = enabled
        ? `${indent}${quoted}${rest}`
        : `${indent}// ${quoted}${rest}`
      break
    }
    fs.writeFileSync(configPath, lines.join("\n"))
  }

  getPluginRegistry(): RegistryEntry[] {
    const registryPath = path.join(process.cwd(), "registry.jsonl")
    if (!fs.existsSync(registryPath)) return []
    try {
      const raw = fs.readFileSync(registryPath, "utf8")
      return raw
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as RegistryEntry)
    } catch {
      return []
    }
  }

  getFileTree(): { cwd: string; tree: FileNode[] } {
    const cwd = process.cwd()
    return { cwd, tree: readFileTree(cwd) }
  }

  async runSetup(onProgress: (message: string) => void): Promise<boolean> {
    // Historically this ran `bash setup.sh`. The new convention is
    // `bun setup.ts` driven by the plugin's manifest setup.script field.
    // Accept either (setup.ts preferred) so legacy plugin repos still work.
    const setupTs = path.join(this.pluginRoot, "setup.ts")
    const setupSh = path.join(this.pluginRoot, "setup.sh")
    const bunBin = path.join(
      os.homedir(),
      "Library",
      "Caches",
      "Zenbu",
      "bin",
      "bun",
    )

    let cmd: string
    let args: string[]
    if (fs.existsSync(setupTs) && fs.existsSync(bunBin)) {
      cmd = bunBin
      args = [setupTs]
    } else if (fs.existsSync(setupSh)) {
      cmd = "bash"
      args = [setupSh]
    } else {
      onProgress("No setup script found")
      return false
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        cwd: this.pluginRoot,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "0" },
      })

      proc.stdout.on("data", (data: Buffer) => {
        const line = data.toString().trim()
        if (line) onProgress(line)
      })

      proc.stderr.on("data", (data: Buffer) => {
        const line = data.toString().trim()
        if (line) onProgress(line)
      })

      proc.on("close", (code) => {
        if (code === 0) resolve(true)
        else reject(new Error(`Setup script failed with code ${code}`))
      })

      proc.on("error", (err) => reject(err))
    })
  }
}

runtime.register(InstallerService, (import.meta as any).hot)
