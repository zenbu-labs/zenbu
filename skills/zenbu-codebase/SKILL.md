---
name: zenbu-codebase
description: Use when the user is editing the Zenbu app source, writing or modifying a Zenbu plugin, or invoking the `zen` CLI; or when the working directory is inside `~/.zenbu/plugins/`. Do not use for unrelated coding tasks. The skill indexes the codebase: directory layout, kernel services, the renderer hierarchy, the plugin model (including workspace-scoped plugins), the schema/DB, the advice system, and the `zen` CLI.
---

# Zenbu codebase index

Zenbu is an Electron desktop app. The kernel and every feature on top of it
are written as **plugins**: directories containing a `zenbu.plugin.json`
manifest plus service / view / schema files. The kernel itself is a plugin
(`packages/init`), and uses the same registration surface everything else
does. All TypeScript modules — main process, renderer, agent — hot-reload
on save (dynohot for the main process, Vite HMR for views).

## 1. Mental model

```
~/.zenbu/                               ← user-local install root
├── config.jsonc                        ← lists plugin manifest paths
├── registry/                           ← `zen link` writes typed barrels here
│   ├── services.ts                     ← typed ServiceRouter
│   ├── db-sections.ts                  ← typed DbRoot
│   └── preloads.ts
└── plugins/
    ├── zenbu/                          ← the kernel monorepo (this repo)
    └── <other-plugins>/                ← third-party plugins (independent repos)
```

The runtime architecture, top-down:

1. **Electron shell** (`apps/kernel/src/shell/`) — only precompiled code.
   Reads `config.jsonc`, registers the loader chain
   (zenbu virtual-module loader → tsx → advice transform → dynohot HMR),
   then dynamic-imports the virtual `zenbu:plugins` module. That module
   is generated from `config.jsonc` and side-effect-imports each plugin's
   service files.
2. **Service runtime** (`packages/init/src/main/runtime.ts`) —
   a `ServiceRuntime` singleton on `globalThis`. Each plugin file does
   `runtime.register(MyService, import.meta.hot)` at module bottom.
   Dependencies form a DAG; effects run on first evaluate and re-run on
   hot reload.
3. **Kyju DB** (`packages/kyju`) — reactive SQLite-backed database
   replicated over a WebSocket to every renderer. Schema is composed
   from per-plugin sections at `root.plugin.<plugin-name>.*`. Reads /
   writes from main are imperative; reads from the renderer go through
   `useDb(selector)`.
4. **Renderer** — every UI is a Vite-served React page loaded as an
   iframe. Each iframe opens one WebSocket back to the kernel that
   multiplexes RPC and DB-replica frames. Iframes are isolated per tab
   subdomain (`tabid.localhost:<wsPort>`), so cookies / localStorage
   don't collide.

The renderer hierarchy that the user sees:

```
Orchestrator (root, full window)
├── TitleBar (top, full width)
└── flex-row
    ├── WorkspaceSidebar (vertical icon rail of user workspaces)
    └── Workspace iframe (one per active workspace, cached)
        ├── AgentList (left, agent rows filtered by workspace cwds)
        ├── chat / new-agent / plugins iframe (center, the active tab)
        └── Utility sidebar (right: rail of icons + optional panel)
```

Tabs in a pane can be one of:

- A real chat session — `tabId === sessionId`, routes to scope `chat`.
- A `new-agent:<nanoid>` sentinel — a transient onboarding view for
  picking a cwd before promoting to a real agent. Routes to scope
  `new-agent`.
- A `scope:<name>:<nanoid>` sentinel — opens an arbitrary registered
  view (e.g. `scope:plugins:...` for the plugin manager).

## 2. Repository layout

```
packages/init                  THE kernel plugin: services, schema, renderer
  shared/
    schema/index.ts            kernel DB schema (workspaces, windows, agents…)
    agent-ops.ts               pure agent-list helpers
  src/main/
    runtime.ts                 ServiceRuntime, Service base class, DAG init
    services/                  every file is a Service subclass
    preload.ts                 startup preload hooks
  src/renderer/
    lib/
      ws-connection.ts         WebSocket multiplexer (rpc + db channels)
      kyju-react.ts            useDb / useCollection
      providers.ts             useRpc / useKyjuClient
      view-cache.tsx           ViewCacheSlot — iframe cache + projection
      shortcut-handler.ts      useShortcutHandler
      drag-region.ts           useDragRegion (window drag through iframes)
    views/
      orchestrator/            root window UI
      workspace/               per-workspace UI (agent list + chat + util)
      chat/                    chat conversation UI
      new-agent/               cwd picker + composer onboarding view
      plugins/                 plugin manager view
      composer-debug/          dev-only composer debug view
      …
    vite.config.ts             the "core" multi-page Vite config

packages/agent                 ACP client + Agent abstraction (Effect-based)
packages/kyju                  reactive DB primitives + schema DSL
packages/advice                Babel transform + runtime for function interception
packages/dynohot               ESM HMR (rewrites imports to live proxies)
packages/zenrpc                typed RPC over WebSocket
packages/zen                   the `zen` CLI
packages/claude-acp / codex-acp / mock-acp
                               ACP bridges to specific LLM CLIs
apps/kernel                    Electron shell (precompiled boot loader)
```

Authoritative deeper reference: `~/.zenbu/plugins/zenbu/DOCS.md`.

## 3. The plugin model

A plugin is a directory with a `zenbu.plugin.json`. Minimum manifest:

```json
{
  "name": "my-plugin",
  "services": ["src/services/*.ts"]
}
```

Optional fields the kernel reads:

| Field | Purpose |
|---|---|
| `services` | Glob (or list of paths) of service files. Each is side-effect-imported and registers itself. |
| `schema` | Path to a `createSchema(...)` module → defines this plugin's DB section at `root.plugin.<name>.*`. |
| `migrations` | Path to a generated migrations index (created by `zen kyju generate`). |
| `setup` | `{ "script": "./setup.ts", "version": <int> }` — one-time host setup, run via the bundled `bun`. Bumping `version` re-runs it. |
| `preload` | Module whose default-async-export runs **before** plugin services evaluate. Result is read with `getPreload(name)`. |
| `requiredVersion` | Semver range; if the kernel is older the boot window shows a kernel-upgrade screen. |

The kernel itself uses this surface — its manifest is
`packages/init/zenbu.plugin.json`.

### Two ways to install a plugin

1. **Globally**, via `~/.zenbu/config.jsonc`. The plugin's services
   load eagerly at boot and stay loaded for the lifetime of the app.
   This is how kernel and most third-party plugins are installed.
2. **Per workspace**, via a `.zenbu/zenbu.plugin.json` (or
   `.zenbu/<sub>/zenbu.plugin.json`) in any of the workspace's cwds.
   These plugins are **lazy**: they load when the workspace becomes
   active and unload when it deactivates. Their advice and views only
   apply to that workspace's iframe.

## 4. Workspaces

Schema fields (kernel root):

```ts
workspaces:               { id, name, cwds: string[], createdAt, icon }[]
activeWorkspaceByWindow:  Record<windowId, workspaceId>
sidebarOpenByWindow:      Record<windowId, boolean>
lastTabByWorkspace:       Record<workspaceId, tabId>
utilitySidebarSelectedByWindow: Record<windowId, scope>
```

A workspace is an **explicit, user-created entity** with a name and one
or more cwds. It is **not** auto-derived from anything. The
`WorkspaceService` (`packages/init/src/main/services/workspace.ts`)
exposes:

- `createWorkspace(name, cwds)` — inserts a row, kicks off icon scan.
- `deleteWorkspace(id)` — unloads scoped plugins, removes the row.
- `activateWorkspace(windowId, workspaceId)` — atomically:
  1. Deactivates the previous workspace for this window (unloads its
     plugins if no other window still has it active).
  2. Sets `activeWorkspaceByWindow[windowId] = workspaceId`.
  3. Restores `pane.activeTabId` to that workspace's last-viewed tab
     (`lastTabByWorkspace[workspaceId]` if still in the pane and the
     agent's cwd matches; otherwise the most-recent tab in this
     workspace's cwds).
  4. Loads any `.zenbu/zenbu.plugin.json` plugins discovered in the
     workspace's cwds, tagged with the workspace id.
- `ensureWorkspaceIcon(workspaceId)` — best-effort favicon scan
  (Next.js `app/icon.svg`, `public/favicon.ico`, etc.) that stores
  the bytes as a kyju blob and writes `workspace.icon`.
- `setWorkspaceIcon(workspaceId, blobId, origin)` — user override.
  `origin: "override"` always wins over `"scanned"`.

Workspace tracking — written by the workspace iframe whenever its
active tab changes:

```
lastTabByWorkspace[currentWorkspaceId] = pane.activeTabId
```

(non-sentinel only; `new-agent:` and `scope:` tabs are skipped).

## 5. Service runtime

`Service` (in `packages/init/src/main/runtime.ts`):

```ts
export class MyService extends Service {
  static key = "my-service"               // RPC namespace
  static deps = { db: DbService }         // resolved DAG-style
  declare ctx: { db: DbService }

  evaluate() {
    // Idempotent — re-runs on hot reload. State on `this` survives.
    this.setup("interval", () => {
      const id = setInterval(() => {}, 1000)
      return () => clearInterval(id)      // cleanup on re-eval / shutdown
    })
  }

  // Public methods are auto-exposed as `rpc.my-service.<method>`
  async hello(name: string) { return `hi ${name}` }
}

runtime.register(MyService, (import.meta as any).hot)
```

Rules:

- **`evaluate()` must be idempotent.** Hot reload calls it again on the
  same instance. Guard side-effectful resource creation with `if`s, or
  put it in `setup()`.
- **`setup(key, fn)` is the equivalent of `useEffect` for services.**
  The cleanup runs before the next `setup(key, …)` and on shutdown.
- **Public method = RPC method.** Anything not starting with `_` and
  not on `Service.prototype` becomes `rpc.<key>.<methodName>`. Run
  `zen link` after adding/removing public methods.
- **Optional dependencies** via `optional(OtherService)` from
  `runtime.ts`. `ctx.other` is `undefined` if the service isn't
  registered.
- **Workspace-scoped registration** uses
  `runtime.scopedImport(workspaceId, importFn)`. Any `register()` call
  inside the import inherits that workspace id. The runtime tags the
  ServiceSlot, lets `unregisterByWorkspace(workspaceId)` tear them
  down later. Workspace plugins don't need to know about this — they
  call plain `runtime.register(...)`; the kernel's `WorkspaceService`
  wraps the dynamic import in `scopedImport`.

## 6. Renderer

Every view is a Vite-served React page loaded inside an iframe.

| View | Scope | Where |
|---|---|---|
| Orchestrator (root) | `orchestrator` | `views/orchestrator/` |
| Workspace container | `workspace` | `views/workspace/` |
| Chat conversation | `chat` | `views/chat/` |
| New-agent onboarding | `new-agent` | `views/new-agent/` |
| Plugin manager | `plugins` | `views/plugins/` |

All five share one Vite dev server (the "core" server). They are
multi-page entries in `views/.../vite.config.ts` and registered as
aliases via `ViewRegistryService.registerAlias(scope, "core", "/views/<name>")`.
Plugins that want their own view source tree can call
`ViewRegistryService.register(scope, root, configFile, meta?)` instead,
which spins up a dedicated Vite dev server.

`meta: { sidebar: true }` makes a registered view appear as an icon in
the workspace's right utility sidebar.

### Iframe wiring

`ViewCacheSlot` (`lib/view-cache.tsx`) is the only correct way to
render a view iframe in another view's React tree. It maintains a
process-wide cache of `<iframe>` elements parented to a
fixed-position body-level container, then projects each iframe onto
the calling slot's bounding rect. Reparenting would reload the iframe;
caching avoids that. The slot accepts an optional `iframeStyle` prop —
useful for things like `borderRadius` that the placeholder div can't
clip (the iframe lives outside the slot's DOM subtree).

### Reading and writing state

Inside any view:

```ts
const rpc = useRpc()              // typed rpc from #registry/services
const client = useKyjuClient()    // imperative kyju client
const ws = useDb(root => root.plugin.kernel.windowStates)
                                  // reactive selector subscription
```

`useDb` selectors run on every committed change and only re-render
when the selected value differs (`Object.is`). Always do `.find` /
filter inside the selector, not after — outside selectors lose their
element types.

### Title bar behaviour

The orchestrator's title bar lives at the top of the window and is
draggable (macOS traffic lights at `(20, 20)`). Inside it: a
sidebar-toggle, reload menu, and an agent picker. The chat view has
its own thin title bar (`project / summary` + a sidebar-toggle that
appears only when the workspace's agent list is collapsed). Above the
chat content, a 16px linear-gradient band fades scrolled content into
the chrome.

## 7. Schema and DB

The kernel schema is at `packages/init/shared/schema/index.ts`. Notable
fields:

- `workspaces`, `activeWorkspaceByWindow`, `lastTabByWorkspace`,
  `sidebarOpenByWindow`, `utilitySidebarSelectedByWindow` — workspace
  state.
- `windowStates[*]` — pane / session layout per window. Sessions =
  `{ id (== tabId), agentId, lastViewedAt }`. Panes = leaf | split.
- `viewRegistry` — snapshot synced from `ViewRegistryService`.
- `composerDrafts`, `composerPending` — chat composer state.
- Spread from `agentSchemaFragment` (in `packages/agent/src/schema.ts`):
  `agents`, `agentConfigs`, `archivedAgents`, `hotAgentsCap`,
  `skillRoots`. Read/write at `root.plugin.kernel.<field>`.

Per-plugin sections live at `root.plugin.<plugin-name>.*`. Each plugin
that wants storage declares its own `schema.ts`, runs
`zen kyju generate` to emit a migration into its `kyju/` dir, then
`zen link` to plumb the types into `~/.zenbu/registry/db-sections.ts`.

Inspect the on-disk DB:

```bash
zen kyju db --db /path/to/.zenbu/db root
```

(Default kernel DB path is
`packages/init/.zenbu/db` when the dev kernel is running.)

## 8. Advice and content scripts

The advice transform rewrites every top-level function in any view's
source so that calls go through a per-`(moduleId, name)` chain. A
plugin can then `replace`, `before`, `after`, or `around` any of those
functions without touching the source file.

Server-side API (`packages/init/src/main/services/advice-config.ts`):

```ts
registerAdvice(scope, {
  moduleId: "views/orchestrator/App.tsx",   // path relative to the view's Vite root
  name: "OrchestratorContent",
  type: "around",
  modulePath: "/abs/path/wrapper.tsx",
  exportName: "Wrapper",
})

registerContentScript(scope, "/abs/path/script.tsx")
```

`scope` is the view's scope string (`"chat"`, `"orchestrator"`, …),
or `"*"` for content scripts that should load everywhere.

**Workspace-scoped advice.** When a workspace plugin registers
advice, the registration is automatically tagged with that workspace's
id (read from `runtime.getActiveScope()` during the service's
`evaluate()`). The advice prelude generator filters by workspace so
that:

- Global views (orchestrator, workspace sidebar) get only global
  advice.
- The workspace iframe and its descendants (chat, new-agent, etc.)
  get global advice + advice from the active workspace's plugins.

Provenance flows through the iframe URL: every iframe rendered inside
the workspace iframe carries `?workspaceId=<id>`, and the advice
prelude endpoint reads that query param and passes it to
`getAdvice(scope, workspaceId)`.

## 9. The `zen` CLI

Source: `packages/zen/src/`. Shim: `~/.zenbu/bin/zen`. Hot-editable:
edits to `packages/zen/src/**/*.ts` apply on the next invocation.

### Common subcommands

| Command | What it does |
|---|---|
| `zen` | Open a Zenbu window. Talks to the running app over zenrpc via `runtime.json`; spawns the Electron binary if not running. |
| `zen init <name>` | Scaffold a new plugin and register it in `config.jsonc`. |
| `zen init <name> --with db,view,advice,shortcut` | Scaffold with composable recipes (`packages/zen/templates/plugin/recipes/<name>/`). |
| `zen setup [--dir .]` | Re-run a plugin's `setup.ts`. If the app is running, surfaces a relaunch confirmation. |
| `zen link` | Regenerate `~/.zenbu/registry/{services,db-sections,preloads}.ts`. Run from any plugin dir. |
| `zen kyju generate [--name tag]` | Diff schema against last snapshot, emit migration. |
| `zen kyju db --db <path> <root \| collections \| collection \| ...>` | Inspect on-disk DB. |
| `zen doctor` | Re-run kernel `setup.ts` idempotently. Use after pulling new setup steps. |
| `zen config <get \| set> <key> [value]` | Read/write the zen-cli kyju section. |

### Common workflows

| After this change | Run |
|---|---|
| Edited a service / view / component source | nothing — dynohot or Vite HMR picks it up |
| Added or removed a public Service method | `zen link` |
| Added or removed a service file | `zen link` |
| Edited a `createSchema(...)` field | `zen kyju generate` then `zen link` |
| Changed `package.json` (new dep / version) | `zen setup --dir <plugin>` |
| Bumped `setup.version` to re-run setup | `zen setup` |
| Cleared `~/Library/Caches/Zenbu/` | `zen doctor` |

## 10. Conventions

- **Don't start the dev server.** Assume it's already running; it
  hot-reloads on save (main process included). If you break a file the
  app breaks. Make incremental edits that leave the system in a valid
  state at every save.
- **Use `ni`** to install npm packages (auto-detects pnpm/npm/bun).
  For plugin deps prefer `zen setup` so the relaunch bridge fires.
- **Plugin names** are kebab-case `/^[a-z][a-z0-9-]*$/`. Used as the
  schema section key, RPC namespace, and service file name.
- **No module-level mutable state in services.** Use `setup()`. Hot
  reload re-runs `evaluate()` on the same instance — module-level
  state survives but won't reflect the new code.
- **Avoid `as any`.** The DB section types and RPC types are
  generated; cast through proper types or fix the schema.
- **Comments and commit messages are instructions for future merge
  agents.** Pull conflicts will be resolved by an LLM reading the
  history; explicit intent matters.

## 11. Where third-party plugins live

`~/.zenbu/plugins/<name>/` — each is a standalone repo with its own
`zenbu.plugin.json`. Currently installed plugins are listed in
`~/.zenbu/config.jsonc`. The `zenbu` directory under there is the
kernel monorepo (this repo) — don't confuse it with a user plugin.

Existing plugins with useful patterns to copy:

- `~/.zenbu/plugins/minimap/` — the smallest possible plugin
  (one advice replacement).
- `~/.zenbu/plugins/commit-button/` — service + advice + RPC.
- `~/.zenbu/plugins/recent-agents/` — content script, shortcut,
  schema section.
- `~/.zenbu/plugins/quick-chat/` — advice that wraps
  `OrchestratorContent`, opens a floating window.

## 12. Portability

- Zenbu ships its own `bun` and `pnpm` at
  `~/Library/Caches/Zenbu/bin/`. `apps/kernel/src/shell/env-bootstrap.ts`
  exports `bootstrapEnv` which resolves them and exposes `ZENBU_BUN`,
  `ZENBU_PNPM` for plugin scripts to use.
- Hard system dependencies: only Xcode Command Line Tools (git, bash).
- Override the toolchain via `ZENBU_BUN`, `ZENBU_PNPM`, `ZENBU_GIT`
  env vars.
- Every plugin `setup.ts` must be idempotent and use the
  `##ZENBU_STEP:` protocol for progress reporting (so the UI can
  show progress bars).
