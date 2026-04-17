import { transformSync } from "@babel/core"
import zenbuAdviceTransform from "./transform/index.js"
import { fileURLToPath } from "node:url"

const includeRe = /\.[jt]sx?$/
const excludeRe = /node_modules|packages\/advice\//
const rootDir = process.cwd().replace(/\\/g, "/").replace(/\/$/, "")

interface ResolveContext {
  conditions: string[]
  importAttributes: Record<string, string>
  parentURL?: string
}

interface LoadContext {
  conditions: string[]
  importAttributes: Record<string, string>
  format?: string
}

type NextResolve = (specifier: string, context: ResolveContext) => Promise<{ url: string; format?: string }>
type NextLoad = (url: string, context: LoadContext) => Promise<{ source: string | ArrayBuffer; format: string }>

export async function load(
  url: string,
  context: LoadContext,
  nextLoad: NextLoad
): Promise<{ source: string | ArrayBuffer; format: string; shortCircuit?: boolean }> {
  if (!url.startsWith("file://")) return nextLoad(url, context)

  const filePath = fileURLToPath(url)
  const normalizedPath = filePath.replace(/\\/g, "/")
  const inRoot = normalizedPath === rootDir || normalizedPath.startsWith(rootDir + "/")
  if (!inRoot || !includeRe.test(filePath) || excludeRe.test(filePath)) {
    return nextLoad(url, context)
  }

  const loaded = await nextLoad(url, context)
  const source = typeof loaded.source === "string"
    ? loaded.source
    : new TextDecoder().decode(loaded.source)

  const isTS = /\.tsx?$/.test(filePath)
  const parserPlugins: string[] = isTS ? ["typescript"] : []
  if (/\.[jt]sx$/.test(filePath)) parserPlugins.push("jsx")

  const result = transformSync(source, {
    filename: filePath,
    plugins: [[zenbuAdviceTransform, { root: rootDir }]],
    parserOpts: { plugins: parserPlugins as any },
    sourceMaps: "inline",
    configFile: false,
    babelrc: false,
  })

  if (!result?.code) return loaded

  return {
    source: result.code,
    format: loaded.format,
    shortCircuit: true,
  }
}
