import type { Scenario, ScenarioStep } from "../../shared/schema.ts"
import type { SimulationContext } from "./engine.ts"
import { streamMessage } from "./engine.ts"
import { emitThinking } from "./thinking.ts"
import { emitToolCall } from "./tool-calls.ts"
import { emitPlan } from "./plans.ts"
import { sleep } from "./streaming.ts"

export async function executeScenario(
  ctx: SimulationContext,
  scenario: Scenario,
): Promise<void> {
  for (const step of scenario.steps) {
    ctx.signal?.throwIfAborted()
    await executeStep(ctx, step)
  }
}

async function executeStep(
  ctx: SimulationContext,
  step: ScenarioStep,
): Promise<void> {
  switch (step.type) {
    case "thinking":
      await emitThinking(ctx, step.content)
      break
    case "message":
      await streamMessage(ctx, step.content)
      break
    case "tool_call":
      await emitToolCall(ctx, step)
      break
    case "plan":
      await emitPlan(ctx, step)
      break
    case "delay":
      await sleep(step.ms, ctx.signal)
      break
    case "error":
      throw new Error(step.message)
  }
}

export const builtinScenarios: Scenario[] = [
  {
    id: "simple-response",
    name: "Simple Response",
    description: "A basic text response with thinking",
    steps: [
      {
        type: "thinking",
        content: "Let me think about what the user is asking...",
      },
      {
        type: "message",
        content:
          "I've analyzed your request. Here's what I found:\n\nThe implementation looks straightforward. We can proceed with the changes you suggested.",
      },
    ],
  },
  {
    id: "tool-usage",
    name: "Tool Usage Flow",
    description: "Demonstrates thinking, tool calls, and a final response",
    steps: [
      {
        type: "thinking",
        content:
          "The user wants me to read a file and make changes. Let me start by reading the file to understand its current state.",
      },
      {
        type: "plan",
        entries: [
          {
            content: "Read the target file",
            status: "in_progress",
            priority: "high",
          },
          {
            content: "Analyze the code structure",
            status: "pending",
            priority: "medium",
          },
          {
            content: "Apply the requested changes",
            status: "pending",
            priority: "high",
          },
        ],
      },
      {
        type: "tool_call",
        toolName: "read_file",
        title: "Reading src/index.ts",
        kind: "read",
        output:
          'import { createServer } from "./server"\n\nconst app = createServer()\napp.listen(3000)\nconsole.log("Server started")\n',
        durationMs: 500,
        requestPermission: false,
      },
      {
        type: "plan",
        entries: [
          {
            content: "Read the target file",
            status: "completed",
            priority: "high",
          },
          {
            content: "Analyze the code structure",
            status: "in_progress",
            priority: "medium",
          },
          {
            content: "Apply the requested changes",
            status: "pending",
            priority: "high",
          },
        ],
      },
      {
        type: "thinking",
        content:
          "I can see the file imports createServer and starts it on port 3000. I need to add error handling and make the port configurable.",
      },
      {
        type: "tool_call",
        toolName: "edit_file",
        title: "Editing src/index.ts",
        kind: "edit",
        output:
          '--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,4 +1,8 @@\n import { createServer } from "./server"\n \n-const app = createServer()\n-app.listen(3000)\n+const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000\n+const app = createServer()\n+app.listen(PORT, () => {\n+  console.log(`Server started on port ${PORT}`)\n+}).on("error", (err) => {\n+  console.error("Failed to start server:", err)\n+  process.exit(1)\n+})',
        durationMs: 800,
        requestPermission: true,
      },
      {
        type: "plan",
        entries: [
          {
            content: "Read the target file",
            status: "completed",
            priority: "high",
          },
          {
            content: "Analyze the code structure",
            status: "completed",
            priority: "medium",
          },
          {
            content: "Apply the requested changes",
            status: "completed",
            priority: "high",
          },
        ],
      },
      {
        type: "message",
        content:
          "I've updated `src/index.ts` with the following improvements:\n\n1. **Configurable port** via `PORT` environment variable (defaults to 3000)\n2. **Error handling** on the server listener\n3. **Startup confirmation** log message\n\nThe changes maintain backward compatibility — without a `PORT` env var, it still runs on port 3000.",
      },
    ],
  },
  {
    id: "permission-denied",
    name: "Permission Denied Flow",
    description: "Demonstrates a tool call that gets rejected by the user",
    steps: [
      {
        type: "thinking",
        content: "I need to execute a shell command to install the dependencies.",
      },
      {
        type: "tool_call",
        toolName: "execute_command",
        title: "npm install --save lodash",
        kind: "execute",
        output: "",
        durationMs: 300,
        requestPermission: true,
      },
      {
        type: "message",
        content:
          "The command was not executed because permission was denied. Would you like me to try a different approach?",
      },
    ],
  },
  {
    id: "long-streaming",
    name: "Long Streaming Response",
    description: "Tests sustained text streaming over a longer period",
    steps: [
      {
        type: "thinking",
        content:
          "This is a complex question that requires a detailed explanation. Let me organize my thoughts before responding.",
      },
      {
        type: "message",
        content:
          "Let me walk through the implementation step by step.\n\n## Project Structure\n\nFirst, we need to set up the project structure. This involves creating the necessary directories and configuration files. The project will use TypeScript for type safety and Effect for dependency management.\n\n```\nsrc/\n  main/\n    index.ts          # Entry point\n    services/\n      http.ts         # HTTP server\n      db.ts           # Database\n      rpc.ts          # RPC layer\n  renderer/\n    App.tsx           # React root\n    lib/\n      connection.ts   # WS connection\n```\n\n## Core Data Model\n\nNext, we'll implement the core data model. The schema defines the shape of our database, including collections for events, configurations, and state. Each field uses Zod validators wrapped with the `f` proxy for type-safe defaults.\n\n```typescript\nconst schema = createSchema({\n  events: f.collection<Event>(),\n  config: f.object(configSchema).default(defaults),\n  state: f.string().default('idle'),\n})\n```\n\n## Service Layer\n\nThe service layer follows an Effect-based dependency injection pattern. Services are defined as `Effect.Service` classes with `scoped` lifecycle management. Dependencies between services form a DAG that Effect resolves automatically.\n\n## Communication Layer\n\nFor communication, we use WebSocket connections multiplexing two channels: one for RPC and one for database synchronization. This allows real-time updates while maintaining clean separation of concerns.\n\n## Conclusion\n\nThis architecture ensures type safety from database schema to UI rendering, with automatic synchronization between all connected clients.",
      },
    ],
  },
]
