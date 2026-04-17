# Create a New Frontend View

## What You're Doing

Creating a view—a frontend UI that runs in an iframe inside the Zenbu orchestrator. Views are isolated React applications served by Vite with full HMR and React Refresh. Each view gets its own WebSocket connection to the main process for RPC and database access.

## Background

### How Views Work

The orchestrator (the root Electron UI) reads the `viewRegistry` from the Kyju database. For each open tab, it renders an iframe pointing to the view's Vite URL:

```
${viewUrl}/index.html?id=${viewId}&wsPort=${wsPort}
```

Each view is a separate Vite multi-page entry. The "core" Vite dev server (created by `CoreRendererService`) serves all kernel views from `packages/init/src/renderer/`.

### The Registration Chain

1. A **service** in the main process calls `ViewRegistryService.registerAlias()` to map a scope name to a URL path on the core Vite server.
2. The view registry syncs to the **Kyju database** (`root.viewRegistry`).
3. The **orchestrator** reads `viewRegistry` reactively and shows available scopes in the TabBar "+" menu.
4. When the user creates a tab, the orchestrator writes to `root.views` and renders an iframe for that view.

### What Files You Need

Adding a view touches up to 8 files across the codebase:

| File | Purpose |
|------|---------|
| `shared/schema/index.ts` | Add your type to the view type enum |
| `src/renderer/vite.config.ts` | Add Vite MPA entry |
| `src/renderer/views/<name>/index.html` | HTML entry point |
| `src/renderer/views/<name>/main.tsx` | React bootstrap |
| `src/renderer/views/<name>/App.tsx` | View component with WS/DB/RPC providers |
| `src/renderer/views/<name>/app.css` | Styles |
| `src/main/services/view-<name>.ts` | Service that registers the view alias |
| `src/renderer/orchestrator/components/TabBar.tsx` | (Optional) icon and label |

All paths are relative to `packages/init/`.

## Steps

### 1. Add the View Type to the Schema

In `packages/init/shared/schema/index.ts`, add your scope name to the `type` enum:

```typescript
type: zod.enum(["chat", "quiz", "flashcard", "heatmap", "my-view"]),
```

This validates that stored view entries have a recognized type.

### 2. Add a Vite Multi-Page Entry

In `packages/init/src/renderer/vite.config.ts`, add your view to `build.rollupOptions.input`:

```typescript
build: {
  rollupOptions: {
    input: {
      orchestrator: resolve(__dirname, "orchestrator/index.html"),
      chat: resolve(__dirname, "views/chat/index.html"),
      // ... existing entries ...
      "my-view": resolve(__dirname, "views/my-view/index.html"),
    },
  },
},
```

### 3. Create the View Directory

Create `packages/init/src/renderer/views/my-view/` with these files:

**`index.html`**:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My View</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

**`main.tsx`**:
```typescript
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./app.css"

createRoot(document.getElementById("root")!).render(<App />)
```

**`app.css`**:
```css
@import "tailwindcss";

html, body, #root {
  height: 100%;
  margin: 0;
}
```

**`App.tsx`**:
```typescript
import {
  useWsConnection,
  RpcProvider,
  KyjuClientProvider,
} from "../../lib/ws-connection"
import { KyjuProvider } from "../../lib/kyju-react"
import type { WsConnectionState } from "../../lib/ws-connection"

const viewId = new URLSearchParams(window.location.search).get("id") ?? ""

function MyViewContent() {
  return (
    <div className="flex h-full items-center justify-center">
      <p>My View (id: {viewId})</p>
    </div>
  )
}

function ConnectedApp({
  connection,
}: {
  connection: Extract<WsConnectionState, { status: "connected" }>
}) {
  return (
    <RpcProvider value={connection.rpc}>
      <KyjuClientProvider value={connection.kyjuClient}>
        <KyjuProvider
          client={connection.kyjuClient}
          replica={connection.replica}
        >
          <MyViewContent />
        </KyjuProvider>
      </KyjuClientProvider>
    </RpcProvider>
  )
}

export function App() {
  const connection = useWsConnection()

  if (connection.status === "connecting") {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400 text-sm">
        
      </div>
    )
  }

  if (connection.status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-red-400 text-sm">
        {connection.error}
      </div>
    )
  }

  return <ConnectedApp connection={connection} />
}
```

This pattern:
- Reads `viewId` from `?id=` query param (set by the orchestrator)
- Connects to the main process via WebSocket using `?wsPort=`
- Sets up RPC, Kyju client, and Kyju replica providers
- Your content component (`MyViewContent`) has access to `useRpc()`, `useDb()`, and `useKyjuClient()`

### 4. Create the View Service

Create `packages/init/src/main/services/view-my-view.ts`:

```typescript
import { Service, runtime } from "../runtime"
import { ViewRegistryService } from "./view-registry"
import { CoreRendererService } from "./core-renderer"

export class MyViewService extends Service {
  static key = "view-my-view"
  static deps = { viewRegistry: ViewRegistryService, coreRenderer: CoreRendererService }
  declare ctx: { viewRegistry: ViewRegistryService; coreRenderer: CoreRendererService }

  evaluate() {
    this.ctx.viewRegistry.registerAlias("my-view", "core", "/views/my-view")
  }
}

runtime.register(MyViewService, (import.meta as any).hot)
```

`registerAlias("my-view", "core", "/views/my-view")` tells the system: the `"my-view"` scope is served by the `"core"` Vite dev server at the subpath `/views/my-view`. The orchestrator loads `${coreUrl}/views/my-view/index.html?id=...&wsPort=...`.

The `coreRenderer` dependency ensures the core Vite server is running before this service evaluates. The file is auto-discovered by the `src/main/services/*.ts` glob.

### 5. (Optional) Add Icon and Label to TabBar

In `packages/init/src/renderer/orchestrator/components/TabBar.tsx`, add to `builtinViewTypes`:

```typescript
const builtinViewTypes = {
  chat: { icon: ChatIcon, label: "Chat", defaultTitle: "New Chat" },
  // ... existing entries ...
  "my-view": { icon: DefaultViewIcon, label: "My View", defaultTitle: "My View" },
}
```

If you skip this, the TabBar still shows the view in the "+" menu using a default icon and the scope string as the label.

## How the View Gets Data

Inside `MyViewContent` (or any descendant):

```typescript
import { useDb } from "../../lib/kyju-react"
import { useRpc } from "../../lib/providers"

function MyViewContent() {
  const views = useDb((root) => root.views)
  const rpc = useRpc()

  const handleClick = async () => {
    await rpc.send(viewId, "hello from my view")
  }

  return <button onClick={handleClick}>Send</button>
}
```

- `useDb(selector)` — reactive read from the Kyju database replica
- `useRpc()` — typed RPC proxy to call main-process procedures
- `useKyjuClient()` — direct Kyju client for writes (e.g. `client.views.set(...)`)

## Checklist

- [ ] View type added to `zod.enum` in `shared/schema/index.ts`
- [ ] Vite MPA entry added in `src/renderer/vite.config.ts`
- [ ] `views/<name>/index.html` created
- [ ] `views/<name>/main.tsx` created
- [ ] `views/<name>/App.tsx` created with WS + provider pattern
- [ ] `views/<name>/app.css` created
- [ ] `src/main/services/view-<name>.ts` created with `registerAlias`
- [ ] View appears in TabBar "+" menu when running
