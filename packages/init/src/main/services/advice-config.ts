import { runtime } from "../runtime"
import type { RpcService } from "./rpc"

export interface ViewAdviceEntry {
  moduleId: string
  name: string
  type: "replace" | "before" | "after" | "around"
  modulePath: string
  exportName: string
}

const RESOLVED_PREFIX = "\0@advice-prelude/"
const adviceEntries = new Map<string, ViewAdviceEntry[]>()
const contentScripts = new Map<string, string[]>()

function invalidatePrelude(scope: string) {
  try {
    const reloader = runtime.get<any>({ key: "reloader" })
    const coreEntry = reloader.get("core")
    if (!coreEntry?.viteServer) return
    const graph = coreEntry.viteServer.moduleGraph
    if (scope === "*") {
      for (const s of getAllScopes()) {
        const mod = graph.getModuleById(RESOLVED_PREFIX + s)
        if (mod) graph.invalidateModule(mod)
      }
    } else {
      const mod = graph.getModuleById(RESOLVED_PREFIX + scope)
      if (mod) graph.invalidateModule(mod)
    }
  } catch {}
}

function emitReload(scope: string) {
  invalidatePrelude(scope)
  try {
    const rpc = runtime.get<RpcService>({ key: "rpc" })
    if (scope === "*") {
      for (const s of getAllScopes()) rpc.emit.advice.reload({ scope: s })
    } else {
      rpc.emit.advice.reload({ scope })
    }
  } catch {}
}

// --- Advice ---

export function registerAdvice(scope: string, entry: ViewAdviceEntry): () => void {
  const list = adviceEntries.get(scope) ?? []
  list.push(entry)
  adviceEntries.set(scope, list)
  emitReload(scope)

  return () => {
    const current = adviceEntries.get(scope)
    if (!current) return
    const idx = current.indexOf(entry)
    if (idx >= 0) current.splice(idx, 1)
    if (current.length === 0) adviceEntries.delete(scope)
    emitReload(scope)
  }
}

export function getAdvice(scope: string): ViewAdviceEntry[] {
  return adviceEntries.get(scope) ?? []
}

export function getAllAdviceScopes(): string[] {
  return [...adviceEntries.keys()]
}

// --- Content Scripts ---

export function registerContentScript(scope: string, modulePath: string): () => void {
  const list = contentScripts.get(scope) ?? []
  list.push(modulePath)
  contentScripts.set(scope, list)
  emitReload(scope === "*" ? "*" : scope)

  return () => {
    const current = contentScripts.get(scope)
    if (!current) return
    const idx = current.indexOf(modulePath)
    if (idx >= 0) current.splice(idx, 1)
    if (current.length === 0) contentScripts.delete(scope)
    emitReload(scope === "*" ? "*" : scope)
  }
}

export function getContentScripts(scope: string): string[] {
  const scoped = contentScripts.get(scope) ?? []
  const global = scope !== "*" ? (contentScripts.get("*") ?? []) : []
  return [...global, ...scoped]
}

export function getAllContentScriptPaths(): string[] {
  const paths: string[] = []
  for (const list of contentScripts.values()) paths.push(...list)
  return paths
}

export function getAllScopes(): string[] {
  const scopes = new Set<string>()
  for (const k of adviceEntries.keys()) scopes.add(k)
  for (const k of contentScripts.keys()) if (k !== "*") scopes.add(k)
  return [...scopes]
}
