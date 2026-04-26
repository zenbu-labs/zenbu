import { nanoid } from "nanoid"
import { makeCollection } from "@zenbu/kyju/schema"
import { Service, runtime } from "../runtime"
import { DbService } from "./db"
import { AgentService } from "./agent"
import {
  insertHotAgent,
  validSelectionFromTemplate,
  type ArchivedAgent,
} from "../../../shared/agent-ops"

/**
 * Backs `rpc.kernel.promoteNewAgentTab`: replaces a `new-agent:<nanoid>`
 * sentinel tab in a window's pane with a freshly-created agent + session.
 *
 * The new-agent onboarding view (`views/new-agent`) is rendered into the
 * sentinel tab. When the user submits a message there, the renderer calls
 * this method to swap the sentinel for a real chat session in the same
 * pane slot, then sends the prompt over `rpc.agent.send`.
 */
export class NewAgentService extends Service {
  static key = "new-agent"
  static deps = { db: DbService, agent: AgentService }
  declare ctx: { db: DbService; agent: AgentService }

  async promoteNewAgentTab(args: {
    windowId: string
    sentinelTabId: string
    cwd?: string
  }): Promise<{ agentId: string; sessionId: string }> {
    const { windowId, sentinelTabId, cwd } = args
    const client = this.ctx.db.client
    const kernel = client.readRoot().plugin.kernel as any

    const configs = kernel.agentConfigs as any[]
    const selectedConfigId = kernel.selectedConfigId as string
    const selectedConfig =
      configs.find((c) => c.id === selectedConfigId) ?? configs[0]
    if (!selectedConfig) {
      throw new Error("[new-agent] no agentConfigs available")
    }

    const agentId = nanoid()
    const sessionId = nanoid()
    const seeded = validSelectionFromTemplate(selectedConfig)

    let evicted: ArchivedAgent[] = []
    await client.update((root: any) => {
      evicted = insertHotAgent(root.plugin.kernel, {
        id: agentId,
        name: selectedConfig.name,
        startCommand: selectedConfig.startCommand,
        configId: selectedConfig.id,
        metadata: cwd ? { cwd } : {},
        eventLog: makeCollection({
          collectionId: nanoid(),
          debugName: "eventLog",
        }),
        status: "idle",
        ...seeded,
        title: { kind: "not-available" },
        reloadMode: "keep-alive",
        sessionId: null,
        firstPromptSentAt: null,
        createdAt: Date.now(),
      })

      // Swap the sentinel tab id for the session id in the window's pane,
      // and add the session to the window's session list.
      const ws = root.plugin.kernel.windowStates.find(
        (w: any) => w.id === windowId,
      )
      if (!ws) return
      ws.sessions = [
        ...ws.sessions,
        { id: sessionId, agentId, lastViewedAt: null },
      ]
      const pane = ws.panes.find((p: any) =>
        (p.tabIds ?? []).includes(sentinelTabId),
      )
      if (!pane) return
      const idx = pane.tabIds.indexOf(sentinelTabId)
      if (idx < 0) return
      const next = [...pane.tabIds]
      next[idx] = sessionId
      pane.tabIds = next
      if (pane.activeTabId === sentinelTabId) pane.activeTabId = sessionId
    })

    if (evicted.length > 0) {
      await client.plugin.kernel.archivedAgents
        .concat(evicted)
        .catch(() => {})
    }

    // Spawn the ACP process. Async fire-and-forget so the renderer's
    // `rpc.agent.send` can eagerly enqueue without waiting on init — the
    // agent service queues until the process is ready.
    void this.ctx.agent
      .init(agentId)
      .catch((err) =>
        console.error("[new-agent] agent init failed:", err),
      )

    return { agentId, sessionId }
  }

  evaluate() {}
}

runtime.register(NewAgentService, (import.meta as any).hot)
