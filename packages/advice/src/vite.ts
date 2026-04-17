import type { Plugin, TransformResult } from "vite"
import { transformSync } from "@babel/core"
import zenbuAdviceTransform from "./transform/index.js"

export interface ZenbuAdvicePluginOptions {
  root?: string
  include?: RegExp
  exclude?: RegExp
}

const defaultInclude = /\.[jt]sx?$/
const defaultExclude = /node_modules/

export function zenbuAdvicePlugin(options: ZenbuAdvicePluginOptions = {}): Plugin {
  let resolvedRoot: string

  return {
    name: "zenbu-advice",
    enforce: "pre",

    configResolved(config) {
      resolvedRoot = options.root ?? config.root
    },

    transform(code, id): TransformResult | null {
      const include = options.include ?? defaultInclude
      const exclude = options.exclude ?? defaultExclude

      if (!include.test(id)) return null
      if (exclude.test(id)) return null
      if (code.includes("applyAdviceChain") || code.includes("__zenbu_def")) return null

      const isTS = /\.tsx?$/.test(id)
      const parserPlugins: string[] = isTS ? ["typescript"] : []
      if (/\.(?:jsx|tsx)$/.test(id)) parserPlugins.push("jsx")

      const result = transformSync(code, {
        filename: id,
        plugins: [[zenbuAdviceTransform, { root: resolvedRoot }]],
        parserOpts: { plugins: parserPlugins as any },
        sourceMaps: true,
        configFile: false,
        babelrc: false,
      })

      if (!result?.code) return null

      return {
        code: result.code,
        map: result.map as any,
      }
    },
  }
}
