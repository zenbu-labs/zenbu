import path from "node:path"
import os from "node:os"
import fs from "node:fs"
import { pathToFileURL } from "node:url"

const MONOREPO = path.join(os.homedir(), ".zenbu", "plugins", "zenbu")
const PACKAGES = path.join(MONOREPO, "packages")
const ZENBU_ALIAS = "#zenbu/"

const LOADER_NAME = "alias-loader"
let tracePort = null
const stats = {
  resolveCount: 0,
  resolveMs: 0,
  loadCount: 0,
  loadMs: 0,
}
export function initialize(data) {
  if (!data || !data.tracePort) return
  tracePort = data.tracePort
  tracePort.on("message", (msg) => {
    if (msg === "flush") {
      try {
        tracePort.postMessage({ name: LOADER_NAME, ...stats })
      } catch {}
      stats.resolveCount = 0
      stats.resolveMs = 0
      stats.loadCount = 0
      stats.loadMs = 0
    }
  })
  tracePort.unref?.()
}

function resolveToFile(resolved) {
  if (path.extname(resolved)) return resolved
  if (fs.existsSync(resolved + ".ts")) return resolved + ".ts"
  if (fs.existsSync(path.join(resolved, "index.ts"))) return path.join(resolved, "index.ts")
  return resolved + ".ts"
}

function resolveImpl(specifier, context, nextResolve) {
  if (specifier.startsWith(ZENBU_ALIAS)) {
    const rest = specifier.slice(ZENBU_ALIAS.length)
    const slashIdx = rest.indexOf("/")
    const pkgName = slashIdx >= 0 ? rest.slice(0, slashIdx) : rest
    const subpath = slashIdx >= 0 ? "./" + rest.slice(slashIdx + 1) : "."
    const pkgDir = path.join(PACKAGES, pkgName)
    if (fs.existsSync(pkgDir)) {
      const pkgJson = path.join(pkgDir, "package.json")
      if (fs.existsSync(pkgJson)) {
        const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf-8"))
        const exportTarget = pkg.exports?.[subpath]
        if (exportTarget) {
          const target = typeof exportTarget === "string" ? exportTarget : exportTarget.default ?? exportTarget.import
          if (target) {
            const filePath = path.resolve(pkgDir, target)
            return { url: pathToFileURL(filePath).href, shortCircuit: true }
          }
        }
      }
      if (subpath !== ".") {
        const filePath = resolveToFile(path.join(pkgDir, rest.slice(slashIdx + 1)))
        return { url: pathToFileURL(filePath).href, shortCircuit: true }
      }
      const main = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf-8")).main ?? "index.ts"
      const filePath = resolveToFile(path.join(pkgDir, main))
      return { url: pathToFileURL(filePath).href, shortCircuit: true }
    }
  }

  return nextResolve(specifier, context)
}

export function resolve(specifier, context, nextResolve) {
  const start = Date.now()
  try {
    return resolveImpl(specifier, context, nextResolve)
  } finally {
    stats.resolveCount++
    stats.resolveMs += Date.now() - start
  }
}
