import zod from "zod"
import { createSchema, f, type InferSchema } from "@zenbu/kyju/schema"

export const streamingConfigSchema = zod.object({
  charsPerSecond: zod.number(),
  chunkSize: zod.number(),
  tokensPerSecond: zod.number(),
  thinkingDelayMs: zod.number(),
  toolCallDelayMs: zod.number(),
  interChunkJitter: zod.number(),
})

export type StreamingConfig = zod.infer<typeof streamingConfigSchema>

export const toolDefinitionSchema = zod.object({
  name: zod.string(),
  kind: zod.enum(["read", "edit", "execute", "search", "other"]),
  title: zod.string(),
  outputTemplate: zod.string(),
  durationMs: zod.number(),
  requiresPermission: zod.boolean(),
})

export type ToolDefinition = zod.infer<typeof toolDefinitionSchema>

export const scenarioStepSchema = zod.discriminatedUnion("type", [
  zod.object({
    type: zod.literal("thinking"),
    content: zod.string(),
  }),
  zod.object({
    type: zod.literal("message"),
    content: zod.string(),
  }),
  zod.object({
    type: zod.literal("tool_call"),
    toolName: zod.string(),
    title: zod.string(),
    kind: zod.enum(["read", "edit", "execute", "search", "other"]),
    output: zod.string(),
    durationMs: zod.number(),
    requestPermission: zod.boolean(),
  }),
  zod.object({
    type: zod.literal("plan"),
    entries: zod.array(
      zod.object({
        content: zod.string(),
        status: zod.enum(["pending", "in_progress", "completed"]),
        priority: zod.enum(["high", "medium", "low"]),
      }),
    ),
  }),
  zod.object({
    type: zod.literal("delay"),
    ms: zod.number(),
  }),
  zod.object({
    type: zod.literal("error"),
    message: zod.string(),
  }),
])

export type ScenarioStep = zod.infer<typeof scenarioStepSchema>

export const scenarioSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  description: zod.string(),
  steps: zod.array(scenarioStepSchema),
})

export type Scenario = zod.infer<typeof scenarioSchema>

export const fuzzConfigSchema = zod.object({
  enabled: zod.boolean(),
  randomDelayRange: zod.tuple([zod.number(), zod.number()]),
  dropChunkProbability: zod.number(),
  errorProbability: zod.number(),
  partialChunkProbability: zod.number(),
})

export type FuzzConfig = zod.infer<typeof fuzzConfigSchema>

export const mcpServerSchema = zod.object({
  name: zod.string(),
  uri: zod.string(),
  tools: zod.array(
    zod.object({
      name: zod.string(),
      description: zod.string(),
    }),
  ),
})

export type McpServer = zod.infer<typeof mcpServerSchema>

export const cannedResponseSchema = zod.object({
  id: zod.string(),
  label: zod.string(),
  content: zod.string(),
})

export type CannedResponse = zod.infer<typeof cannedResponseSchema>

export const mockAgentSchema = createSchema({
  streamingConfig: f
    .object(streamingConfigSchema)
    .default({
      charsPerSecond: 120,
      chunkSize: 5,
      tokensPerSecond: 40,
      thinkingDelayMs: 200,
      toolCallDelayMs: 300,
      interChunkJitter: 0.3,
    }),
  scenarios: f.array(scenarioSchema).default([]),
  activeScenarioId: f.string().default(""),
  tools: f.array(toolDefinitionSchema).default([]),
  fuzzConfig: f
    .object(fuzzConfigSchema)
    .default({
      enabled: false,
      randomDelayRange: [0, 0],
      dropChunkProbability: 0,
      errorProbability: 0,
      partialChunkProbability: 0,
    }),
  mcpServers: f.array(mcpServerSchema).default([]),
  agentState: f.string().default("idle"),
  currentSessionId: f.string().default(""),
  controlPort: f.number().default(0),
  cannedResponses: f
    .array(cannedResponseSchema)
    .default([
      {
        id: "hello",
        label: "Hello Response",
        content:
          "Hello! I'm the mock agent. I can simulate various agent behaviors for testing purposes. How can I help you today?",
      },
      {
        id: "code-review",
        label: "Code Review",
        content:
          "I've reviewed the code and found a few things:\n\n1. **Line 42**: The variable `data` is used before being defined. Consider moving the declaration.\n2. **Line 87**: This function could benefit from error handling around the async call.\n3. **Line 123**: The type annotation is too broad — consider narrowing `any` to a specific interface.\n\nOverall the code is well-structured. The main concern is error handling in the async paths.",
      },
      {
        id: "long-stream",
        label: "Long Streaming Response",
        content:
          "Let me walk through the implementation step by step.\n\nFirst, we need to set up the project structure. This involves creating the necessary directories and configuration files. The project will use TypeScript for type safety and Effect for dependency management.\n\nNext, we'll implement the core data model. The schema defines the shape of our database, including collections for events, configurations, and state. Each field uses Zod validators wrapped with the `f` proxy for type-safe defaults.\n\nThe service layer follows an Effect-based dependency injection pattern. Services are defined as `Effect.Service` classes with `scoped` lifecycle management. Dependencies between services form a DAG (directed acyclic graph) that Effect resolves automatically at runtime.\n\nFor the communication layer, we use WebSocket connections multiplexing two channels: one for RPC (remote procedure calls) and one for database synchronization. This allows real-time updates while maintaining a clean separation of concerns.\n\nFinally, the React renderer connects to the main process via these channels, using typed hooks for both RPC calls and reactive database queries. The `useDb` hook subscribes to database changes, while `useRpc` provides typed access to server-side procedures.\n\nThis architecture ensures type safety from database schema to UI rendering, with automatic synchronization between all connected clients.",
      },
    ]),
  events: f.collection<{
    sessionId: string
    timestamp: number
    direction: "emitted" | "received"
    updateType: string
    data: unknown
  }>(),
})

export type MockAgentSchema = InferSchema<typeof mockAgentSchema>
