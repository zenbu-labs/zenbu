# Create a New Backend Service

## What You're Doing

Creating a service—a backend module that runs in Electron's main (Node.js) process. Services are the fundamental unit of backend logic in Zenbu. The kernel itself is composed entirely of services.

## Background

### What Is a Service?

A service is a class that extends `Service` from `packages/init/src/main/runtime.ts`. Every service has:

- **`static key`** — a unique string identifier (e.g. `"my-service"`)
- **`static deps`** — a record mapping names to other services this one depends on
- **`evaluate()`** — called on every initialization and re-evaluation (hot reload)
- **`effect(key, setup)`** — registers a keyed side effect with cleanup (like React's `useEffect`)
- **`shutdown()`** — optional teardown when the service is permanently removed

### How Services Get Discovered

The kernel's plugin manifest (`packages/init/zenbu.plugin.json`) contains:

```json
{
  "services": ["src/main/services/*.ts"]
}
```

The `*.ts` glob means any `.ts` file you add to `packages/init/src/main/services/` is automatically imported and registered. You do not need to edit the manifest.

### How HMR Works

When you save a service file, dynohot detects the change, re-imports the module, and calls `runtime.register()` again. The runtime:

1. Keeps the existing instance (preserving any state on `this`)
2. Swaps in the new class methods via `Object.setPrototypeOf(instance, NewClass.prototype)`
3. Runs all previous effect cleanups
4. Re-injects `ctx` with current dependency instances
5. Calls `evaluate()` again with the new code

This is why idempotency matters—`evaluate()` must be safe to call multiple times.

### The DAG

Services initialize in topological order based on their `deps`. Services at the same level (no dependencies between them) evaluate in parallel. Circular dependencies are detected and throw an error.

## Steps

### 1. Create the Service File

Create a new file at `packages/init/src/main/services/<name>.ts`.

### 2. Write the Service Class

```typescript
import { Service, runtime } from "../runtime"

export class MyService extends Service {
  static key = "my-service"
  static deps = {}

  evaluate() {
    console.log("[my-service] ready")
  }
}

runtime.register(MyService, (import.meta as any).hot)
```

The `runtime.register()` call at the bottom is required. Passing `import.meta.hot` enables HMR—the service will accept hot updates and unregister when the module is pruned.

### 3. Add Dependencies (If Needed)

If your service needs access to other services, declare them in `static deps`:

```typescript
import { Service, runtime } from "../runtime"
import { DbService } from "./db"
import { HttpService } from "./http"

export class MyService extends Service {
  static key = "my-service"
  static deps = { db: DbService, http: HttpService }
  declare ctx: { db: DbService; http: HttpService }

  evaluate() {
    const root = this.ctx.db.client.readRoot()
    console.log("[my-service] db has", root.views?.length, "views")
  }
}

runtime.register(MyService, (import.meta as any).hot)
```

Dependencies can be:
- **A service class**: `{ db: DbService }` — uses `DbService.key` to resolve
- **A string key**: `{ baseWindow: "base-window" }` — resolves by key directly (useful to avoid circular imports)
- **Optional**: `{ maybeFoo: optional(FooService) }` — `ctx.maybeFoo` is `undefined` if `FooService` isn't registered. Import `optional` from `../runtime`.

The `declare ctx` line gives you type safety on `this.ctx` without emitting runtime code.

### 4. Use Effects for Non-Deterministic Resources

Anything that sets up a resource (server, interval, event listener, file watcher) must go through `this.effect()` so it gets cleaned up on re-evaluation and shutdown:

```typescript
evaluate() {
  this.effect("my-interval", () => {
    const handle = setInterval(() => {
      console.log("[my-service] tick")
    }, 5000)
    return () => clearInterval(handle)
  })

  this.effect("my-listener", () => {
    const handler = () => { /* ... */ }
    this.ctx.http.onConnected(handler)
    return () => { /* unsubscribe */ }
  })
}
```

Each effect has a string key. On re-evaluation, the previous effect's cleanup runs before the new setup. Multiple effects can coexist with different keys.

### 5. Expose Methods for Other Services or RPC

Services can expose public methods that other services (or the RPC router) call:

```typescript
export class MyService extends Service {
  static key = "my-service"
  static deps = { db: DbService }
  declare ctx: { db: DbService }

  private cache = new Map<string, string>()

  async lookup(id: string): Promise<string | null> {
    if (this.cache.has(id)) return this.cache.get(id)!
    // ... do work
    return null
  }

  evaluate() {
    this.effect("cache-cleanup", () => {
      return () => { this.cache.clear() }
    })
  }
}
```

Other services access it via `ctx`:

```typescript
static deps = { my: MyService }
declare ctx: { my: MyService }

evaluate() {
  // can now call this.ctx.my.lookup(id)
}
```

The RPC router accesses services via `runtime.get()`:

```typescript
const agent = runtime.get<AgentService>(AgentService)
```

## Complete Example

Here is `ServerService`, a real service with no dependencies that creates an HTTP server:

```typescript
import http from "node:http"
import { WebSocketServer } from "ws"
import { Service, runtime } from "../runtime"

export class ServerService extends Service {
  static key = "server"
  static deps = {}

  server: http.Server | null = null
  wss: WebSocketServer | null = null
  port = 0

  async evaluate() {
    if (!this.server) {
      this.server = http.createServer()
      this.wss = new WebSocketServer({ server: this.server })
      this.port = await new Promise<number>((resolve) => {
        this.server!.listen(0, "0.0.0.0", () => {
          const addr = this.server!.address()
          resolve(typeof addr === "object" && addr ? addr.port : 0)
        })
      })
      console.log(`[server] listening on port ${this.port}`)
    }

    this.effect("server-cleanup", () => {
      return () => {
        this.wss?.close()
        this.server?.close()
        this.server?.closeAllConnections()
        this.server = null
        this.wss = null
      }
    })
  }
}

runtime.register(ServerService, (import.meta as any).hot)
```

Key patterns:
- `if (!this.server)` guards against re-creating the server on hot reload (the instance is reused)
- The effect cleanup tears everything down on shutdown or full re-evaluation
- Instance fields (`server`, `wss`, `port`) survive across hot reloads because the same instance is kept

## Checklist

- [ ] File is in `packages/init/src/main/services/`
- [ ] Class extends `Service`
- [ ] `static key` is set to a unique string
- [ ] `static deps` lists all required services
- [ ] `declare ctx` matches the deps for type safety
- [ ] `evaluate()` is implemented
- [ ] Non-deterministic resources use `this.effect(key, setup)` with cleanup
- [ ] `runtime.register(MyService, (import.meta as any).hot)` is called at the bottom
- [ ] No circular dependencies in `static deps`
