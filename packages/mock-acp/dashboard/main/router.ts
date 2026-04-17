import { Effect } from "effect"
import { MockAgentConnectionService } from "./services/mock-agent-connection"
import type {
  StreamingConfig,
  FuzzConfig,
  Scenario,
  ToolDefinition,
  McpServer,
  CannedResponse,
} from "../../shared/schema"

export const router = {
  // ─── Daemon / Registry ──────────────────────────────────
  listRegisteredAgents: () =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      return yield* Effect.promise(() => conn.listRegisteredAgents())
    }),

  connectToAgent: (agentId: string) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      yield* Effect.promise(() => conn.connectToAgent(agentId))
      return { ok: true }
    }),

  connectToDaemon: () =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      yield* Effect.promise(() => conn.connectToDaemon())
      return { ok: true }
    }),

  // ─── Direct agent connection ────────────────────────────
  connectToMockAgent: (url: string) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      yield* Effect.promise(() => conn.connect(url))
      return { ok: true }
    }),

  getMockAgentStatus: () =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.connected || !conn.rpc) {
        return { connected: false, state: null, sessionId: null, controlPort: null }
      }
      const state = yield* Effect.promise(() => conn.rpc!.getAgentState())
      return { connected: true, ...state }
    }),

  updateStreamingConfig: (config: Partial<StreamingConfig>) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.updateStreamingConfig(config))
    }),

  getStreamingConfig: () =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.getStreamingConfig())
    }),

  activateScenario: (scenarioId: string) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.activateScenario(scenarioId))
    }),

  listScenarios: () =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.listScenarios())
    }),

  createScenario: (scenario: Scenario) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.createScenario(scenario))
    }),

  deleteScenario: (scenarioId: string) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.deleteScenario(scenarioId))
    }),

  setFuzzConfig: (config: Partial<FuzzConfig>) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.setFuzzConfig(config))
    }),

  getFuzzConfig: () =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.getFuzzConfig())
    }),

  cancel: () =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.cancel())
    }),

  addTool: (tool: ToolDefinition) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.addTool(tool))
    }),

  removeTool: (toolName: string) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.removeTool(toolName))
    }),

  injectMcp: (mcp: McpServer) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.injectMcp(mcp))
    }),

  removeMcp: (mcpName: string) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.removeMcp(mcpName))
    }),

  getCannedResponses: () =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.getCannedResponses())
    }),

  setCannedResponses: (responses: CannedResponse[]) =>
    Effect.gen(function* () {
      const conn = yield* MockAgentConnectionService
      if (!conn.rpc) throw new Error("Not connected to mock agent")
      return yield* Effect.promise(() => conn.rpc!.setCannedResponses(responses))
    }),
}

export type ServerRouter = typeof router
