# Zenbu Architecture

Zenbu is an Emacs-inspired extensible desktop application built on Electron. The core idea: ship all source code to the user and let them modify anything—the editor, the UI, the backend logic—while the app is running. Every piece of functionality, including the kernel itself, is a hot-reloadable plugin.

## Command Reference

Self-contained how-to guides for specific tasks. Each file includes the full context chain so an AI (or developer) can execute the task from that file alone.

| Command | What It Does |
|---------|-------------|
| [Create a Service](docs/commands/create-service.md) | Add a new backend service to the main process |
| [Create a View](docs/commands/create-view.md) | Add a new frontend view (iframe-based React app) |
| [Create a Plugin](docs/commands/create-plugin.md) | Build a standalone plugin in its own repo |
| [Install a Plugin](docs/commands/install-plugin.md) | Install a third-party plugin |
| [Add an RPC Procedure](docs/commands/add-rpc-procedure.md) | Expose a service method as an RPC endpoint (just add a public method) |
| [Add a Schema Field](docs/commands/add-schema-field.md) | Add a new field to the Kyju database |
| [Create a Migration](docs/commands/create-migration.md) | Write a database migration |
| [Use the Kyju CLI](docs/commands/use-kyju-cli.md) | Inspect/debug the database from the terminal |
| [Read/Write DB (Main)](docs/commands/read-write-db-main.md) | Access the database from a service |
| [Read DB (Frontend)](docs/commands/read-db-frontend.md) | Read reactive data in a React view |
| [Add Advice](docs/commands/add-advice.md) | Intercept or replace a function at runtime |
| [Configure an Agent](docs/commands/configure-agent.md) | Add or configure an AI agent |
| [Update the App](docs/commands/update-app.md) | Pull updates and handle conflicts |

---

## Table of Contents

- [Philosophy](#philosophy)
- [Repository Structure](#repository-structure)
- [The Shell](#the-shell)
- [Loader Chain](#loader-chain)
- [Service System](#service-system)
- [Plugin System](#plugin-system)
- [View System](#view-system)
- [Kyju Database](#kyju-database)
- [WebSocket Communication](#websocket-communication)
- [Agent System](#agent-system)
- [Advice System](#advice-system)
- [Mode System](#mode-system)
- [Plugin Registry](#plugin-registry)
- [Updates](#updates)
- [Future Work](#future-work)

---

## Philosophy

Traditional desktop apps ship compiled binaries. Emacs took a different approach: give users all the source code and let them modify it at runtime via Lisp's dynamic symbol tables. Zenbu brings this philosophy to TypeScript/Electron.

The challenge is that TypeScript and Node.js weren't designed for this. There are no mutable symbol tables, and re-importing a module doesn't re-execute its side effects or update existing references. Zenbu solves this with a layered system:

1. **Dynohot** rewrites module imports into live proxies (`$` references) that can be swapped at runtime when files change on disk.
2. **The Service System** provides a React-like lifecycle (evaluate, effects, cleanup) so re-evaluated code is idempotent—no leaked resources, no stale state.
3. **The Plugin System** makes the kernel itself a plugin, so writing core features and writing third-party extensions use the exact same mechanism.
4. **The View System** extends this to the frontend via Vite dev servers with React Refresh, loaded in iframes.
5. **The Advice System** provides Emacs-style function wrapping/replacement for both Node and browser code.

The result: users clone a git repo, and every line of code in it is live-editable.

---

## Repository Structure

This is a pnpm monorepo.

```
zenbu/
├── apps/
│   └── shell/                  # Thin Electron host (the "shell")
├── packages/
│   ├── kernel/                 # Main plugin: services, renderer, views
│   ├── dynohot/                # Hot module replacement for ESM (fork of laverdet/dynohot)
│   ├── advice/                 # Emacs-style advice: loader, Vite plugin, runtime
│   ├── agent/                  # ACP client + Agent abstraction (Effect-based)
│   ├── codex-acp/              # Codex → ACP bridge (translates Codex app-server to ACP)
│   ├── mock-acp/               # Mock ACP agent for development
│   ├── kyju/                   # Reactive database with cross-process replication
│   ├── zenrpc/                 # RPC layer (Effect-based)
│   ├── ui/                     # Shared React UI primitives
│   ├── puter/                  # CLI tool
│   ├── virtualizer/            # React virtualization utilities
│   └── video-automation/       # AI provider wrappers
├── docs/
│   ├── acp-context/            # Agent Client Protocol spec + JSON schemas
│   ├── codex-app-server-context/
│   └── effect-context/
├── registry.jsonl              # Plugin catalog (name, description, git repo)
├── setup.sh                    # First-run dependency installation
└── package.json                # Monorepo root: `start` runs the shell
```

Key packages and their roles:

| Package | Role |
|---------|------|
| `@zenbu/kernel` | Electron binary. Registers loaders, reads config, imports plugins. |
| `@zenbu/init` | The main plugin. All core services (window, HTTP, DB, views, agents) and the React renderer. |
| `dynohot` | ESM hot module replacement. Watches files, rewrites imports to live proxies. |
| `@zenbu/advice` | Compile-time + runtime function interception inspired by Emacs advice. |
| `@zenbu/agent` | Agent Client Protocol client. Spawns agent subprocesses, communicates via NDJSON/JSON-RPC. |
| `@zenbu/kyju` | SQLite-backed reactive database with cross-process replication over WebSocket. |
| `@zenbu/zenrpc` | Typed RPC with Effect. Powers main↔renderer communication. |

---

## The Shell

**Location:** `apps/kernel/`

The shell is intentionally minimal. It is the only code that gets compiled ahead of time (via esbuild into `dist/main/index.js`). Everything else is loaded dynamically at runtime through the loader chain.

### Boot Sequence

`apps/kernel/src/shell/index.ts`:

1. **Bootstrap check**: If `~/.zenbu/plugins/zenbu` is missing or has no `node_modules`, show the setup UI (`src/setup/index.html`) which git-clones the repo and runs `setup.sh`.

2. **Read config**: Load `~/.zenbu/config.json` which lists plugin manifest paths. If empty, auto-add the kernel manifest (`packages/init/zenbu.plugin.json`).

3. **Register loaders** (order matters):
   ```
   zenbu-loader-hooks.js  →  tsx  →  @zenbu/advice/node  →  dynohot
   ```

4. **`process.chdir`** to the project root (derived from the first plugin manifest).

5. **Dynamic import** of `zenbu:plugins?config=<CONFIG_PATH>` with `{ with: { hot: "import" } }`. Dynohot wraps this in a controller; calling `controller.main()` actually executes the module graph.

6. **Wait for runtime**: `globalThis.__zenbu_service_runtime__.whenIdle()` blocks until all services finish their initial evaluation.

7. **Shutdown hook**: On `before-quit`, calls `runtime.shutdown()` which tears down services in reverse order, then exits.

### Config

`apps/kernel/src/shell/config.ts` manages `~/.zenbu/config.json`:

```json
{
  "plugins": [
    "/Users/you/.zenbu/plugins/zenbu/packages/init/zenbu.plugin.json"
  ]
}
```

Each entry is an absolute path to a `zenbu.plugin.json` manifest file.

---

## Loader Chain

Four Node.js ESM loaders are registered in sequence. Each one intercepts `resolve` and/or `load` hooks and passes through to the next.

### 1. Zenbu Loader (`zenbu-loader-hooks.js`)

**Location:** `apps/kernel/src/shell/zenbu-loader-hooks.js`

Handles two virtual URL schemes:

**`zenbu:plugins?config=<path>`** — Reads `config.json`, emits a synthetic ESM module with one `import` statement per plugin manifest:

```js
import "zenbu:barrel?manifest=%2FUsers%2F...%2Fzenbu.plugin.json"
```

Watches the config file via dynohot's `context.hot.watch()` so adding/removing plugins triggers re-evaluation.

**`zenbu:barrel?manifest=<path>`** — Reads a `zenbu.plugin.json` manifest, expands service globs, and emits side-effect imports for each service file:

```js
import "file:///Users/.../src/main/services/db.ts"
import "file:///Users/.../src/main/services/window.ts"
// ... one per service file
```

Also supports nested JSON manifests (recursive barrel loading) and watches manifest files + glob parent directories for changes.

### 2. TSX

Provides TypeScript compilation so `.ts` and `.tsx` files can be imported directly in Node.js. Configured with the nearest `tsconfig.json` from the first plugin manifest.

### 3. Advice Loader (`@zenbu/advice/node`)

**Location:** `packages/advice/src/node-loader.ts`

A Babel transform that rewrites top-level function declarations and exports. For each function `foo`, it inserts:
- `__zenbu_def(moduleId, "foo", foo)` — registers the implementation
- `__zenbu_ref(moduleId, "foo")` — returns a stable wrapper that dispatches through the advice chain

Only processes `.ts/.tsx/.js/.jsx` files under `process.cwd()`, excluding `node_modules` and the advice package itself.

### 4. Dynohot

**Location:** `packages/dynohot/`

The core HMR engine. When a module is imported with `{ with: { hot: "import" } }`:

1. **Transform**: Rewrites static imports into dynamic bindings. Every access to an imported value goes through a getter (the `$` proxy) that returns the latest version of the export.

2. **Watch**: Sets up a file watcher. When a file changes on disk, dynohot busts the module cache and re-imports it.

3. **Swap**: After re-import, all live `$` references now point to the new module's exports. This is transparent to consuming code—like ESM live bindings, but mutable across reloads.

4. **Controller**: The root import returns a controller object. Calling `controller.main()` executes the actual module graph. This deferred execution pattern lets dynohot set up watching before any code runs.

The zenbu loader explicitly registers `config.json` and manifest files as watch targets, so dynohot's file watcher covers the entire plugin discovery path.

---

## Service System

**Location:** `packages/init/src/main/runtime.ts`

The service system is the heart of Zenbu. It solves the fundamental problem of HMR: when code changes, how do you tear down the old version's resources and re-initialize cleanly?

### Service Class

Every backend module is a `Service` subclass:

```typescript
export abstract class Service {
  static key: string                          // unique identifier
  static deps: Record<string, DepEntry>       // named dependencies

  ctx: any                                    // injected dependency instances

  abstract evaluate(): void | Promise<void>   // called on every (re)evaluation
  shutdown(): void | Promise<void> {}         // called on teardown

  protected effect(key: string, setup: EffectSetup): void
  // registers a keyed effect; cleanup runs before next evaluation
}
```

### Effects

Effects are the primary mechanism for managing non-deterministic resources (servers, file watchers, event listeners). Like React's `useEffect`:

```typescript
evaluate() {
  this.effect("my-server", () => {
    const server = startServer()
    return () => server.close()   // cleanup
  })
}
```

On re-evaluation:
1. All previous effect cleanups run (`__cleanupAllEffects`)
2. `ctx` is re-injected with current dependency instances
3. `evaluate()` runs, registering fresh effects

### Dependencies

Services declare dependencies via `static deps`. Dependencies can be:
- A string key: `{ db: "db" }`
- A service class reference: `{ db: DbService }` (uses `DbService.key`)
- Optional: `{ db: optional(DbService) }` — `ctx.db` is `undefined` if not available

### DAG Initialization

The runtime computes a topological ordering of services using Kahn's algorithm. Services at the same "level" (no dependencies between them) evaluate in parallel via `Promise.all`. Services with unmet dependencies stay in `blocked` status until their deps are ready.

```
Level 0: [reloader, server]          ← no deps, evaluate in parallel
Level 1: [http, db, core-renderer]   ← depend on level 0
Level 2: [view-registry, rpc]        ← depend on level 1
Level 3: [window, router, agent]     ← depend on level 2
Level 4: [view-chat, view-quiz, ...] ← depend on view-registry
```

Circular dependencies are detected and throw an error.

### HMR Integration

When a service file changes on disk:

1. Dynohot re-imports the module, which calls `runtime.register(ServiceClass, import.meta.hot)`.
2. The runtime updates the definition and marks the key dirty.
3. `scheduleReconcile` batches dirty keys, computes affected services (the changed service + all transitive dependents), and re-evaluates them in topological order.
4. For existing instances: `Object.setPrototypeOf(instance, ServiceClass.prototype)` swaps in new methods while preserving instance state.
5. `hot.accept()` tells dynohot this module handles its own updates.
6. `hot.prune()` registers a callback to unregister the service if the module is removed.

### Singleton Runtime

```typescript
export const runtime: ServiceRuntime =
  (globalThis as any).__zenbu_service_runtime__ ??= new ServiceRuntime()
```

One runtime per process, accessible globally. The shell awaits `runtime.whenIdle()` after loading plugins and calls `runtime.shutdown()` on quit.

### Writing a Service

```typescript
import { Service, runtime } from "../runtime"
import { DbService } from "./db"

export class MyService extends Service {
  static key = "my-service"
  static deps = { db: DbService }
  declare ctx: { db: DbService }

  /** Public methods are automatically exposed via RPC, namespaced as rpc["my-service"].greet(...) */
  async greet(name: string) {
    return `Hello, ${name}`
  }

  evaluate() {
    this.effect("setup", () => {
      const interval = setInterval(() => { /* ... */ }, 1000)
      return () => clearInterval(interval)
    })
  }
}

runtime.register(MyService, (import.meta as any).hot)
```

---

## Plugin System

### How Plugins Are Modeled

The kernel is just a plugin. There is no special "core" code path—the kernel registers services through the same mechanism third-party plugins use.

### Plugin Manifest

Each plugin has a `zenbu.plugin.json`:

```json
{
  "services": [
    "src/main/services/*.ts"
  ]
}
```

The `services` array contains globs or paths to service files. These get expanded into side-effect imports by the zenbu loader, which causes each service to call `runtime.register()`.

### Loading Flow

```
~/.zenbu/config.json
  → zenbu:plugins?config=...     (virtual module: one import per manifest)
    → zenbu:barrel?manifest=...  (virtual module: one import per service file)
      → file:///path/to/service.ts  (actual service code, hot-reloadable)
```

Because `config.json` and each manifest file are watched by dynohot, the entire chain is reactive:
- Edit `config.json` to add a plugin → the virtual `zenbu:plugins` module re-evaluates → new barrel is imported → new services register
- Edit a manifest to add a service → the virtual `zenbu:barrel` re-evaluates → new service imports appear

### Installing a Plugin

The simplest path: clone a repo with a `zenbu.plugin.json`, add its manifest path to `~/.zenbu/config.json`. The service runtime handles the rest.

---

## View System

Views are how plugins render frontend UI. The main process manages Vite dev servers; the renderer (Electron's chromium) loads views in iframes.

### Components

**ReloaderService** (`packages/init/src/main/services/reloader.ts`): Manages Vite dev server instances. Each server gets an ID, root directory, and optional Vite config. The `@zenbu/advice` Vite plugin is injected into every server for frontend advice support.

**ViewRegistryService** (`packages/init/src/main/services/view-registry.ts`): Maps scope names to URLs/ports. Two registration modes:
- `register(scope, root, configFile?)` — creates a new Vite dev server
- `registerAlias(scope, reloaderId, pathPrefix)` — shares an existing server at a subpath (most common)

**CoreRendererService** (`packages/init/src/main/services/core-renderer.ts`): Creates the single `"core"` Vite dev server rooted at `packages/init/src/renderer/`, using the existing `vite.config.ts`. This one server serves the orchestrator and all kernel views.

### How Views Get Registered

Most kernel views use aliases on the core server:

```typescript
// view-chat.ts
export class ViewChatService extends Service {
  static key = "view-chat"
  static deps = { viewRegistry: ViewRegistryService }

  evaluate() {
    this.ctx.viewRegistry.registerAlias("chat", "core", "/views/chat")
  }
}
```

This tells the system: the "chat" view is served from the core Vite server at `/views/chat/index.html`.

### Orchestrator

**Location:** `packages/init/src/renderer/orchestrator/`

The orchestrator is the root UI that Electron loads. It is **not** a registered view—it is loaded directly by `WindowService` from the core Vite server:

```
${coreEntry.url}/orchestrator/index.html?wsPort=${http.port}&cwd=${cwd}
```

The orchestrator:
1. Connects to the main process via WebSocket (using `wsPort`)
2. Establishes RPC and Kyju DB replica connections over the same socket
3. Reads `viewRegistry` from Kyju to discover available views
4. Reads `views` from Kyju to know which tabs are open
5. Renders each view in an iframe: `${entry.url}/index.html?id=${viewId}&wsPort=${wsPort}`

Each iframe (view) independently connects to the same WebSocket, getting its own RPC and Kyju replica. This means views are fully isolated—they can crash without taking down the orchestrator.

### Frontend HMR

Views get standard Vite HMR with React Refresh since they're served by Vite dev servers. Edit a React component in `src/renderer/views/chat/` and it hot-reloads in the iframe.

> **TODO**: The orchestrator is currently hardcoded as the base UI, not a registered view. In the future it should be migrated to also be a view, so users can replace the entire shell UI through the plugin system.

---

## Kyju Database

**Location:** `packages/kyju/`

Kyju is a reactive database designed for cross-process state synchronization—the critical bridge between Electron's main process and renderer process(es). It persists JSON data to disk, replicates it to renderer iframes over WebSocket, and provides reactive React bindings.

### Core Concepts

- **Main process**: `DbService` creates the authoritative database at `packages/init/.zenbu/db/`. It discovers plugin schemas, runs migrations, and serves replication events.
- **Schema**: Each plugin defines a Zod-backed schema using `createSchema()` + `f` helpers. The kernel's schema lives at `packages/init/shared/schema/index.ts`.
- **Sections**: In production, the DB is **sectioned**—each plugin owns a namespace under `root.plugin.<name>`. The on-disk `root.json` looks like `{ plugin: { kernel: {...}, "my-plugin": {...} }, _plugins: { sectionMigrator: { kernel: { version: 6 }, ... } } }`.
- **Renderer**: Each iframe creates a **replica** that is eventually consistent with the main DB.
- **Transport**: A single WebSocket carries both DB sync events (`{ ch: "db", data }`) and RPC messages (`{ ch: "rpc", data }`).
- **React bindings**: `useDb((root) => root.plugin.kernel.viewRegistry)` provides reactive access. When the main process updates a field, the change propagates to all connected replicas and React re-renders.

### Cross-Process Flow

```
Main Process                    WebSocket                 Renderer (iframe)
─────────────                   ─────────                 ─────────────────
DbService.client.update(...)  → { ch: "db", data } →   replica receives event
                                                          useDb() re-renders
```

This eliminates the need for Electron's `ipcMain`/`ipcRenderer` for application data. IPC is only used for bootstrap-level concerns (relaunch).

### Schema System

**Location:** `packages/kyju/src/v2/db/schema.ts`

Schemas are defined with `createSchema()` and the `f` helper (a proxy around Zod that wraps constructors in `Field` with optional `.default()`):

```typescript
import { createSchema, f } from "@zenbu/kyju/schema"
import zod from "zod"

export const appSchema = createSchema({
  views: f.array(zod.object({ id: zod.string(), title: zod.string() })).default([]),
  sidebarOpen: f.boolean().default(false),
  flashcards: f.collection(zod.object({ id: zod.string(), front: zod.string(), back: zod.string() })),
  // ...
})

export const schema = appSchema
export type AppSchema = InferSchema<typeof appSchema>
export type SchemaRoot = InferRoot<AppSchema>
```

Three field kinds:

| Kind | Created with | Runtime value in root |
|------|-------------|----------------------|
| **data** | `f.string()`, `f.array(...)`, `f.record(...)`, etc. | The actual JSON value |
| **collection** | `f.collection(itemSchema)` | `{ collectionId: string, debugName: string }` — a reference to a separate paginated collection |
| **blob** | `f.blob()` | `{ blobId: string, debugName: string }` — a reference to a binary blob |

The `InferRoot<Schema>` type maps the schema shape to a TypeScript type, expanding collection/blob refs and marking fields without defaults as optional.

**Important:** The schema module must export either `schema` or a default export with a `.shape` property. This is what both the CLI and the runtime `discoverSections()` look for.

### Migrations

**Location:** `packages/kyju/src/v2/migrations.ts`, `packages/kyju/src/v2/core-plugins/migration.ts`

Kyju uses a migration system to evolve the database schema over time. Migrations are **not** applied automatically when you change the schema—you must generate them with the CLI.

A migration is a TypeScript file that exports a `KyjuMigration` object:

```typescript
const migration: KyjuMigration = {
  version: 3,       // 1-indexed, matches position in the migrations array
  operations: [     // declarative ops (add/remove/alter fields)
    { op: "add", key: "workspaces", kind: "data", hasDefault: true, default: [] },
    { op: "alter", key: "views", changes: { typeHash: { from: "d2a0...", to: "42be..." } } },
  ],
  migrate(prev, { apply }) {   // optional custom transform for alter ops
    return apply(prev)
  },
}
```

**Operation types:**

| Op | What it does |
|----|-------------|
| `add` | Adds a new field (data with optional default, collection, or blob) |
| `remove` | Removes a field and its backing collection/blob if applicable |
| `alter` | Records that a field's type hash or default changed. `apply()` handles add/remove but alter is a **no-op** in `apply`—custom `migrate()` must handle real data transforms |

At runtime, `sectionMigrationPlugin` reads each section's version from `_plugins.sectionMigrator.<name>.version` in the DB root, applies pending migrations in order, and bumps the version.

### Kyju CLI

**Location:** `packages/kyju/src/cli/`
**Binary:** `kyju` (built to `packages/kyju/dist/bin.cjs`)
**Kernel shortcut:** `pnpm kyju:generate` from `packages/init/`

The CLI has two commands:

#### `kyju generate`

The primary command. It diffs your current schema against the last known state and generates a migration file.

```bash
# From the package that has a kyju.config.ts:
pnpm kyju:generate
# Or with options:
kyju generate --name add_workspaces --custom
```

**Flags:**
- `--name <tag>` — custom migration name (becomes the filename suffix, e.g. `0004_add_workspaces.ts`)
- `--custom` — always generates an editable `migrate()` function, even if only adds/removes are detected
- `--amend` — replace the last migration instead of creating a new one (like `git commit --amend`)
- `--config <path>` — explicit path to `kyju.config.ts` (default: auto-detect in CWD)

**What it does step by step:**

1. Loads `kyju.config.ts` to find the schema module path and output directory
2. Imports the schema module and serializes every field into a **snapshot** (kind, type hash, default value)
3. Reads the **journal** (`meta/_journal.json`) to find the last migration index
4. Reads the **last snapshot** (`meta/<idx>_snapshot.json`) for the previous schema state
5. **Diffs** the previous snapshot against the current one to produce `MigrationOp[]`
6. If changes exist, writes three files:
   - **Migration file** (`<idx>_<tag>.ts`) — the actual migration with `operations` and optional `migrate()`
   - **Snapshot** (`meta/<idx>_snapshot.json`) — the post-migration schema fingerprint
   - **Journal entry** — appends `{ idx, tag, when }` to `meta/_journal.json`
7. Rewrites the **barrel file** (`index.ts`) to import all migrations in order

#### `kyju db`

An inspection/debug tool for reading the on-disk database. Subcommands: `root`, `collections`, `collection`, `blobs`, `blob`, `paths`, `op` (apply a JSON write op directly).

### Config File

**Location:** `kyju.config.ts` in the plugin package root (e.g. `packages/init/kyju.config.ts`)

```typescript
import { defineConfig } from "@zenbu/kyju/config"

export default defineConfig({
  schema: "./shared/schema/index.ts",   // path to the schema module
  out: "./kyju",                         // output directory for generated migrations
})
```

### Generated Artifacts Explained

After running `kyju generate`, the output directory (e.g. `packages/init/kyju/`) contains:

```
kyju/
├── index.ts                     # Barrel: imports all migrations, exports as array
├── 0000_migration.ts            # First migration (initial schema)
├── 0001_migration.ts            # Second migration
├── 0002_add_workspaces.ts       # Named migration
├── ...
└── meta/
    ├── _journal.json            # Ordered list of all migrations
    ├── 0000_snapshot.json       # Schema state after migration 0
    ├── 0001_snapshot.json       # Schema state after migration 1
    └── ...
```

#### Why the Journal Exists (`meta/_journal.json`)

The journal is the ordered manifest of all migrations. It tracks:
- **`idx`** — sequential index (matches the filename prefix `NNNN`)
- **`tag`** — human-readable name (from `--name` or defaults to `"migration"`)
- **`when`** — timestamp of generation

The CLI uses the journal to determine the next migration index and to find the last snapshot for diffing. The barrel `index.ts` is regenerated from the journal entries so the import order always matches the journal order.

```json
{
  "version": "1",
  "entries": [
    { "idx": 0, "tag": "migration", "when": 1775623591359 },
    { "idx": 1, "tag": "migration", "when": 1775701987531 },
    { "idx": 2, "tag": "add_workspaces", "when": 1775866227682 }
  ]
}
```

#### Why Snapshots Exist (`meta/<idx>_snapshot.json`)

Snapshots capture the **complete schema state after each migration**. Each snapshot records every field's kind, type hash (SHA-256 of the Zod definition's structural representation), default value, and whether it has a default.

The CLI does **not** diff against the live database—it diffs the **last snapshot** against a fresh serialization of the current schema source code. This means:
- Snapshots are the source of truth for "what did the schema look like at migration N?"
- If you change a field's Zod type, the type hash changes, and `generate` detects an `alter` op
- If you add a new key to `createSchema({...})`, `generate` detects an `add` op

Each snapshot also has `id` and `prevId` (UUIDs) forming a linked chain for integrity.

#### The Barrel File (`index.ts`)

Auto-generated. Imports every migration in order and exports them as an array:

```typescript
import m0 from "./0000_migration"
import m1 from "./0001_migration"
import m2 from "./0002_add_workspaces"

export const migrations = [m0, m1, m2]
```

This is what the plugin manifest's `"migrations"` field points to. At runtime, `DbService` imports this module to get the ordered migration list.

### Plugin Manifest Integration

The `zenbu.plugin.json` manifest ties schema and migrations to a plugin:

```json
{
  "name": "kernel",
  "services": ["src/main/services/*.ts"],
  "schema": "./shared/schema/index.ts",
  "migrations": "./kyju/index.ts"
}
```

At startup, `DbService.discoverSections()` reads `~/.zenbu/config.json`, loads each plugin's manifest, imports its `schema` and `migrations` modules, and assembles `SectionConfig[]` for `createDb()`.

### Type Linking via the Registry

**Location:** `~/.zenbu/registry/`, generated by `~/.zenbu/link.js`

The registry provides end-to-end type safety from the database schema all the way to React hooks in the frontend. It is generated—not hand-written.

#### How It Works

Running `bun run ~/.zenbu/link.js` from any plugin directory:

1. Finds the nearest `zenbu.plugin.json`
2. Reads the existing registry files (merging, not replacing)
3. For **services**: scans service files for `export class X extends Service` + `static key`, generates `~/.zenbu/registry/services.ts` with `ServiceRouter` type
4. For **DB sections**: reads each manifest's `schema` path, generates `~/.zenbu/registry/db-sections.ts` with `DbSections` and `DbRoot` types

**`db-sections.ts`** (generated):
```typescript
import type { SchemaRoot as KernelRoot } from "../plugins/zenbu/packages/init/shared/schema/index"
import type { SchemaRoot as FileViewerRoot } from "../plugins/file-viewer/src/schema"

export type DbSections = {
  kernel: KernelRoot;
  "file-viewer": FileViewerRoot;
}

export type DbRoot = { plugin: DbSections }
```

**`services.ts`** (generated): Maps every service class to its RPC methods via `ExtractRpcMethods<T>`.

#### How Plugins Consume It

The kernel's `tsconfig.local.json` maps `#registry/*` to `~/.zenbu/registry/*`:

```json
{
  "compilerOptions": {
    "paths": {
      "#registry/*": ["/Users/you/.zenbu/registry/*"]
    }
  }
}
```

Then throughout the codebase:
- `import type { DbRoot } from "#registry/db-sections"` — gives the full sectioned root type (`{ plugin: { kernel: {...}, ... } }`)
- `import type { ServiceRouter } from "#registry/services"` — gives typed RPC methods for all services

This means `useDb()` returns data typed as `DbRoot`, and `useRpc()` returns methods typed as `ServiceRouter`—both derived from actual source code, with go-to-definition working through to the real implementations.

#### When to Re-link

Run `bun run ~/.zenbu/link.js` from a plugin directory after:
- Adding or removing a service
- Adding or changing a schema
- Installing a new plugin

The link script merges incrementally—it only replaces the entries for the plugin you run it from, preserving all other plugins' entries.

### Workflow: Adding a Schema Field End-to-End

1. Edit `packages/init/shared/schema/index.ts` — add your field to `createSchema({...})`
2. Run `pnpm kyju:generate --name add_my_field` from `packages/init/`
3. The CLI generates a migration file, snapshot, and updates the journal + barrel
4. If the migration has `alter` ops, edit the generated `migrate()` function to transform existing data
5. Restart the app (or let HMR pick up the service changes) — `DbService` runs the new migration
6. Run `bun run ~/.zenbu/link.js` from the plugin directory to update registry types
7. Frontend code now has typed access to the new field via `useDb()`

---

## WebSocket Communication

**Location:** `packages/init/src/main/services/server.ts`, `http.ts`, `rpc.ts`

A single HTTP server with WebSocket upgrade serves all communication:

### Channels

Messages are JSON objects with a `ch` (channel) field:

| Channel | Purpose |
|---------|---------|
| `"db"` | Kyju database replication events |
| `"rpc"` | Typed RPC calls (main router) |

### RPC (Auto-Typed Service RPC)

**Location:** `packages/init/src/main/services/rpc.ts`, `packages/init/src/main/runtime.ts`

Every public method on a `Service` subclass is automatically exposed as an RPC endpoint, namespaced by the service's `static key`. There is no manual router—the runtime builds it dynamically from all live service instances.

#### How It Works

1. **Auto-Router**: `ServiceRuntime.buildRouter()` iterates all ready service instances, collects their public methods (excluding lifecycle methods like `evaluate`/`shutdown`, anything starting with `_`, and private/protected members), and returns a nested `{ [serviceKey]: { [methodName]: fn } }` object compatible with zenrpc's `AnyRouter`.

2. **RpcService** calls `runtime.buildRouter()` on every incoming request. When a service is added, removed, or hot-reloaded, the router automatically reflects the change—no wiring needed.

3. **Registry-based types**: `~/.zenbu/registry/services.ts` imports the actual service classes and exports a `ServiceRouter` type using a mapped `ExtractRpcMethods<T>` utility type. This file is generated by running `bun run ~/.zenbu/link.js` from a plugin directory. Go-to-definition follows through to the actual service method implementations.

#### Adding an RPC Method

Just add a public method to any service. It is automatically available over RPC and typed on the frontend:

```typescript
export class MyService extends Service {
  static key = "my-service"
  static deps = { db: DbService }
  declare ctx: { db: DbService }

  async doSomething(viewId: string, text: string) {
    // This is callable from the frontend as rpc["my-service"].doSomething(viewId, text)
    return { ok: true }
  }

  evaluate() { /* ... */ }
}
```

Methods are excluded from RPC if they are: `evaluate`, `shutdown`, `constructor`, `effect`, private, protected, or prefixed with `_`.

After adding a service, re-run `bun run ~/.zenbu/link.js` from the plugin directory to update the registry types.

#### Frontend Usage

`packages/init/src/renderer/lib/providers.ts` exports a typed `useRpc()` hook:

```typescript
import type { ServiceRouter } from "#registry/services"

export type RpcType = RouterProxy<ServiceRouter> & {
  [service: string]: { [method: string]: (...args: any[]) => Promise<any> }
}
```

The intersection type gives full autocomplete for known services while allowing dynamic calls to unknown plugin services without `as any`. Frontend calls are namespaced by service key:

```typescript
const rpc = useRpc()
await rpc.agent.send(viewId, text)          // typed
await rpc.installer.getInstalledPlugins()   // typed
await rpc["my-plugin"].someMethod()         // untyped but works at runtime
```

#### Third-Party Plugins

When a third-party plugin is installed:
1. Its service files are loaded by the loader chain, services call `runtime.register()`
2. The auto-router immediately includes the new service's methods (runtime—works instantly)
3. Run `bun run ~/.zenbu/link.js` from the plugin directory to add its types to the registry
4. The frontend gets type safety for the new service's RPC methods

Before linking, the fallback index signature allows `rpc.myPlugin.myMethod(...)` to work—just without autocomplete.

### Renderer Connection

`packages/init/src/renderer/lib/ws-connection.ts`:

Each iframe reads `?wsPort=` from its URL, opens `ws://127.0.0.1:${wsPort}`, and multiplexes:
- `connectRpc<ServiceRouter>` — typed RPC proxy (types from registry)
- `connectReplica<AppSchema>` — Kyju DB replica

Both share the same WebSocket, discriminated by `{ ch: "rpc" | "db" }`.

---

## Agent System

Agents are external processes that can interact with and modify the application. They communicate via the **Agent Client Protocol** (ACP), a JSON-RPC-based protocol over NDJSON stdio streams.

### Architecture

```
Zenbu Main Process
  └── AgentService
        └── Agent (per chat view)
              └── AcpClient
                    └── spawns child process (e.g. codex-acp binary)
                          └── NDJSON over stdin/stdout
```

### ACP Client (`packages/agent/`)

`AcpClient` (`src/client.ts`): Spawns an agent subprocess with `stdio: ["pipe", "pipe", "inherit"]`, wraps stdin/stdout in Web Streams, creates an NDJSON stream, and establishes a `ClientSideConnection` from `@agentclientprotocol/sdk`.

The client handles:
- `sessionUpdate` — streaming updates from the agent
- `requestPermission` — agent requesting approval for actions
- `readTextFile` / `writeTextFile` — filesystem access

`Agent` (`src/agent.ts`): Higher-level wrapper that manages session lifecycle (initialize → newSession/loadSession → prompt), queues messages, and persists session IDs via `AgentStore`.

### Kernel Integration (`packages/init/src/main/services/agent.ts`)

`AgentService` maintains a map of agents per chat view. When a user sends a message:
1. Resolves which agent to use from the view's `agentId` or `selectedAgentId`
2. Parses the agent's `startCommand` into command + args
3. Creates an `Agent` if one doesn't exist for this view
4. Calls `agent.send([{ type: "text", text }])`
5. Session updates are streamed into Kyju's `events` collection

### Codex Bridge (`packages/codex-acp/`)

Bridges Codex's `app-server` protocol to ACP. Runs as the agent subprocess:
- stdin/stdout carry ACP NDJSON
- Internally spawns `codex app-server` and translates between Codex's line-JSON-RPC and ACP methods
- Maps: `newSession` → `thread/start`, `prompt` → `turn/start`, streaming → `sessionUpdate`

### Why Agents Are Core

Agents are part of the kernel (not a separate plugin) because they are the primary mechanism for modifying the app itself. The workflow:
1. User asks the agent to add a feature
2. Agent modifies source files in the cloned repo
3. Dynohot detects changes, hot-reloads the affected services
4. The app updates live

This creates a self-modifying system where the AI agent is the user's interface for extending Zenbu.

---

## Advice System

**Location:** `packages/advice/` (transform + runtime), `packages/init/src/main/services/advice-config.ts` (plugin API)

Inspired by Emacs advice, this system lets plugins intercept, wrap, or replace any top-level function at runtime—in any view. The mental model is Chrome extensions for views: a plugin registers advice targeting a function in a view, and the system injects code into the view's iframe before any application code runs.

### How It Works

A Babel transform (applied by both the Node loader and the Vite plugin) rewrites every top-level function:

**Before:**
```typescript
export function handleMessage(msg: string) { /* ... */ }
```

**After (conceptual):**
```typescript
__zenbu_def("module-id", "handleMessage", function handleMessage(msg) { /* ... */ })
export const handleMessage = __zenbu_ref("module-id", "handleMessage")
```

`__zenbu_ref` returns a **stable wrapper function** that dispatches through an advice chain. The same function reference is returned for the same `moduleId + name` across calls—critical for React Refresh component identity.

The `moduleId` is the file path relative to the Vite root (`packages/init/src/renderer/`). For example, `views/chat/components/ToolCallCard.tsx`.

### Replacement vs Impl

`FunctionEntry` has two function slots:

- **`impl`** — set by `__def()` (the compile-time transform). Updated on every HMR re-evaluation.
- **`replacement`** — set by `replace()` (plugin API). Takes precedence over `impl` and is **not** cleared by `__def()`.

This separation is critical: a plugin's prelude script calls `replace()` before the view's modules load. When the modules evaluate, `__def()` updates `impl` but the `replacement` field is untouched. The advice chain dispatches to `replacement ?? impl`.

### Plugin API (`packages/init/src/main/services/advice-config.ts`)

This is a plain module (not a service) that plugins import directly:

```typescript
import { registerAdvice } from "@zenbu/init/src/main/services/advice-config"

// Replace a component entirely
const remove = registerAdvice("chat", {
  moduleId: "views/chat/components/ToolCallCard.tsx",
  name: "ToolCallCard",
  type: "replace",
  modulePath: "/absolute/path/to/my-replacement.tsx",
  exportName: "ToolCallCard",
})

// Wrap a component (around advice)
const remove2 = registerAdvice("orchestrator", {
  moduleId: "views/orchestrator/components/TabBar.tsx",
  name: "Tab",
  type: "around",
  modulePath: "/absolute/path/to/my-wrapper.tsx",
  exportName: "TabWrapper",
})
```

Parameters:
- **`scope`** — which view to target: `"chat"`, `"orchestrator"`, `"shell"`, etc.
- **`moduleId`** — the target function's file path relative to the Vite root
- **`name`** — the target function name
- **`type`** — `"replace"`, `"before"`, `"after"`, or `"around"`
- **`modulePath`** — absolute path to the plugin's replacement/wrapper module
- **`exportName`** — named export from that module

The replacement module is a normal `.tsx`/`.ts` file compiled by Vite. It can import React, use JSX, import other modules—anything a normal view component can do.

For `around` advice, the exported function receives `(originalFn, ...args)`:

```typescript
export function TabWrapper(Original: any, props: any) {
  return (
    <div style={{ border: "2px solid red" }}>
      {Original(props)}
    </div>
  )
}
```

### Runtime API (`packages/advice/src/runtime/index.ts`)

Lower-level API used by the generated prelude code. Plugins typically use `registerAdvice` instead.

```typescript
import { replace, unreplace, advise } from "@zenbu/advice/runtime"

replace("module-id", "functionName", newImplementation)
unreplace("module-id", "functionName")

const remove = advise("module-id", "functionName", "around", (next, ...args) => {
  return next(...args)
})
```

### Injection Mechanism

When a view loads, the Vite plugin (`advicePreludePlugin` in `reloader.ts`) handles the full pipeline:

1. **`transformIndexHtml`** — detects the view scope from the URL path (e.g., `/views/chat/index.html` → `"chat"`), injects `<script type="module" src="/@advice-prelude/chat">` into the `<head>`.

2. **Middleware** — intercepts the `/@advice-prelude/<scope>` request, calls `server.transformRequest()` which invokes the plugin's `resolveId` and `load` hooks.

3. **`load`** — generates code that imports the replacement modules and calls `replace()`/`advise()`. The code goes through Vite's full transform pipeline (TypeScript compilation, React plugin, etc.).

4. **Execution order** — the prelude script is injected at the end of `<head>` (after Vite client and React Refresh preamble, before `<body>` scripts). Module scripts execute in document order, so: Vite client → React Refresh → prelude (`replace()`) → `main.tsx` (`__def()`, then render dispatches to replacement).

### Auto-Reload

Two mechanisms ensure views update when advice changes:

- **Replacement file edits** — Vite's file watcher detects the change. The `handleHotUpdate` hook matches the file against registered advice entries and sends a `full-reload` to connected clients.

- **Service config changes** (e.g., switching from `replace` to `around`) — the service re-evaluates via dynohot, calls `registerAdvice` which invalidates the prelude virtual module in Vite's module graph and emits a ZenRPC event. The view receives the event and calls `location.reload()`. On reload, Vite calls `load()` fresh (because the module was invalidated) and gets the updated entries.

### Discovery

The advice registry is exposed on `globalThis` in every view for debugging:

```javascript
// In browser devtools console:
[...__zenbu_advice_registry__.keys()]  // all moduleIds
__zenbu_advice_registry__.get("views/chat/components/ToolCallCard.tsx")?.get("ToolCallCard")
```

---

## Content Script System

**Location:** `packages/init/src/main/services/advice-config.ts`

Content scripts are the simpler counterpart to advice: instead of targeting a specific function, they inject an arbitrary Vite-compiled module into a view on load. Like Chrome extension content scripts with `run_at: "document_start"`.

### API

```typescript
import { registerContentScript } from "@zenbu/init/src/main/services/advice-config"

// Inject into a specific view
const remove = registerContentScript("chat", "/absolute/path/to/my-widget.tsx")

// Inject into ALL views
const remove2 = registerContentScript("*", "/absolute/path/to/global-init.ts")
```

The module is a normal `.tsx`/`.ts` file compiled by Vite. It runs in the view's iframe context and can do anything—mount React components, add event listeners, modify the DOM:

```tsx
import { createRoot } from "react-dom/client"

function MyWidget() {
  return <div style={{ position: "fixed", bottom: 20, right: 20 }}>Hello from plugin</div>
}

const el = document.createElement("div")
document.body.appendChild(el)
createRoot(el).render(<MyWidget />)
```

### How It Works

Content scripts share the same prelude infrastructure as advice. When `registerContentScript("chat", path)` is called, the prelude `load` hook appends `import "/absolute/path/to/module.tsx"` to the generated code. The module goes through Vite's full transform pipeline.

The `"*"` scope injects into every view. Internally, `getContentScripts(scope)` merges global scripts with scope-specific scripts.

### Auto-Reload

Same two mechanisms as advice:
- Editing the content script file triggers Vite HMR → `handleHotUpdate` → full-reload
- Service config changes (registering/unregistering scripts) → invalidate + RPC event → view reloads

---

## Mode System

Inspired by Emacs major and minor modes, Zenbu has a lightweight mode system that lets any plugin or service declare what "mode" the application is currently in. Modes are stored as plain Kyju database fields—reactive, replicated, and accessible from both the main process and every view.

### Concepts

- **Major mode** (`majorMode: string`): A single string representing the application's primary operational context. Only one major mode is active at a time. Any service or plugin can set it. Examples: `"chat"`, `"editor"`, `"browse"`, `"settings"`. Defaults to `"fundamental-mode"`—the base mode with no special behavior, just like Emacs.

- **Minor modes** (`minorModes: string[]`): An array of strings representing secondary, composable behaviors layered on top of the major mode. Multiple minor modes can be active simultaneously. Examples: `"vim"`, `"zen"`, `"debug"`, `"recording"`. Defaults to `[]`.

### Schema

The fields live in the kernel schema (`packages/init/shared/schema/index.ts`):

```typescript
majorMode: f.string().default("fundamental-mode"),
minorModes: f.array(zod.string()).default([]),
```

### Usage

**Main process** (from any service):

```typescript
this.ctx.db.client.update((root) => {
  root.plugin.kernel.majorMode = "chat"
  root.plugin.kernel.minorModes = ["vim", "zen"]
})
```

**Frontend** (from any view):

```typescript
const majorMode = useDb((root) => root.plugin.kernel.majorMode)
const minorModes = useDb((root) => root.plugin.kernel.minorModes)
```

### Why Modes Exist

Modes give plugins a shared coordination primitive. Rather than each plugin inventing its own state flags, modes provide a single global "what is the app doing right now?" that any plugin can read and react to:

- **Keybinding dispatch**: A keybinding plugin can check the major mode to decide which keymap is active (e.g., `"chat"` mode binds `Enter` to send, `"editor"` mode binds `Enter` to newline).
- **UI adaptation**: Views can show/hide elements based on the active mode. A toolbar plugin might render different actions when `"debug"` is in minor modes.
- **Agent behavior**: An agent can check the current mode to decide context—knowing the user is in `"editor"` mode vs `"chat"` mode changes what tools are relevant.
- **Plugin interop**: Plugins that don't know about each other can still coordinate. Plugin A sets a minor mode `"recording"`, plugin B notices and adjusts its behavior.

The design is intentionally minimal—just two DB fields. There is no mode registry, no enforcement of valid mode names, no lifecycle hooks. Any code that can write to the database can set a mode, and any code that can read the database can react to it. Coordination emerges from convention, not from the framework.

---

## Plugin Registry

**Location:** `registry.jsonl` (repo root)

A line-delimited JSON file cataloging available plugins:

```jsonl
{"name": "kernel", "description": "...", "repo": "https://github.com/RobPruzan/zenbu"}
```

This is read by `getPluginRegistry` in `main-router.ts` and exposed to the frontend via RPC. It is separate from `~/.zenbu/config.json` (which tracks *installed* plugins). The registry is a catalog of *available* plugins—think of it like a package registry.

The registry is a git-tracked file in this repo. To add a plugin, you make a PR adding a line with the plugin's git repo URL.

> **TODO**: Add commit lock fields to registry entries so installations pin to a specific commit for reproducibility and security.

---

## Updates

Because the app is just a git repo cloned to `~/.zenbu/plugins/zenbu`, updating is `git pull`. When the upstream repo receives a push, users pull to get the latest code. Dynohot picks up the file changes and hot-reloads affected services and views—no restart required for most changes.

### Current Flow

1. Upstream pushes new commits to the repo.
2. User runs `git pull` inside `~/.zenbu/plugins/zenbu`.
3. Changed files trigger dynohot's file watcher → services re-evaluate, Vite HMR updates views.
4. The app is now running the latest code.

### Agent-Assisted Merge Conflicts

Users modify their local repo (that's the whole point of Zenbu). When upstream pushes changes that touch the same files, `git pull` can produce merge conflicts. Manual conflict resolution is tedious and error-prone, so Zenbu will use agents to handle this automatically.

The planned flow:

1. Before pulling, inspect incoming commits to determine whether any would conflict with local changes. This can be checked per-commit against the current working tree ahead of time.
2. If no conflicts: pull cleanly, done.
3. If conflicts are detected: hand off to an agent with full context:
   - The complete commit data (diffs, messages) for every incoming commit
   - The local modifications that conflict
   - Any code comments explaining intent
4. The agent resolves conflicts using the commit data as ground truth for what was intended. This is why **commit messages and code comments must be extremely verbose and explicit about human intention**—they serve as instructions to the merge agent.
5. After resolution, the agent completes the merge.

This is closely related to the [Plugin Setup Method](#plugin-setup-method)—both involve an agent intelligently merging code changes where traditional patches would be brittle.

> **TODO**: Build UI for triggering updates (a "pull" button or automatic update check). Currently updates are manual `git pull` in the terminal.

> **TODO**: Implement the conflict detection + agent-assisted resolution pipeline. The agent needs an API to inspect incoming commits, detect conflicts before they happen, and perform the merge with full access to commit metadata.

---

## Future Work

These are known gaps and planned improvements documented for future reference:

### Plugin Setup Method
Services should support an optional `setup()` method for first-time installation. If a plugin hasn't been properly set up (determined by the service itself), the system would provide an API to use an agent for setup—e.g., patching view code to include new components, resolving merge conflicts, etc. This is needed because traditional patches are brittle; agent-assisted setup can intelligently merge code changes.

### Registry Commit Locks
`registry.jsonl` entries should include a commit hash to pin installations. Currently there's no version pinning—cloning a plugin repo gets `HEAD`.

### Plugin Orchestrator Slots
The orchestrator could expose a slot/metadata system (e.g., `"sidebar"`, `"main"`, `"toolbar"`) so views can declare where they want to be rendered. For views that need placement beyond the available slots, the orchestrator itself could have a plugin system (second-order plugins) or be replaced entirely via the advice system.

### Dynamic Code Execution
The content script system handles static injection (code that runs on view load). A future extension would support runtime execution—sending code to execute in a specific view's iframe on demand, like `chrome.tabs.executeScript()`. The prelude could inject a listener that accepts dynamic import requests over the existing RPC event channel.
