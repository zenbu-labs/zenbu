# Read Reactive Data in a Frontend View

## What You're Doing

Subscribing to Kyju database state from a React component in a renderer view. Changes made by the main process (or other views) propagate in real time to your component.

## Background

### How Frontend DB Access Works

Each view iframe connects to the main process over a single WebSocket that carries both RPC and database sync:

1. `useWsConnection()` opens `ws://127.0.0.1:${wsPort}` and establishes:
   - An RPC client (for calling main-process procedures)
   - A Kyju **replica** (an eventually-consistent copy of the database)
2. `KyjuProvider` makes the replica available to the React tree
3. `useDb(selector)` subscribes to a slice of the replica and re-renders on changes

### The Provider Stack

Every view's `App.tsx` wraps content in three providers:

```
<RpcProvider>           — typed RPC proxy
  <KyjuClientProvider>  — direct Kyju client (for writes)
    <KyjuProvider>      — replica + reactive subscriptions
      <YourContent />
    </KyjuProvider>
  </KyjuClientProvider>
</RpcProvider>
```

This is set up by the standard `ConnectedApp` pattern (see `create-view` command).

### Writes Go Through RPC

The renderer replica is read-only in practice. To modify data, call an RPC procedure that writes on the main process side. The change then propagates back to all replicas.

Exception: The orchestrator uses `useKyjuClient()` for direct writes to `views` (tab management). This works because the Kyju client proxy supports writes, but the convention is to use RPC for non-trivial writes.

## Steps

### 1. Ensure Provider Stack Is in Place

Your view's `App.tsx` should follow the standard pattern from `create-view`. The providers are already set up if you used that template.

### 2. Read Data with `useDb`

```typescript
import { useDb } from "../../lib/kyju-react"

function MyComponent() {
  const views = useDb((root) => root.views)
  const sidebarOpen = useDb((root) => root.sidebarOpen)
  const registry = useDb((root) => root.viewRegistry)
  const agents = useDb((root) => root.agents)

  return (
    <div>
      <p>{views?.length ?? 0} views open</p>
      <p>Sidebar: {sidebarOpen ? "open" : "closed"}</p>
    </div>
  )
}
```

`useDb` takes a selector function `(root) => T`. It:
- Reads the current value from the replica
- Re-renders the component whenever that value changes
- Returns the selected value (typed based on the schema)

### 3. Derive Computed Values

Use `useMemo` for derived data to avoid recomputation:

```typescript
import { useMemo } from "react"
import { useDb } from "../../lib/kyju-react"

function ViewList() {
  const views = useDb((root) => root.views)
  const registry = useDb((root) => root.viewRegistry)

  const registryMap = useMemo(() => {
    const map = new Map<string, { scope: string; url: string; port: number }>()
    for (const entry of registry ?? []) map.set(entry.scope, entry)
    return map
  }, [registry])

  const activeView = useMemo(
    () => (views ?? []).find(v => v.active),
    [views],
  )

  return <div>Active: {activeView?.title}</div>
}
```

### 4. Write Data via RPC

For writes, call an RPC procedure:

```typescript
import { useRpc } from "../../lib/providers"

function SendButton({ viewId }: { viewId: string }) {
  const rpc = useRpc()

  const handleSend = async () => {
    await rpc.send(viewId, "hello")
  }

  return <button onClick={handleSend}>Send</button>
}
```

The RPC handler on the main process writes to the database, and the change propagates back to all replicas (including this view's).

### 5. Direct Writes (Advanced)

For simple UI state like tab management, you can use the Kyju client directly:

```typescript
import { useKyjuClient } from "../../lib/providers"

function ToggleSidebar() {
  const client = useKyjuClient()

  const toggle = async () => {
    const root = client.readRoot()
    await (client as any).sidebarOpen.set(!(root as any).sidebarOpen)
  }

  return <button onClick={toggle}>Toggle</button>
}
```

This is less common and bypasses RPC. Use it sparingly for direct UI state; use RPC for business logic.

## Available Hooks

| Hook | Import | Returns |
|------|--------|---------|
| `useDb(selector)` | `../../lib/kyju-react` | Reactive value from the database replica |
| `useRpc()` | `../../lib/providers` | `RouterProxy<ServerRouter>` — typed RPC proxy |
| `useKyjuClient()` | `../../lib/providers` | `ClientProxy<AppSchema>` — direct Kyju client |

## Checklist

- [ ] View has the standard provider stack (`RpcProvider > KyjuClientProvider > KyjuProvider`)
- [ ] Reads use `useDb((root) => root.field)`
- [ ] Derived data wrapped in `useMemo`
- [ ] Writes go through `useRpc()` (preferred) or `useKyjuClient()` (for simple UI state)
