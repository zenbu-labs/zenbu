import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

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

function expandGlob(pattern) {
  const dir = path.dirname(pattern)
  const filePattern = path.basename(pattern)
  const regex = new RegExp("^" + filePattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$")
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => regex.test(f))
    .map(f => path.resolve(dir, f))
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

  for (const entry of entries) {
    const resolved = path.resolve(baseDir, entry)
    if (resolved.includes("*")) {
      watchPaths.add(path.dirname(resolved))
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
  }
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("zenbu:")) {
    return { url: specifier, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}

export function load(url, context, nextLoad) {
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
    const { source, watchPaths } = buildBarrel(manifestPath)
    if (context.hot && typeof context.hot.watch === "function") {
      for (const watchPath of watchPaths) {
        context.hot.watch(pathToFileURL(watchPath))
      }
    }
    console.log(`[zenbu-loader] generated barrel for ${path.basename(manifestPath)} (${source.split("\n").filter(Boolean).length} imports, ${watchPaths.size} watches)`)
    return { format: "module", source, shortCircuit: true }
  }
  return nextLoad(url, context)
}
