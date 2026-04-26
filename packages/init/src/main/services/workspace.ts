import fs from "node:fs"
import path from "node:path"
import { nanoid } from "nanoid"
import * as Effect from "effect/Effect"
import { Service, runtime } from "../runtime"
import { DbService } from "./db"
import { WorkspaceContextService } from "./workspace-context"

function parseJsonc(str: string): unknown {
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

function resolveWorkspaceConfigPath(zenbuDir: string): string | null {
  const jsonc = path.join(zenbuDir, "config.jsonc")
  try {
    if (fs.statSync(jsonc).isFile()) return jsonc
  } catch {}
  const json = path.join(zenbuDir, "config.json")
  try {
    if (fs.statSync(json).isFile()) return json
  } catch {}
  return null
}

export class WorkspaceService extends Service {
  static key = "workspace"
  static deps = { db: DbService }
  declare ctx: { db: DbService }

  private loadedWorkspacePlugins = new Map<string, string[]>()

  async createWorkspace(
    name: string,
    cwds: string[],
  ): Promise<{ id: string }> {
    const id = nanoid()
    const now = Date.now()
    const client = this.ctx.db.effectClient
    await Effect.runPromise(
      client.update((root) => {
        root.plugin.kernel.workspaces = [
          ...(root.plugin.kernel.workspaces ?? []),
          { id, name, cwds, createdAt: now, icon: null },
        ]
      }),
    )
    console.log(`[workspace] created "${name}" (${id}) with ${cwds.length} cwd(s)`)
    this.ensureWorkspaceIcon(id).catch(() => {})
    await this.loadWorkspacePlugins(id, cwds)
    return { id }
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.stopWorkspacePlugins(id)
    const client = this.ctx.db.effectClient
    await Effect.runPromise(
      client.update((root) => {
        root.plugin.kernel.workspaces = (root.plugin.kernel.workspaces ?? []).filter(
          (w) => w.id !== id,
        )
        const active = root.plugin.kernel.activeWorkspaceByWindow ?? {}
        const nextActive: Record<string, string> = {}
        for (const [wid, wsId] of Object.entries(active)) {
          if (wsId !== id) nextActive[wid] = wsId as string
        }
        root.plugin.kernel.activeWorkspaceByWindow = nextActive
      }),
    )
    console.log(`[workspace] deleted ${id}`)
  }

  async updateWorkspace(
    id: string,
    updates: { name?: string; cwds?: string[] },
  ): Promise<void> {
    const client = this.ctx.db.effectClient
    await Effect.runPromise(
      client.update((root) => {
        const ws = (root.plugin.kernel.workspaces ?? []).find(
          (w) => w.id === id,
        )
        if (!ws) return
        if (updates.name !== undefined) ws.name = updates.name
        if (updates.cwds !== undefined) ws.cwds = updates.cwds
      }),
    )
  }

  async activateWorkspace(
    windowId: string,
    workspaceId: string,
  ): Promise<void> {
    const client = this.ctx.db.effectClient
    const root = this.ctx.db.client.readRoot()
    const prevId = root.plugin.kernel.activeWorkspaceByWindow?.[windowId]

    if (prevId && prevId !== workspaceId) {
      const prevCtx = this.getWorkspaceContext(prevId)
      if (prevCtx) {
        await prevCtx.fireDeactivated(windowId)
      }
    }

    await Effect.runPromise(
      client.update((root) => {
        root.plugin.kernel.activeWorkspaceByWindow = {
          ...(root.plugin.kernel.activeWorkspaceByWindow ?? {}),
          [windowId]: workspaceId,
        }

        const ws = (root.plugin.kernel.windowStates ?? []).find(
          (w) => w.id === windowId,
        )
        if (!ws || !ws.rootPaneId) return
        const pane = (ws.panes ?? []).find((p) => p.id === ws.rootPaneId)
        if (!pane || pane.type !== "leaf") return

        const workspace = (root.plugin.kernel.workspaces ?? []).find(
          (w) => w.id === workspaceId,
        )
        const cwds = new Set<string>(workspace?.cwds ?? [])
        const sessions = ws.sessions ?? []
        const agents = root.plugin.kernel.agents ?? []

        const tabMatchesWorkspace = (tabId: string): boolean => {
          if (tabId.startsWith("new-agent:") || tabId.startsWith("scope:")) {
            return false
          }
          const session = sessions.find((s) => s.id === tabId)
          if (!session) return false
          const agent = agents.find((a) => a.id === session.agentId)
          const cwd =
            typeof agent?.metadata?.cwd === "string"
              ? agent.metadata.cwd
              : ""
          return cwd === "" || cwds.has(cwd)
        }

        const lastTab =
          root.plugin.kernel.lastTabByWorkspace?.[workspaceId]

        let target: string | undefined
        if (
          lastTab &&
          pane.tabIds.includes(lastTab) &&
          tabMatchesWorkspace(lastTab)
        ) {
          target = lastTab
        } else {
          for (let i = pane.tabIds.length - 1; i >= 0; i--) {
            if (tabMatchesWorkspace(pane.tabIds[i])) {
              target = pane.tabIds[i]
              break
            }
          }
        }

        if (target && target !== pane.activeTabId) {
          pane.activeTabId = target
        }
      }),
    )

    await this.loadWorkspacePlugins(workspaceId,
      (root.plugin.kernel.workspaces ?? []).find((w) => w.id === workspaceId)?.cwds ?? [],
    )

    const newCtx = this.getWorkspaceContext(workspaceId)
    if (newCtx) {
      await newCtx.fireActivated(windowId)
    }

    console.log(
      `[workspace] activated ${workspaceId} in window ${windowId}`,
    )
  }

  async deactivateWorkspace(windowId: string): Promise<void> {
    const root = this.ctx.db.client.readRoot()
    const prevId = root.plugin.kernel.activeWorkspaceByWindow?.[windowId]

    if (prevId) {
      const prevCtx = this.getWorkspaceContext(prevId)
      if (prevCtx) {
        await prevCtx.fireDeactivated(windowId)
      }
    }

    const client = this.ctx.db.effectClient
    await Effect.runPromise(
      client.update((root) => {
        const active = { ...(root.plugin.kernel.activeWorkspaceByWindow ?? {}) }
        delete active[windowId]
        root.plugin.kernel.activeWorkspaceByWindow = active
      }),
    )
  }

  scanWorkspacePlugins(cwds: string[]): string[] {
    const manifests: string[] = []
    const seen = new Set<string>()
    const push = (p: string) => {
      const abs = path.resolve(p)
      if (!seen.has(abs)) {
        seen.add(abs)
        manifests.push(abs)
      }
    }
    for (const cwd of cwds) {
      const zenbuDir = path.join(cwd, ".zenbu")
      const configPath = resolveWorkspaceConfigPath(zenbuDir)
      if (!configPath) continue

      try {
        const raw = fs.readFileSync(configPath, "utf8")
        const config = parseJsonc(raw)
        if (!config || typeof config !== "object") continue
        const plugins = (config as any).plugins
        if (!Array.isArray(plugins)) continue
        for (const entry of plugins) {
          if (typeof entry !== "string") continue
          push(path.resolve(zenbuDir, entry))
        }
      } catch {}
    }
    return manifests
  }

  private async loadWorkspacePlugins(
    workspaceId: string,
    cwds: string[],
  ): Promise<void> {
    if (this.loadedWorkspacePlugins.has(workspaceId)) return

    const manifests = this.scanWorkspacePlugins(cwds)

    await runtime.scopedImport(workspaceId, async () => {
      runtime.register(WorkspaceContextService)
    })
    await runtime.whenIdle()

    const ctxSlot = runtime.getSlot(`workspace-context@@${workspaceId}`)
    if (ctxSlot?.instance) {
      const ctx = ctxSlot.instance as WorkspaceContextService
      ctx.workspaceId = workspaceId
      ctx.cwds = cwds
    }

    if (manifests.length === 0) {
      this.loadedWorkspacePlugins.set(workspaceId, [])
      return
    }

    const loadedKeys: string[] = []
    for (const manifestPath of manifests) {
      try {
        const url = `zenbu:barrel?manifest=${encodeURIComponent(manifestPath)}`
        await runtime.scopedImport(workspaceId, () => import(url))
        console.log(
          `[workspace] loaded plugins from ${manifestPath} for workspace ${workspaceId}`,
        )
      } catch (err) {
        console.error(
          `[workspace] failed to load ${manifestPath}:`,
          err,
        )
      }
    }

    await runtime.whenIdle()
    loadedKeys.push(...manifests)
    this.loadedWorkspacePlugins.set(workspaceId, loadedKeys)
    console.log(
      `[workspace] ${loadedKeys.length} plugin manifest(s) loaded for workspace ${workspaceId}`,
    )
  }

  private async stopWorkspacePlugins(workspaceId: string): Promise<void> {
    const keys = this.loadedWorkspacePlugins.get(workspaceId)
    if (!keys) {
      this.loadedWorkspacePlugins.delete(workspaceId)
      return
    }

    await runtime.unregisterByWorkspace(workspaceId)
    this.loadedWorkspacePlugins.delete(workspaceId)
    console.log(
      `[workspace] stopped ${keys.length} plugin manifest(s) for workspace ${workspaceId}`,
    )
  }

  private getWorkspaceContext(workspaceId: string): WorkspaceContextService | null {
    const slot = runtime.getSlot(`workspace-context@@${workspaceId}`)
    if (slot?.status === "ready" && slot.instance) {
      return slot.instance as WorkspaceContextService
    }
    return null
  }

  async setWorkspaceIcon(
    workspaceId: string,
    blobId: string,
    origin: "override" | "scanned",
    sourcePath: string | null = null,
  ): Promise<void> {
    const client = this.ctx.db.effectClient
    await Effect.runPromise(
      client.update((root) => {
        const ws = (root.plugin.kernel.workspaces ?? []).find(
          (w) => w.id === workspaceId,
        )
        if (!ws) return
        ws.icon = { blobId, origin, sourcePath }
      }),
    )
  }

  async ensureWorkspaceIcon(workspaceId: string): Promise<string | null> {
    const client = this.ctx.db.client
    const root = client.readRoot()
    const ws = (root.plugin.kernel.workspaces ?? []).find(
      (w) => w.id === workspaceId,
    )
    if (!ws) return null
    if (ws.icon?.blobId) return ws.icon.blobId

    for (const cwd of ws.cwds) {
      const hit = scanIcon(cwd)
      if (!hit) continue
      let data: Uint8Array
      try {
        data = new Uint8Array(fs.readFileSync(hit.path))
      } catch {
        continue
      }
      const blobId = await client.createBlob(data, true)
      await this.setWorkspaceIcon(workspaceId, blobId, "scanned", hit.path)
      return blobId
    }
    return null
  }

  evaluate() {
    this.setup("workspace-cleanup", () => {
      return async () => {
        for (const workspaceId of this.loadedWorkspacePlugins.keys()) {
          await this.stopWorkspacePlugins(workspaceId)
        }
      }
    })

    this.setup("eager-load", () => {
      const root = this.ctx.db.client.readRoot()
      const workspaces = root.plugin.kernel.workspaces ?? []
      for (const ws of workspaces) {
        this.loadWorkspacePlugins(ws.id, ws.cwds).catch((err) => {
          console.error(`[workspace] eager load failed for ${ws.id}:`, err)
        })
      }
    })
  }
}

const ICON_CANDIDATES = [
  "app/icon.svg",
  "app/icon.png",
  "app/favicon.ico",
  "public/icon.svg",
  "public/logo.svg",
  "public/icon.png",
  "public/logo.png",
  "public/favicon.svg",
  "public/favicon.ico",
  "static/icon.svg",
  "static/logo.svg",
  "static/icon.png",
  "static/favicon.svg",
  "static/favicon.ico",
  "assets/icon.svg",
  "assets/icon.png",
  "assets/logo.svg",
  "assets/logo.png",
  "build/icon.png",
  "build/icons/icon.png",
  "icon.svg",
  "icon.png",
  "logo.svg",
  "logo.png",
  "favicon.svg",
  "favicon.ico",
]

function scanIcon(cwd: string): { path: string } | null {
  for (const rel of ICON_CANDIDATES) {
    const abs = path.join(cwd, rel)
    try {
      if (fs.statSync(abs).isFile()) return { path: abs }
    } catch {}
  }
  return null
}

runtime.register(WorkspaceService, (import.meta as any).hot)
