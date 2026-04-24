# Read and Write Data in the Main Process

## What You're Doing

Accessing the Kyju database from a service running in Electron's main (Node.js) process. This is how backend logic reads state, writes updates, and appends to collections.

## Background

### Where the Database Is

`DbService` (`packages/init/src/main/services/db.ts`) creates the database at `/tmp/zenbu-desktop-db` using `createDb` from `#zenbu/kyju`. It exposes `this.db.effectClient` as `this.client` (a getter).

### The Client API

The Kyju client uses Effect for writes. The main patterns:
- **`client.readRoot()`** — synchronous snapshot of all root fields
- **`client.update((root) => { ... })`** — mutate root fields (returns an `Effect`)
- **`client.<collection>.concat([...])`** — append items to a collection (returns an `Effect`)

All write operations return Effects that must be run via `Effect.runPromise()`.

### Schema and Types

The schema (`packages/init/shared/schema/index.ts`) defines what fields exist. `AppSchema` is the inferred TypeScript type. `client.readRoot()` returns data shaped by this schema.

## Steps

### 1. Depend on DbService

In your service, declare `DbService` as a dependency:

```typescript
import { Service, runtime } from "../runtime"
import { DbService } from "./db"

export class MyService extends Service {
  static key = "my-service"
  static deps = { db: DbService }
  declare ctx: { db: DbService }

  evaluate() {
    // this.ctx.db is now available
  }
}

runtime.register(MyService, (import.meta as any).hot)
```

### 2. Read Data

```typescript
evaluate() {
  const root = this.ctx.db.client.readRoot()

  // Read scalar fields
  const agentId = root.selectedAgentId          // "codex-acp"
  const sidebarOpen = root.sidebarOpen          // false

  // Read arrays
  const views = root.views ?? []                // ViewItem[]
  const agents = root.agents                    // AgentConfig[]

  // Read the view registry
  const registry = root.viewRegistry ?? []      // { scope, url, port }[]
}
```

`readRoot()` is synchronous and returns a snapshot. It does not subscribe to changes—each call reads the latest state.

### 3. Write Data (Update Root Fields)

```typescript
import { Effect } from "effect"

async someMethod() {
  await Effect.runPromise(
    this.ctx.db.client.update((root) => {
      root.sidebarOpen = true
      root.sidebarPanel = "chat"
    })
  )
}
```

The `update` callback receives a mutable proxy of the root. Mutate fields directly—the changes are batched and committed. The write propagates to all connected replicas (renderer iframes) via WebSocket.

### 4. Write Data (Set Arrays)

For array fields like `views`, replace the entire array:

```typescript
await Effect.runPromise(
  this.ctx.db.client.update((root) => {
    root.views = [
      ...root.views,
      { id: "new", type: "chat", title: "New Chat", createdAt: Date.now(), active: true },
    ]
  })
)
```

### 5. Append to Collections

Collections (like `events`) are append-only. Use `.concat()`:

```typescript
await Effect.runPromise(
  this.ctx.db.client.events.concat([
    {
      viewId: "abc",
      timestamp: Date.now(),
      data: { kind: "user_prompt", text: "hello" },
    },
  ])
)
```

### 6. Use in RPC Handlers

RPC procedures access the database via `runtime.get()`:

```typescript
// In main-router.ts
myProcedure: (viewId: string) =>
  Effect.gen(function* () {
    const db = runtime.get<DbService>(DbService)
    const root = db.client.readRoot()
    return root.views?.find(v => v.id === viewId) ?? null
  }),
```

## Common Patterns

**Read-modify-write:**
```typescript
await Effect.runPromise(
  this.ctx.db.client.update((root) => {
    const view = root.views?.find(v => v.id === targetId)
    if (view) view.title = "Updated Title"
  })
)
```

**Conditional initialization in evaluate:**
```typescript
evaluate() {
  const root = this.ctx.db.client.readRoot()
  if (!root.myField) {
    Effect.runPromise(
      this.ctx.db.client.update((root) => {
        root.myField = "initialized"
      })
    ).catch(console.error)
  }
}
```

## Checklist

- [ ] Service has `db: DbService` in `static deps`
- [ ] `declare ctx` includes `db: DbService`
- [ ] Reads use `this.ctx.db.client.readRoot()`
- [ ] Writes use `Effect.runPromise(this.ctx.db.client.update(...))` 
- [ ] Collection appends use `Effect.runPromise(this.ctx.db.client.<name>.concat([...]))`
