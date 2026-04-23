import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { subscribe } from "@parcel/watcher"
import { registerWatcherClosable } from "dynohot/pause"

// ----- Telemetry -----
//
// The kernel passes a `MessagePort` via `register()`'s data so we can report
// how much time is spent in this loader's hooks. Accumulate locally; the
// kernel sends a `"flush"` message at the end of boot and we respond with
// totals. Everything is best-effort — if no port was provided (e.g. the
// loader is used from a non-kernel context) the wrappers are no-ops.
const LOADER_NAME = "zenbu-loader"
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

function parseJsonc(str) {
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

function globRegex(filePattern) {
  return new RegExp("^" + filePattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$")
}

function expandGlob(pattern) {
  const dir = path.dirname(pattern)
  const regex = globRegex(path.basename(pattern))
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => regex.test(f))
    .map(f => path.resolve(dir, f))
}

// Barrel URL -> { hot, globs: [{dir, regex, snapshot: Set<string>}] }
const barrels = new Map()
// Directory -> Closable (one subscription per directory, fanned out to barrels)
const dirWatchers = new Map()

function snapshotDir(dir, regex) {
  if (!fs.existsSync(dir)) return new Set()
  try {
    return new Set(fs.readdirSync(dir).filter(f => regex.test(f)))
  } catch {
    return new Set()
  }
}

function handleDirEvent(dir, filename) {
  for (const entry of barrels.values()) {
    for (const glob of entry.globs) {
      if (glob.dir !== dir) continue
      if (!glob.regex.test(filename)) continue
      const nextSnapshot = snapshotDir(dir, glob.regex)
      const changed =
        nextSnapshot.size !== glob.snapshot.size ||
        [...nextSnapshot].some(f => !glob.snapshot.has(f))
      if (!changed) continue
      glob.snapshot = nextSnapshot
      try {
        entry.hot?.invalidate?.()
        console.log(`[zenbu-loader] invalidated barrel (${filename} added/removed in ${dir})`)
      } catch (err) {
        console.error("[zenbu-loader] invalidate failed:", err)
      }
      break
    }
  }
}

// Node's fs.watch drops rename-replace events on macOS (git pull,
// atomic editor saves) — see dynohot/runtime/watcher.ts for full
// context. @parcel/watcher is the same native FSEvents wrapper VSCode
// uses and handles those cases cleanly.
function ensureDirWatcher(dir) {
  if (dirWatchers.has(dir)) return
  if (!fs.existsSync(dir)) return
  let subscription = null
  let closed = false
  subscribe(dir, (err, events) => {
    if (err) return
    for (const event of events) {
      // `subscribe` is recursive; only act on direct children of
      // `dir` so semantics match the previous fs.watch(dir) usage.
      if (path.dirname(event.path) !== dir) continue
      handleDirEvent(dir, path.basename(event.path))
    }
  }).then(sub => {
    if (closed) void sub.unsubscribe().catch(() => {})
    else subscription = sub
  }).catch(err => {
    console.error(`[zenbu-loader] subscribe failed for ${dir}:`, err)
  })
  const closable = {
    close: () => {
      closed = true
      if (subscription) return subscription.unsubscribe().catch(() => {})
    },
  }
  // Track for process-wide shutdown so the native watcher tears down
  // before the V8 isolate dies on app.quit(). See dynohot/pause.
  registerWatcherClosable(closable)
  dirWatchers.set(dir, closable)
}

function buildSource(imports) {
  return imports.map(specifier => `import ${JSON.stringify(specifier)}\n`).join("")
}

function readPluginList(configPath) {
  const raw = fs.readFileSync(configPath, "utf8")
  const config = parseJsonc(raw)
  if (!config || typeof config !== "object" || !Array.isArray(config.plugins)) {
    return []
  }
  return Array.from(new Set(config.plugins.filter(p => typeof p === "string")))
}

function buildPluginRoot(configPath) {
  const imports = readPluginList(configPath)
    .map(manifestPath => `zenbu:barrel?manifest=${encodeURIComponent(path.resolve(manifestPath))}`)

  return {
    source: buildSource(imports) + "import.meta.hot?.accept()\n",
    watchPaths: new Set([configPath]),
  }
}

function buildBarrel(manifestPath) {
  const raw = fs.readFileSync(manifestPath, "utf8")
  const manifest = parseJsonc(raw)
  const baseDir = path.dirname(manifestPath)
  const entries = manifest.services ?? []
  const imports = []
  const watchPaths = new Set([manifestPath])
  const globs = []

  for (const entry of entries) {
    const resolved = path.resolve(baseDir, entry)
    if (resolved.includes("*")) {
      const dir = path.dirname(resolved)
      const regex = globRegex(path.basename(resolved))
      watchPaths.add(dir)
      globs.push({ dir, regex, snapshot: snapshotDir(dir, regex) })
      for (const file of expandGlob(resolved)) {
        imports.push(pathToFileURL(file).href)
      }
    } else if (resolved.endsWith(".json") || resolved.endsWith(".jsonc")) {
      imports.push(`zenbu:barrel?manifest=${encodeURIComponent(resolved)}`)
    } else {
      imports.push(pathToFileURL(resolved).href)
    }
  }

  return {
    source: buildSource(imports) + "import.meta.hot?.accept()\n",
    watchPaths,
    globs,
  }
}

export function resolve(specifier, context, nextResolve) {
  const start = Date.now()
  try {
    if (specifier.startsWith("zenbu:")) {
      return { url: specifier, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  } finally {
    stats.resolveCount++
    stats.resolveMs += Date.now() - start
  }
}

function loadImpl(url, context, nextLoad) {
  if (url.startsWith("zenbu:plugins?")) {
    const params = new URL(url).searchParams
    const configPath = decodeURIComponent(params.get("config"))
    const { source, watchPaths } = buildPluginRoot(configPath)
    if (context.hot && typeof context.hot.watch === "function") {
      for (const watchPath of watchPaths) {
        context.hot.watch(pathToFileURL(watchPath))
      }
    }
    console.log(`[zenbu-loader] generated plugin root for ${path.basename(configPath)} (${source.split("\n").filter(Boolean).length} imports, ${watchPaths.size} watches)`)
    return { format: "module", source, shortCircuit: true }
  }

  if (url.startsWith("zenbu:barrel?")) {
    const params = new URL(url).searchParams
    const manifestPath = decodeURIComponent(params.get("manifest"))
    const { source, watchPaths, globs } = buildBarrel(manifestPath)
    if (context.hot && typeof context.hot.watch === "function") {
      for (const watchPath of watchPaths) {
        context.hot.watch(pathToFileURL(watchPath))
      }
    }
    if (context.hot) {
      barrels.set(url, { hot: context.hot, globs })
      for (const glob of globs) {
        ensureDirWatcher(glob.dir)
      }
    }
    console.log(`[zenbu-loader] generated barrel for ${path.basename(manifestPath)} (${source.split("\n").filter(Boolean).length} imports, ${watchPaths.size} watches, ${globs.length} globs)`)
    return { format: "module", source, shortCircuit: true }
  }
  return nextLoad(url, context)
}

export function load(url, context, nextLoad) {
  const start = Date.now()
  try { fs.appendFileSync(path.join(os.tmpdir(), "zenbu-loaded-urls.txt"), url + "\n") } catch {}
  try {
    return loadImpl(url, context, nextLoad)
  } finally {
    stats.loadCount++
    stats.loadMs += Date.now() - start
  }
}
