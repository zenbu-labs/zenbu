# Add a New RPC Procedure

## What You're Doing

Adding a new remote procedure that the frontend (renderer process) can call on the backend (main process). Zenbu uses a typed RPC layer (`#zenbu/zenrpc`) over WebSocket, and types flow automatically from server to client.

## Background

### How RPC Works

A single WebSocket connection multiplexes two channels:
- `{ ch: "rpc", data }` — RPC requests/responses
- `{ ch: "db", data }` — Kyju database replication

The RPC server lives in `RpcService`. It wraps `#zenbu/zenrpc`'s `createServer`, which dispatches incoming requests to the **router**—a plain object whose leaf values are functions.

The router is defined in `packages/init/src/main/routers/main-router.ts`. `RouterService` passes it to `RpcService` via `setRouter()`.

### Type Flow

```
main-router.ts: export const router = { myProc: (x: string) => Effect.sync(() => x.length) }
main-router.ts: export type ServerRouter = typeof router
                                ↓
providers.ts:   RouterProxy<ServerRouter>  (type-only import of ServerRouter)
                                ↓
useRpc():       rpc.myProc("hello")  →  Promise<{ _tag: "success", data: number }>
```

Adding a function to the `router` object automatically updates `ServerRouter`, which updates the client proxy type. No manual type wiring needed.

### Effect vs Plain Functions

Router procedures can return:
- **`Effect.sync(() => value)`** — synchronous, pure
- **`Effect.promise(() => asyncWork())`** — wraps a Promise
- **`Effect.gen(function* () { ... })`** — Effect generator for composition
- **`Effect.succeed(value)`** — constant value
- **Plain value / Promise** — also works, but Effect is the convention

Effect-based procedures resolve to `{ _tag: "success", data: T }` on the client side (or `{ _tag: "Failure", ... }` for tagged errors).

## Steps

### 1. Add the Procedure to the Router

Edit `packages/init/src/main/routers/main-router.ts`. Add a new key to the `router` object:

```typescript
export const router = {
  // ... existing procedures ...

  myProcedure: (arg1: string, arg2: number) =>
    Effect.sync(() => {
      return { result: `${arg1}-${arg2}` }
    }),
}
```

The `ServerRouter` type at the bottom of the file updates automatically:

```typescript
export type ServerRouter = typeof router
```

### 2. Access Services from the Procedure

The router is a plain object, not a service. To access services, use `runtime.get()`:

```typescript
import { runtime } from "../runtime"
import { AgentService } from "../services/agent"
import { DbService } from "../services/db"

export const router = {
  // ... existing procedures ...

  myProcedure: (viewId: string) =>
    Effect.gen(function* () {
      const db = runtime.get<DbService>(DbService)
      const root = db.client.readRoot()
      const views = root.views ?? []
      return views.filter(v => v.id === viewId)
    }),
}
```

`runtime.get<T>(ServiceClass)` returns the service instance if it's ready, or throws if not. This is safe to call inside procedures because by the time RPC requests arrive, all services have evaluated.

### 3. Call from the Frontend

In any React component that's inside a `RpcProvider`:

```typescript
import { useRpc } from "../../lib/providers"

function MyComponent() {
  const rpc = useRpc()

  const handleClick = async () => {
    const result = await rpc.myProcedure("hello", 42)
    // result is { _tag: "success", data: { result: "hello-42" } }
    // for Effect-based procedures
    console.log(result)
  }

  return <button onClick={handleClick}>Call RPC</button>
}
```

`useRpc()` returns a `RouterProxy<ServerRouter>` where every leaf function becomes a `Promise`-returning function. The proxy serializes args as JSON, sends them over WebSocket, and deserializes the response.

### Nested Namespaces

The router supports nesting for organization:

```typescript
export const router = {
  agent: {
    send: (viewId: string, text: string) => Effect.promise(() => { /* ... */ }),
    configure: (id: string, config: any) => Effect.sync(() => { /* ... */ }),
  },
  db: {
    query: (collection: string) => Effect.sync(() => { /* ... */ }),
  },
}
```

Client usage: `rpc.agent.send(viewId, text)`.

## What Not to Change

- **`rpc.ts`** — No changes needed for new procedures. The RPC service just forwards to whatever router is set.
- **`router.ts`** — No changes needed. It already calls `this.ctx.rpc.setRouter(router)`.
- **`ws-connection.ts`** — No changes needed. The WebSocket connection is generic.
- **`providers.ts`** — No changes needed. It uses `type { ServerRouter }` which auto-updates.

## Checklist

- [ ] New function added to `router` object in `main-router.ts`
- [ ] Return type is `Effect.*` (convention) or plain value/Promise
- [ ] Services accessed via `runtime.get<T>()` inside the procedure
- [ ] Frontend calls via `useRpc().myProcedure(...)` 
- [ ] No changes to RPC wiring (rpc.ts, router.ts, providers.ts, ws-connection.ts)
