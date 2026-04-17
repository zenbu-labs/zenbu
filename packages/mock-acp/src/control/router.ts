import type { ClientProxy } from "@zenbu/kyju"
import type {
  MockAgentSchema,
  StreamingConfig,
  FuzzConfig,
  Scenario,
  ToolDefinition,
  McpServer,
  CannedResponse,
} from "../../shared/schema.ts"
import type { SimulationEngine } from "../simulation/engine.ts"
import { builtinScenarios } from "../simulation/scenarios.ts"

export function controlRouter(
  getEngine: () => SimulationEngine | null,
  db: ClientProxy<MockAgentSchema>,
) {
  const getRoot = async (): Promise<any> => db.readRoot()

  return {
    updateStreamingConfig: async (config: Partial<StreamingConfig>) => {
      const current = (await getRoot()).streamingConfig
      await db.streamingConfig.set({ ...current, ...config })
      return { ok: true }
    },

    getStreamingConfig: async () => {
      return (await getRoot()).streamingConfig
    },

    activateScenario: async (scenarioId: string) => {
      await db.activeScenarioId.set(scenarioId)
      return { ok: true }
    },

    listScenarios: async () => {
      const r = await getRoot()
      return {
        custom: r.scenarios,
        builtin: builtinScenarios,
        activeId: r.activeScenarioId,
      }
    },

    createScenario: async (scenario: Scenario) => {
      const r = await getRoot()
      await db.scenarios.set([...r.scenarios, scenario])
      return { ok: true }
    },

    deleteScenario: async (scenarioId: string) => {
      const r = await getRoot()
      await db.scenarios.set(r.scenarios.filter((s: any) => s.id !== scenarioId))
      if (r.activeScenarioId === scenarioId) {
        await db.activeScenarioId.set("")
      }
      return { ok: true }
    },

    setFuzzConfig: async (config: Partial<FuzzConfig>) => {
      const current = (await getRoot()).fuzzConfig
      await db.fuzzConfig.set({ ...current, ...config })
      return { ok: true }
    },

    getFuzzConfig: async () => {
      return (await getRoot()).fuzzConfig
    },

    addTool: async (tool: ToolDefinition) => {
      const r = await getRoot()
      await db.tools.set([...r.tools, tool])
      return { ok: true }
    },

    removeTool: async (toolName: string) => {
      const r = await getRoot()
      await db.tools.set(r.tools.filter((t: any) => t.name !== toolName))
      return { ok: true }
    },

    listTools: async () => {
      return (await getRoot()).tools
    },

    injectMcp: async (mcp: McpServer) => {
      const r = await getRoot()
      await db.mcpServers.set([...r.mcpServers, mcp])
      return { ok: true }
    },

    removeMcp: async (mcpName: string) => {
      const r = await getRoot()
      await db.mcpServers.set(r.mcpServers.filter((m: any) => m.name !== mcpName))
      return { ok: true }
    },

    listMcps: async () => {
      return (await getRoot()).mcpServers
    },

    getAgentState: async () => {
      const r = await getRoot()
      return {
        state: r.agentState,
        sessionId: r.currentSessionId,
        controlPort: r.controlPort,
      }
    },

    triggerPrompt: async (text: string) => {
      const engine = getEngine()
      if (!engine) return { ok: false, error: "Engine not initialized" }
      engine.handlePrompt({
        prompt: [{ type: "text", text }],
      })
      return { ok: true }
    },

    cancel: async () => {
      const engine = getEngine()
      engine?.cancel()
      return { ok: true }
    },

    setCannedResponses: async (responses: CannedResponse[]) => {
      await db.cannedResponses.set(responses)
      return { ok: true }
    },

    getCannedResponses: async () => {
      return (await getRoot()).cannedResponses
    },
  }
}

export type ControlRouter = ReturnType<typeof controlRouter>
