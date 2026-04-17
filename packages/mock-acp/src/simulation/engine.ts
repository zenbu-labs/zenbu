import type * as acp from "@agentclientprotocol/sdk"
import { nanoid } from "nanoid"
import type { ClientProxy } from "@zenbu/kyju"
import type {
  MockAgentSchema,
  StreamingConfig,
  FuzzConfig,
  Scenario,
} from "../../shared/schema.ts"
import { streamChunksLive, sleep } from "./streaming.ts"
import { executeScenario, builtinScenarios } from "./scenarios.ts"

export type SimulationContext = {
  conn: acp.AgentSideConnection
  sessionId: string
  signal: AbortSignal
  db: ClientProxy<MockAgentSchema>
}

/** Read current streaming config + fuzz config from DB */
export async function readLiveConfig(db: ClientProxy<MockAgentSchema>): Promise<{ config: StreamingConfig; fuzz: FuzzConfig }> {
  const root = (await db.readRoot()) as any
  return {
    config: root.streamingConfig as StreamingConfig,
    fuzz: root.fuzzConfig as FuzzConfig,
  }
}

export async function streamMessage(
  ctx: SimulationContext,
  content: string,
): Promise<void> {
  await streamChunksLive(ctx, content, "agent_message_chunk")
}

export class SimulationEngine {
  private conn: acp.AgentSideConnection
  private db: ClientProxy<MockAgentSchema>
  private abortController: AbortController | null = null
  private currentSessionId: string = ""
  private onStatusChange: ((status: string) => void) | null = null

  constructor(conn: acp.AgentSideConnection, db: ClientProxy<MockAgentSchema>) {
    this.conn = conn
    this.db = db
  }

  setStatusCallback(cb: (status: string) => void) {
    this.onStatusChange = cb
  }

  createSession(cwd: string): string {
    this.currentSessionId = `mock_sess_${nanoid(12)}`
    this.db.currentSessionId.set(this.currentSessionId)
    console.error(`[engine] new session: ${this.currentSessionId} (cwd: ${cwd})`)
    return this.currentSessionId
  }

  loadSession(sessionId: string): void {
    this.currentSessionId = sessionId
    this.db.currentSessionId.set(sessionId)
    console.error(`[engine] loaded session: ${sessionId}`)
  }

  async handlePrompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
    this.abortController = new AbortController()
    const { signal } = this.abortController

    await this.db.agentState.set("prompting")
    this.onStatusChange?.("prompting")

    const promptText = params.prompt
      .map((block) => {
        if (block.type === "text") return block.text
        if (block.type === "resource" && "text" in block.resource)
          return block.resource.text
        return JSON.stringify(block)
      })
      .join("\n")

    await this.db.events.concat([
      {
        sessionId: this.currentSessionId,
        timestamp: Date.now(),
        direction: "received" as const,
        updateType: "user_prompt",
        data: { text: promptText },
      },
    ])

    try {
      const root = (await this.db.readRoot()) as any
      const fuzz = root.fuzzConfig as FuzzConfig

      const ctx: SimulationContext = {
        conn: this.conn,
        sessionId: this.currentSessionId,
        signal,
        db: this.db,
      }

      if (fuzz.enabled && Math.random() < fuzz.errorProbability) {
        throw new Error("Simulated fuzz error during prompt processing")
      }

      const scenario = this.findScenario(root)

      if (scenario) {
        await executeScenario(ctx, scenario)
      } else {
        await this.executeDefaultResponse(ctx, promptText, root)
      }

      await this.db.agentState.set("idle")
      this.onStatusChange?.("idle")
      return { stopReason: "end_turn" }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        await this.db.agentState.set("idle")
        this.onStatusChange?.("idle")
        return { stopReason: "cancelled" }
      }
      console.error("[engine] error during prompt:", err)
      await this.db.agentState.set("idle")
      this.onStatusChange?.("idle")
      return { stopReason: "end_turn" }
    }
  }

  cancel(): void {
    this.abortController?.abort()
    this.abortController = null
  }

  private findScenario(root: any): Scenario | undefined {
    if (root.activeScenarioId) {
      const found = root.scenarios.find(
        (s: Scenario) => s.id === root.activeScenarioId,
      )
      if (found) return found
      return builtinScenarios.find((s) => s.id === root.activeScenarioId)
    }
    return undefined
  }

  private async executeDefaultResponse(
    ctx: SimulationContext,
    promptText: string,
    root: any,
  ): Promise<void> {
    const cannedResponses = root.cannedResponses ?? []
    let responseText: string

    const lower = promptText.toLowerCase()
    if (lower.includes("hello") || lower.includes("hi")) {
      responseText =
        cannedResponses.find((r: any) => r.id === "hello")?.content ??
        "Hello! I'm the mock agent."
    } else if (lower.includes("review") || lower.includes("code")) {
      responseText =
        cannedResponses.find((r: any) => r.id === "code-review")?.content ??
        "I've reviewed the code. It looks good."
    } else if (lower.includes("long") || lower.includes("detail")) {
      responseText =
        cannedResponses.find((r: any) => r.id === "long-stream")?.content ??
        "Here's a detailed response."
    } else {
      responseText = `I received your message: "${promptText.slice(0, 100)}${promptText.length > 100 ? "..." : ""}"\n\nThis is a simulated response from the mock agent. You can configure scenarios, streaming speed, and other behaviors from the dashboard.`
    }

    await streamMessage(ctx, responseText)
  }
}
