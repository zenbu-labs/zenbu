# Configure an AI Agent

## What You're Doing

Adding or configuring an AI agent that users can interact with through chat views. Agents are external processes that communicate via the Agent Client Protocol (ACP) over NDJSON/JSON-RPC on stdio.

## Background

### How Agents Work

```
Zenbu Main Process
  └── AgentService (per chat view)
        └── Agent (manages lifecycle)
              └── AcpClient (spawns child process)
                    └── NDJSON over stdin/stdout ↔ Agent binary
```

When a user sends a message in a chat view:
1. The orchestrator calls `rpc.send(viewId, text)`
2. `AgentService` looks up which agent is configured for that view
3. If no agent process exists for that view, it spawns one using `startCommand`
4. The message is sent via ACP's `prompt` method
5. Streaming updates come back as `sessionUpdate` notifications
6. Updates are appended to the Kyju `events` collection

### ACP (Agent Client Protocol)

ACP is a JSON-RPC 2.0 protocol over NDJSON (newline-delimited JSON) on stdio. The key methods:
- `initialize` — handshake, declare capabilities
- `newSession` / `loadSession` — start or resume a conversation
- `prompt` — send user input, receive streaming updates

The `@agentclientprotocol/sdk` package provides TypeScript types and `ClientSideConnection`/`AgentSideConnection` classes.

### Agent Configuration in the Schema

Agents are stored in the Kyju database schema (`packages/init/shared/schema/index.ts`):

```typescript
agents: f.array(zod.object({
  id: zod.string(),
  name: zod.string(),
  startCommand: zod.string(),
})).default([{ id: "codex-acp", name: "Codex", startCommand: "" }]),

selectedAgentId: f.string().default("codex-acp"),
```

`startCommand` is split on whitespace into `command` and `args` when spawning the process.

## Steps

### Option A: Add an Agent Entry to the Schema Defaults

If you want the agent available to all new installations, add it to the default array in `packages/init/shared/schema/index.ts`:

```typescript
agents: f.array(zod.object({
  id: zod.string(),
  name: zod.string(),
  startCommand: zod.string(),
})).default([
  { id: "codex-acp", name: "Codex", startCommand: "" },
  { id: "my-agent", name: "My Agent", startCommand: "my-agent-binary --acp" },
]),
```

### Option B: Add via Migration (For Existing Databases)

Create a migration that inserts the agent into existing databases:

```typescript
import type { KyjuMigration } from "#zenbu/kyju/migrations"

const migration: KyjuMigration = {
  version: N,
  migrate: (prev) => {
    const data = { ...prev }
    const agents = Array.isArray(data.agents) ? [...data.agents] : []
    if (!agents.some((a: any) => a.id === "my-agent")) {
      agents.push({
        id: "my-agent",
        name: "My Agent",
        startCommand: "my-agent-binary --acp",
      })
    }
    data.agents = agents
    return data
  },
}

export default migration
```

### Option C: Add at Runtime via RPC/DB

Write a service or RPC procedure that adds the agent dynamically:

```typescript
await Effect.runPromise(
  this.ctx.db.client.update((root) => {
    const exists = root.agents.some(a => a.id === "my-agent")
    if (!exists) {
      root.agents = [...root.agents, {
        id: "my-agent",
        name: "My Agent",
        startCommand: "my-agent-binary --acp",
      }]
    }
  })
)
```

### Writing an ACP-Compatible Agent

Your agent binary must speak ACP on stdio. The simplest approach is to use `@agentclientprotocol/sdk`:

```typescript
import * as acp from "@agentclientprotocol/sdk"
import { Readable, Writable } from "node:stream"

const input = Writable.toWeb(process.stdout)
const output = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>
const stream = acp.ndJsonStream(input, output)

new acp.AgentSideConnection((conn) => ({
  initialize: async (params) => {
    return { protocolVersion: acp.PROTOCOL_VERSION, agentCapabilities: {} }
  },
  newSession: async (params) => {
    return { sessionId: "session-1" }
  },
  prompt: async (params) => {
    // Process user input from params.blocks
    // Send updates via conn.sessionUpdate(...)
    conn.sessionUpdate({
      kind: "messagesSnapshot",
      messages: [{ role: "assistant", content: [{ type: "text", text: "Hello!" }] }],
    })
  },
}), stream)
```

### The Bridge Pattern

If your agent doesn't speak ACP natively, write a bridge. The Codex bridge (`packages/codex-acp/src/bridge.ts`) is a working example:

1. The bridge binary speaks ACP on stdio (the Zenbu side)
2. Internally, it spawns the real agent (`codex app-server`) with its own protocol
3. It translates between the two protocols

The bridge uses `AgentSideConnection` with stdin/stdout inverted (the bridge is the "agent" from Zenbu's perspective):

```typescript
const input = Writable.toWeb(process.stdout)     // agent writes to stdout
const output = Readable.toWeb(process.stdin)      // agent reads from stdin
const stream = acp.ndJsonStream(input, output)
new acp.AgentSideConnection((conn) => new MyBridgeAgent(conn), stream)
```

### Setting the Default Agent

To change which agent is selected by default for new chat views:

```typescript
await Effect.runPromise(
  this.ctx.db.client.update((root) => {
    root.selectedAgentId = "my-agent"
  })
)
```

The orchestrator's TabBar reads `selectedAgentId` when creating new chat tabs and sets `view.agentId` accordingly.

## How AgentService Resolves the Agent

In `packages/init/src/main/services/agent.ts`:

1. Reads the view's `agentId` from `root.views`
2. Falls back to `root.selectedAgentId` if the view doesn't have one
3. Falls back to `"codex-acp"` if neither is set
4. Looks up the agent config in `root.agents` by id
5. Parses `startCommand` into `command` + `args`
6. Spawns via `AcpClient.create({ command, args, cwd: process.cwd(), ... })`

An empty `startCommand` means the command must be resolved from the environment (e.g. `codex-acp` on `$PATH`).

## Checklist

- [ ] Agent entry added to schema defaults or via migration
- [ ] `startCommand` is a valid command that speaks ACP on stdio
- [ ] For non-ACP agents, a bridge binary is created (see `packages/codex-acp/`)
- [ ] Agent appears in the Settings dialog agent selector
- [ ] `selectedAgentId` updated if it should be the default
