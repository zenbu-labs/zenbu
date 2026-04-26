import { runtime } from "../runtime"
import type { RpcService } from "./rpc"

export interface ViewAdviceEntry {
  moduleId: string
  name: string
  type: "replace" | "before" | "after" | "around"
  modulePath: string
  exportName: string
  workspaceId?: string
}

const RESOLVED_PREFIX = "\0@advice-prelude/"
const adviceEntries = new Map<string, ViewAdviceEntry[]>()
interface ContentScriptEntry { path: string; workspaceId?: string }
const contentScripts = new Map<string, ContentScriptEntry[]>()

function invalidatePrelude(scope: string) {
  try {
    const reloader = runtime.get<any>({ key: "reloader" })
    const coreEntry = reloader.get("core")
    if (!coreEntry?.viteServer) return
    const graph = coreEntry.viteServer.moduleGraph
    const invalidateScope = (s: string) => {
      const prefix = RESOLVED_PREFIX + s
      const ids: string[] = []
      for (const id of graph.idToModuleMap.keys()) {
        if (typeof id !== "string") continue
        if (id === prefix || id.startsWith(prefix + "?")) ids.push(id)
      }
      for (const id of ids) {
        const mod = graph.getModuleById(id)
        if (mod) graph.invalidateModule(mod)
      }
    }
    if (scope === "*") {
      for (const s of getAllScopes()) invalidateScope(s)
    } else {
      invalidateScope(scope)
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
  const ws = entry.workspaceId ?? runtime.getActiveScope?.() ?? undefined
  const tagged: ViewAdviceEntry = ws ? { ...entry, workspaceId: ws } : entry
  const list = adviceEntries.get(scope) ?? []
  list.push(tagged)
  adviceEntries.set(scope, list)
  emitReload(scope)

  return () => {
    const current = adviceEntries.get(scope)
    if (!current) return
    const idx = current.indexOf(tagged)
    if (idx >= 0) current.splice(idx, 1)
    if (current.length === 0) adviceEntries.delete(scope)
    emitReload(scope)
  }
}

export function getAdvice(scope: string, workspaceId?: string): ViewAdviceEntry[] {
  const entries = adviceEntries.get(scope) ?? []
  if (workspaceId === undefined) return entries
  return entries.filter(e => !e.workspaceId || e.workspaceId === workspaceId)
}

export function getAllAdviceScopes(): string[] {
  return [...adviceEntries.keys()]
}

// --- Content Scripts ---

export function registerContentScript(scope: string, modulePath: string): () => void {
  const ws = runtime.getActiveScope?.() ?? undefined
  const entry: ContentScriptEntry = ws ? { path: modulePath, workspaceId: ws } : { path: modulePath }
  const list = contentScripts.get(scope) ?? []
  list.push(entry)
  contentScripts.set(scope, list)
  emitReload(scope === "*" ? "*" : scope)

  return () => {
    const current = contentScripts.get(scope)
    if (!current) return
    const idx = current.indexOf(entry)
    if (idx >= 0) current.splice(idx, 1)
    if (current.length === 0) contentScripts.delete(scope)
    emitReload(scope === "*" ? "*" : scope)
  }
}

export function getContentScripts(scope: string, workspaceId?: string): string[] {
  const filter = (entries: ContentScriptEntry[]) =>
    workspaceId === undefined
      ? entries.map(e => e.path)
      : entries.filter(e => !e.workspaceId || e.workspaceId === workspaceId).map(e => e.path)

  const scoped = filter(contentScripts.get(scope) ?? [])
  const global = scope !== "*" ? filter(contentScripts.get("*") ?? []) : []
  return [...global, ...scoped]
}

export function getAllContentScriptPaths(): string[] {
  const paths: string[] = []
  for (const list of contentScripts.values()) {
    for (const entry of list) paths.push(entry.path)
  }
  return paths
}

export function getAllScopes(): string[] {
  const scopes = new Set<string>()
  for (const k of adviceEntries.keys()) scopes.add(k)
  for (const k of contentScripts.keys()) if (k !== "*") scopes.add(k)
  return [...scopes]
}
