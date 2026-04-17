import path from "node:path"
import os from "node:os"
import fs from "node:fs"
import { pathToFileURL } from "node:url"

const MONOREPO = path.join(os.homedir(), ".zenbu", "plugins", "zenbu")
const PACKAGES = path.join(MONOREPO, "packages")
// testbu is temporary will migrate to fully zenbu soon
const TESTBU_ALIAS = "@testbu/"
const ZENBU_ALIAS = "@zenbu/"

function resolveToFile(resolved) {
  if (path.extname(resolved)) return resolved
  if (fs.existsSync(resolved + ".ts")) return resolved + ".ts"
  if (fs.existsSync(path.join(resolved, "index.ts"))) return path.join(resolved, "index.ts")
  return resolved + ".ts"
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(TESTBU_ALIAS)) {
    const rest = specifier.slice(TESTBU_ALIAS.length)
    const filePath = resolveToFile(path.resolve(PACKAGES, rest))
    return { url: pathToFileURL(filePath).href, shortCircuit: true }
  }

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
