import fs from "node:fs"

export type Incompatible = {
  /** Plugin's declared `name` field, or the manifest directory basename if missing. */
  plugin: string
  /** Absolute path to the `zenbu.plugin.json` file. */
  manifestPath: string
  /** The raw `requiredVersion` string from the manifest. */
  required: string
  /** The current kernel version (from `app.getVersion()`). */
  current: string
}

// Minimal JSONC parser (strip // and /* */ comments + trailing commas), lifted
// from the same logic in `zenbu-loader-hooks.js`. Duplicated rather than
// imported because this module runs synchronously during the shell's cold
// path, before any async plugin-import work, and avoiding a second dynamic
// import keeps the hot path simple.
function parseJsonc(str: string): any {
  let result = ""
  let i = 0
  while (i < str.length) {
    if (str[i] === '"') {
      let j = i + 1
      while (j < str.length) {
        if (str[j] === "\\") j += 2
        else if (str[j] === '"') { j++; break }
        else j++
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

/**
 * Parse a version string "X.Y.Z" (with optional prerelease/build suffix,
 * which we ignore for comparison) into a 3-tuple of numbers.
 * Returns null if the input doesn't look like a semver.
 */
function parseVersion(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim())
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function cmp(a: [number, number, number], b: [number, number, number]): number {
  if (a[0] !== b[0]) return a[0] - b[0]
  if (a[1] !== b[1]) return a[1] - b[1]
  return a[2] - b[2]
}

/**
 * Tiny subset of semver range matching. Handles:
 *   "1.2.3"       → treated as a floor (>=1.2.3), not strict equality
 *   ">=1.2.3"     → current >= 1.2.3
 *   ">1.2.3"      → current > 1.2.3
 *   "<=1.2.3"     → current <= 1.2.3
 *   "<1.2.3"      → current < 1.2.3
 *   "1.2.3 - 2.0" → between (inclusive, space-separated by hyphen)
 *   ">=1 <2"      → AND-combined comparators (space-separated)
 *
 * Anything more exotic (|| OR, ~, ^, *, x-ranges) is out of scope for the
 * MVP. If the range can't be parsed, `satisfies` returns true so a
 * malformed manifest doesn't block boot.
 */
export function satisfies(current: string, range: string): boolean {
  const cur = parseVersion(current)
  if (!cur) return true // unknown current → can't compare, don't block

  const trimmed = range.trim()

  // Hyphen range: "1.2.3 - 2.0.0"
  const hyphen = /^(\S+)\s*-\s*(\S+)$/.exec(trimmed)
  if (hyphen) {
    const lo = parseVersion(hyphen[1]!)
    const hi = parseVersion(hyphen[2]!)
    if (!lo || !hi) return true
    return cmp(cur, lo) >= 0 && cmp(cur, hi) <= 0
  }

  // Space-separated AND comparators: ">=1.0 <2.0"
  const parts = trimmed.split(/\s+/).filter(Boolean)
  for (const part of parts) {
    const m = /^(>=|<=|>|<|=)?(\d+\.\d+\.\d+.*)$/.exec(part)
    if (!m) return true // unknown form → be permissive
    const op = m[1] || ">=" // bare version means >=
    const v = parseVersion(m[2]!)
    if (!v) return true
    const c = cmp(cur, v)
    if (op === ">=" && !(c >= 0)) return false
    if (op === "<=" && !(c <= 0)) return false
    if (op === ">" && !(c > 0)) return false
    if (op === "<" && !(c < 0)) return false
    if (op === "=" && c !== 0) return false
  }
  return true
}

/**
 * Read each plugin manifest and return the ones whose `requiredVersion` is
 * set and NOT satisfied by `currentVersion`. Empty list = all good.
 *
 * Manifests without the field (or that fail to parse) are treated as
 * compatible — absence of a requirement is not an incompatibility.
 */
export function checkPluginVersions(
  manifestPaths: string[],
  currentVersion: string,
): Incompatible[] {
  const out: Incompatible[] = []
  for (const manifestPath of manifestPaths) {
    let manifest: any
    try {
      manifest = parseJsonc(fs.readFileSync(manifestPath, "utf8"))
    } catch {
      continue
    }
    const required = manifest?.requiredVersion
    if (typeof required !== "string" || required.length === 0) continue
    if (satisfies(currentVersion, required)) continue
    const name =
      typeof manifest?.name === "string" && manifest.name.length > 0
        ? manifest.name
        : manifestPath.split("/").slice(-2, -1)[0] ?? manifestPath
    out.push({ plugin: name, manifestPath, required, current: currentVersion })
  }
  return out
}
