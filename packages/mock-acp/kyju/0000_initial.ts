import type { KyjuMigration } from "@zenbu/kyju/migrations"

const migration: KyjuMigration = {
  version: 1,
  operations: [
    {
      op: "add",
      key: "streamingConfig",
      kind: "data",
      hasDefault: true,
      default: {
        charsPerSecond: 120,
        chunkSize: 5,
        tokensPerSecond: 40,
        thinkingDelayMs: 200,
        toolCallDelayMs: 300,
        interChunkJitter: 0.3,
      },
    },
    { op: "add", key: "scenarios", kind: "data", hasDefault: true, default: [] },
    { op: "add", key: "activeScenarioId", kind: "data", hasDefault: true, default: "" },
    { op: "add", key: "tools", kind: "data", hasDefault: true, default: [] },
    {
      op: "add",
      key: "fuzzConfig",
      kind: "data",
      hasDefault: true,
      default: {
        enabled: false,
        randomDelayRange: [0, 0],
        dropChunkProbability: 0,
        errorProbability: 0,
        partialChunkProbability: 0,
      },
    },
    { op: "add", key: "mcpServers", kind: "data", hasDefault: true, default: [] },
    { op: "add", key: "agentState", kind: "data", hasDefault: true, default: "idle" },
    { op: "add", key: "currentSessionId", kind: "data", hasDefault: true, default: "" },
    { op: "add", key: "controlPort", kind: "data", hasDefault: true, default: 0 },
    {
      op: "add",
      key: "cannedResponses",
      kind: "data",
      hasDefault: true,
      default: [
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
            "I've reviewed the code and found a few things:\n\n1. **Line 42**: The variable `data` is used before being defined.\n2. **Line 87**: This function could benefit from error handling.\n3. **Line 123**: The type annotation is too broad.\n\nOverall the code is well-structured.",
        },
      ],
    },
    { op: "add", key: "events", kind: "collection" },
  ],
}

export default migration
