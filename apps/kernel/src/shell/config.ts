import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const CONFIG_DIR = path.join(os.homedir(), ".zenbu")
const CONFIG_JSONC = path.join(CONFIG_DIR, "config.jsonc")
const CONFIG_JSON = path.join(CONFIG_DIR, "config.json")

function resolveConfigPath(): string {
  if (fs.existsSync(CONFIG_JSONC)) return CONFIG_JSONC
  return CONFIG_JSON
}

const CONFIG_PATH = resolveConfigPath()

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

export interface ZenbuConfig {
  plugins: string[]
}

export function readConfig(): ZenbuConfig {
  if (!fs.existsSync(CONFIG_PATH)) return { plugins: [] }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8")
    const parsed = parseJsonc(raw)
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).plugins)) {
      return { plugins: [] }
    }
    return parsed as ZenbuConfig
  } catch {
    return { plugins: [] }
  }
}

export function writeConfig(config: ZenbuConfig): void {
  const dir = path.dirname(CONFIG_PATH)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export function addPlugin(entryPoint: string): void {
  const config = readConfig()
  if (!config.plugins.includes(entryPoint)) {
    config.plugins.push(entryPoint)
    writeConfig(config)
  }
}

export function removePlugin(entryPoint: string): void {
  const config = readConfig()
  config.plugins = config.plugins.filter(p => p !== entryPoint)
  writeConfig(config)
}

export { CONFIG_PATH }
