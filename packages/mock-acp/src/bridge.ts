import * as acp from "@agentclientprotocol/sdk"
import { Readable, Writable } from "node:stream"
import { SimulationEngine } from "./simulation/engine.ts"
import type { ControlServer } from "./control/server.ts"

export function createBridge(controlServer: ControlServer) {
  let engine: SimulationEngine | null = null

  class MockAcpAgent implements acp.Agent {
    private conn: acp.AgentSideConnection

    constructor(conn: acp.AgentSideConnection) {
      this.conn = conn
    }

    async initialize(
      _params: acp.InitializeRequest,
    ): Promise<acp.InitializeResponse> {
      engine = new SimulationEngine(this.conn, controlServer.db)
      controlServer.setEngine(engine)

      // Wire up daemon status reporting if registration exists
      const reg = (controlServer as any)._registration
      if (reg) {
        engine.setStatusCallback((status) => reg.updateStatus(status))
      }

      return {
        protocolVersion: acp.PROTOCOL_VERSION,
        agentCapabilities: {
          loadSession: true,
          promptCapabilities: { embeddedContext: true },
        },
        agentInfo: {
          name: "mock-acp",
          title: "Mock Agent (ACP)",
          version: "0.0.1",
        },
      }
    }

    async newSession(
      params: acp.NewSessionRequest,
    ): Promise<acp.NewSessionResponse> {
      const sessionId = engine!.createSession(params.cwd ?? process.cwd())

      return {
        sessionId,
        configOptions: [
          {
            id: "model",
            name: "Model",
            category: "model",
            type: "select",
            currentValue: "mock-fast",
            options: [
              { value: "mock-fast", name: "Mock Fast" },
              { value: "mock-slow", name: "Mock Slow" },
              { value: "mock-error", name: "Mock Error-Prone" },
            ],
          },
          {
            id: "reasoning_effort",
            name: "Thinking",
            category: "thought_level",
            type: "select",
            currentValue: "medium",
            options: [
              { value: "low", name: "Low" },
              { value: "medium", name: "Medium" },
              { value: "high", name: "High" },
            ],
          },
        ],
      }
    }

    async loadSession(
      params: acp.LoadSessionRequest,
    ): Promise<acp.LoadSessionResponse> {
      engine!.loadSession(params.sessionId)
      return undefined as unknown as acp.LoadSessionResponse
    }

    async prompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
      if (!engine) throw new Error("Not initialized")
      return engine.handlePrompt(params)
    }

    async cancel(): Promise<void> {
      engine?.cancel()
    }

    async authenticate(): Promise<acp.AuthenticateResponse> {
      return {}
    }

    async setSessionMode(): Promise<acp.SetSessionModeResponse> {
      return {}
    }

    async setSessionConfigOption(
      params: acp.SetSessionConfigOptionRequest,
    ): Promise<acp.SetSessionConfigOptionResponse> {
      const configId = params.configId
      const value = "value" in params ? String(params.value) : ""
      if (configId === "model" && value === "mock-slow") {
        await controlServer.db.streamingConfig.set({
          ...(await controlServer.db.readRoot()).streamingConfig,
          charsPerSecond: 30,
          chunkSize: 2,
        })
      } else if (configId === "model" && value === "mock-fast") {
        await controlServer.db.streamingConfig.set({
          ...(await controlServer.db.readRoot()).streamingConfig,
          charsPerSecond: 200,
          chunkSize: 8,
        })
      } else if (configId === "model" && value === "mock-error") {
        await controlServer.db.fuzzConfig.set({
          ...(await controlServer.db.readRoot()).fuzzConfig,
          enabled: true,
          errorProbability: 0.3,
          dropChunkProbability: 0.1,
        })
      }
      return { configOptions: [] }
    }
  }

  const input = Writable.toWeb(process.stdout) as unknown as WritableStream<Uint8Array>
  const output = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>
  const stream = acp.ndJsonStream(input, output)

  new acp.AgentSideConnection((conn) => new MockAcpAgent(conn), stream)

  return {
    close() {
      engine?.cancel()
    },
  }
}
