import { createServer, type ViteDevServer, type Plugin } from "vite"
import { zenbuAdvicePlugin } from "@zenbu/advice/vite"
import { createHash } from "node:crypto"
import { dirname, join, resolve } from "node:path"
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { createServer as createNetServer } from "node:net"
import { homedir } from "node:os"
import { Service, runtime } from "../runtime"
import { getAdvice, getAllScopes, getContentScripts, getAllContentScriptPaths } from "./advice-config"
import type { ViewAdviceEntry } from "./advice-config"
import type { DbService } from "./db"
import { INTERNAL_DIR } from "../../../shared/paths"

const REACT_GRAB_TOOLBAR_VISIBLE = false

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const _require = createRequire(import.meta.url)
const adviceRuntimeEntry = resolve(__dirname, "../../../../advice/src/runtime/index.ts")
const kernelPackageRoot = resolve(__dirname, "../../..")

interface RendererServerOptions {
  id: string
  root: string
  port?: number
  configFile?: string | false
  cacheDir?: string
  plugins?: any[]
  reactPlugin?: () => any
  resolve?: any
}

function safeCacheSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "renderer"
}

function resolveRendererCacheDir(options: RendererServerOptions): string {
  const hash = createHash("sha256")
    .update(options.id)
    .update("\0")
    .update(resolve(options.root))
    .update("\0")
    .update(options.configFile ? resolve(options.configFile) : "no-config")
    .digest("hex")
    .slice(0, 12)

  return resolve(INTERNAL_DIR, "vite-cache", `${safeCacheSegment(options.id)}-${hash}`)
}

function rendererWarmupUrls(root: string): string[] {
  const urls = new Set<string>()
  if (existsSync(resolve(root, "main.tsx"))) {
    urls.add("/main.tsx")
  }

  const viewsDir = resolve(root, "views")
  try {
    for (const entry of readdirSync(viewsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (existsSync(resolve(viewsDir, entry.name, "main.tsx"))) {
        urls.add(`/views/${entry.name}/main.tsx`)
      }
    }
  } catch {}

  return [...urls]
}

async function warmupRendererEntrypoints(server: ViteDevServer, root: string): Promise<void> {
  try {
    await Promise.all(rendererWarmupUrls(root).map((url) => server.warmupRequest(url)))
    await server.waitForRequestsIdle()
  } catch (e) {
    console.warn("[reloader] renderer warmup failed:", e)
  }
}

function resolveReactGrabDir(root: string, configFile?: string | false): string | undefined {
  const searchPaths = [
    root,
    configFile ? dirname(configFile) : undefined,
    process.cwd(),
    kernelPackageRoot,
  ].filter((value): value is string => Boolean(value))

  try {
    const pkgJson = _require.resolve("react-grab/package.json", { paths: [...new Set(searchPaths)] })
    return dirname(pkgJson)
  } catch {
    return undefined
  }
}

function reactGrabPlugin(root: string, configFile?: string | false): Plugin {
  const pkgDir = resolveReactGrabDir(root, configFile)
  const SERVE_PATH = "/@react-grab-init.js"
  let cachedScript: string | null = null

  return {
    name: "zenbu-react-grab",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== SERVE_PATH || !pkgDir) return next()
        try {
          cachedScript ??= readFileSync(resolve(pkgDir, "dist/index.global.js"), "utf-8")
          res.setHeader("Content-Type", "application/javascript; charset=utf-8")
          res.setHeader("Cache-Control", "no-cache")
          res.end(cachedScript)
        } catch (e) {
          console.error("[react-grab] failed to serve:", e)
          next()
        }
      })
    },
    transformIndexHtml() {
      if (!pkgDir) return []
      return [
        {
          tag: "script",
          attrs: { src: SERVE_PATH },
          injectTo: "head" as const,
        },
        {
          tag: "script",
          children: REACT_GRAB_TOOLBAR_VISIBLE
              ? `if (window.__REACT_GRAB__?.setToolbarState) window.__REACT_GRAB__.setToolbarState({ collapsed: true, enabled: true, edge: "left", ratio: 0.95 })`
              : `if (window.__REACT_GRAB__?.setOptions) window.__REACT_GRAB__.setOptions({ theme: { toolbar: { enabled: false } } })`,
          injectTo: "head" as const,
        },
      ]
    },
  }
}

function resolveAdviceRuntime(): Plugin {
  return {
    name: "zenbu-resolve-advice-runtime",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "@zenbu/advice/runtime") {
        return adviceRuntimeEntry
      }
      if (importer && source.endsWith(".js")) {
        const tsPath = join(dirname(importer), source.replace(/\.js$/, ".ts"))
        try {
          const { statSync } = require("fs")
          if (statSync(tsPath).isFile()) return tsPath
        } catch {}
      }
      return null
    },
  }
}

function getAdviceEntries(scope: string, workspaceId?: string): ViewAdviceEntry[] {
  return getAdvice(scope, workspaceId)
}

function getScopeFromPath(urlPath: string): string | null {
  const viewMatch = urlPath.match(/^\/views\/([^/]+)\//)
  return viewMatch ? viewMatch[1] : null
}

function parsePreludeId(id: string): { scope: string; workspaceId?: string } {
  const rest = id.slice(RESOLVED_PREFIX.length)
  const queryIdx = rest.indexOf("?")
  if (queryIdx < 0) return { scope: rest }
  const scope = rest.slice(0, queryIdx)
  const params = new URLSearchParams(rest.slice(queryIdx + 1))
  const workspaceId = params.get("workspaceId") ?? undefined
  return { scope, workspaceId }
}

function extractWorkspaceIdFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const queryIdx = url.indexOf("?")
  if (queryIdx < 0) return undefined
  const params = new URLSearchParams(url.slice(queryIdx + 1))
  return params.get("workspaceId") ?? undefined
}

function generatePreludeCode(entries: ViewAdviceEntry[]): string {
  if (entries.length === 0) return ""
  const imports: string[] = ['import { replace, advise } from "@zenbu/advice/runtime"']
  const calls: string[] = []
  entries.forEach((entry, i) => {
    const alias = `__r${i}`
    imports.push(`import { ${entry.exportName} as ${alias} } from ${JSON.stringify(entry.modulePath)}`)
    if (entry.type === "replace") {
      calls.push(`replace(${JSON.stringify(entry.moduleId)}, ${JSON.stringify(entry.name)}, ${alias})`)
    } else {
      calls.push(`advise(${JSON.stringify(entry.moduleId)}, ${JSON.stringify(entry.name)}, ${JSON.stringify(entry.type)}, ${alias})`)
    }
  })
  return imports.join("\n") + "\n" + calls.join("\n") + "\n"
}

const PRELUDE_PREFIX = "/@advice-prelude/"
const RESOLVED_PREFIX = "\0@advice-prelude/"
const THEME_PREFIX = "/@zenbu-theme/"
const GLOBAL_THEME_PATH = resolve(homedir(), ".zenbu", "theme.css")

function advicePreludePlugin(): Plugin {
  return {
    name: "zenbu-advice-prelude",
    enforce: "pre",

    resolveId(source) {
      if (source.startsWith(PRELUDE_PREFIX)) {
        return RESOLVED_PREFIX + source.slice(PRELUDE_PREFIX.length)
      }
    },

    load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return null
      const { scope, workspaceId } = parsePreludeId(id)

      let code = generatePreludeCode(getAdviceEntries(scope, workspaceId))
      for (const scriptPath of getContentScripts(scope, workspaceId)) {
        code += `import ${JSON.stringify(scriptPath)}\n`
      }

      return code || "// no advice or content scripts"
    },

    handleHotUpdate({ file, server }) {
      let matched = false
      for (const scope of getAllScopes()) {
        for (const entry of getAdvice(scope)) {
          if (file === entry.modulePath) {
            matched = true
            break
          }
        }
        if (matched) break
      }
      if (!matched) {
        matched = getAllContentScriptPaths().includes(file)
      }
      if (matched) {
        server.ws.send({ type: "full-reload" })
        return []
      }
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ""
        if (!url.startsWith(PRELUDE_PREFIX)) return next()
        try {
          const result = await server.transformRequest(url)
          if (result) {
            res.statusCode = 200
            res.setHeader("Content-Type", "application/javascript")
            res.setHeader("Cache-Control", "no-cache")
            res.end(result.code)
            return
          }
        } catch (e) {
          console.error("[advice-prelude] transform error:", e)
        }
        next()
      })
    },

    transformIndexHtml(html, ctx) {
      const scope = getScopeFromPath(ctx.path ?? "")
      if (!scope) return html
      const workspaceId = extractWorkspaceIdFromUrl(ctx.originalUrl)
      const hasAdvice = getAdviceEntries(scope, workspaceId).length > 0
      const hasScripts = getContentScripts(scope, workspaceId).length > 0
      if (!hasAdvice && !hasScripts) return html

      const src = workspaceId
        ? `${PRELUDE_PREFIX}${scope}?workspaceId=${encodeURIComponent(workspaceId)}`
        : `${PRELUDE_PREFIX}${scope}`
      return [
        {
          tag: "script",
          attrs: { type: "module", src },
          injectTo: "head" as const,
        },
      ]
    },
  }
}

function readCssFile(filePath: string | null): string {
  if (!filePath) return ""
  try {
    if (!existsSync(filePath)) return ""
    return readFileSync(filePath, "utf-8")
  } catch (err) {
    console.error(`[theme] failed to read ${filePath}:`, err)
    return ""
  }
}

function resolveWorkspaceThemePath(workspaceId: string | undefined): string | null {
  if (!workspaceId) return null
  try {
    const db = runtime.get<DbService>({ key: "db" })
    const root = db.client.readRoot()
    const workspace = root.plugin.kernel.workspaces?.find(
      (w: { id: string }) => w.id === workspaceId,
    )
    for (const cwd of workspace?.cwds ?? []) {
      const themePath = resolve(cwd, ".zenbu", "theme.css")
      if (existsSync(themePath)) return themePath
    }
  } catch (err) {
    console.error("[theme] failed to resolve workspace theme:", err)
  }
  return null
}

function themeStylesheetPlugin(): Plugin {
  return {
    name: "zenbu-theme-stylesheets",
    enforce: "pre",

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ""
        if (!url.startsWith(THEME_PREFIX)) return next()

        const parsed = new URL(url, "http://localhost")
        let css = ""
        if (parsed.pathname === `${THEME_PREFIX}global.css`) {
          css = readCssFile(GLOBAL_THEME_PATH)
        } else if (parsed.pathname === `${THEME_PREFIX}workspace.css`) {
          const workspaceId = parsed.searchParams.get("workspaceId") ?? undefined
          css = readCssFile(resolveWorkspaceThemePath(workspaceId))
        } else {
          return next()
        }

        res.statusCode = 200
        res.setHeader("Content-Type", "text/css; charset=utf-8")
        res.setHeader("Cache-Control", "no-cache")
        res.end(css)
      })
    },

    transformIndexHtml(_html, ctx) {
      const tags = [
        {
          tag: "link",
          attrs: { rel: "stylesheet", href: `${THEME_PREFIX}global.css` },
          injectTo: "body" as const,
        },
      ]

      const workspaceId = extractWorkspaceIdFromUrl(ctx.originalUrl)
      if (workspaceId) {
        tags.push({
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: `${THEME_PREFIX}workspace.css?workspaceId=${encodeURIComponent(workspaceId)}`,
          },
          injectTo: "body" as const,
        })
      }

      return tags
    },
  }
}

function getEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer()
    srv.listen(0, () => {
      const { port } = srv.address() as { port: number }
      srv.close(() => resolve(port))
    })
    srv.on("error", reject)
  })
}

async function startRendererServer(options: RendererServerOptions): Promise<ViteDevServer> {
  const advicePlugins: any[] = [
    themeStylesheetPlugin(),
    advicePreludePlugin(),
    // reactGrabPlugin(options.root, options.configFile),
    resolveAdviceRuntime(),
    zenbuAdvicePlugin({
      root: options.root,
      include: new RegExp(`^${options.root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*\\.[jt]sx?$`),
    }),
  ]

  let server: ViteDevServer

  const port = options.port || await getEphemeralPort()
  const cacheDir = options.cacheDir ?? resolveRendererCacheDir(options)
  mkdirSync(cacheDir, { recursive: true })

  const sharedConfig = {
    cacheDir,
    server: {
      port,
      strictPort: true,
      hmr: { protocol: "ws", host: "localhost" } as const,
      fs: { strict: false },
    },
    logLevel: "warn" as const,
  }

  if (options.configFile) {
    server = await createServer({
      ...sharedConfig,
      root: options.root,
      plugins: advicePlugins,
      configFile: options.configFile,
    })
  } else {
    const plugins: any[] = [...advicePlugins]
    if (options.reactPlugin) {
      plugins.splice(1, 0, options.reactPlugin())
    } else {
      try {
        const react = await import("@vitejs/plugin-react")
        plugins.splice(1, 0, react.default())
      } catch {}
    }
    if (options.plugins) {
      plugins.push(...options.plugins)
    }

    server = await createServer({
      ...sharedConfig,
      root: options.root,
      plugins,
      resolve: options.resolve,
      configFile: false,
    })
  }

  await server.listen()

  const addr = server.httpServer?.address()
  const assignedPort = typeof addr === "object" && addr ? addr.port : 0
  if (assignedPort) {
    const hmr = server.config.server.hmr
    if (typeof hmr === "object") {
      ;(hmr as any).clientPort = assignedPort
    }
  }

  await warmupRendererEntrypoints(server, options.root)

  return server
}

export interface ReloaderEntry {
  id: string
  root: string
  url: string
  port: number
  viteServer: ViteDevServer
}

export class ReloaderService extends Service {
  static key = "reloader"
  static deps = {}

  private servers = new Map<string, ReloaderEntry>()

  async create(id: string, root: string, configFile?: string | false): Promise<ReloaderEntry> {
    if (this.servers.has(id)) return this.servers.get(id)!

    const viteServer = await startRendererServer({
      id,
      root,
      configFile: configFile ?? false,
      port: 0,
    })
    const address = viteServer.httpServer?.address()
    const port = typeof address === "object" && address ? address.port : 5173
    const entry: ReloaderEntry = { id, root, url: `http://localhost:${port}`, port, viteServer }
    this.servers.set(id, entry)
    console.log(`[reloader] ${id} ready at ${entry.url}`)
    return entry
  }

  get(id: string): ReloaderEntry | undefined {
    return this.servers.get(id)
  }

  async remove(id: string) {
    const entry = this.servers.get(id)
    if (entry) {
      await entry.viteServer.close()
      this.servers.delete(id)
    }
  }

  evaluate() {
    this.setup("vite-cleanup", () => {
      return async () => {
        // Close each server independently — a single throw must NOT
        // skip the rest, otherwise orphan chokidar+fsevents watchers
        // survive shutdown and trip `napi_call_function` in
        // `fse_dispatch_event` once the V8 isolate tears down. Use
        // `allSettled` so every server gets a close attempt and we can
        // log every failure individually.
        const entries = [...this.servers.values()]
        this.servers.clear()
        const results = await Promise.allSettled(
          entries.map((entry) => entry.viteServer.close()),
        )
        results.forEach((res, i) => {
          if (res.status === "rejected") {
            console.error(
              `[reloader] viteServer.close failed for ${entries[i].id}:`,
              res.reason,
            )
          }
        })
      }
    })

    console.log(`[reloader] service ready (${this.servers.size} servers)`)
  }
}

runtime.register(ReloaderService, (import.meta as any).hot)
