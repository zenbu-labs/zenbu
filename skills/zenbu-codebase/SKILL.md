---
name: zenbu-codebase
description: Use whenever you are touching the Zenbu codebase or answering questions about how it works — provides an index of key files, directories, services, and core concepts (loader chain, service system, plugin system, view system, Kyju reactive DB, agent system, advice, mode system, install model). Read the full SKILL.md first to orient yourself before making changes, so you edit the right file the first time.
---

# Zenbu codebase index

Zenbu is an Emacs-inspired Electron desktop app where every piece of the running
app — including the kernel — is a hot-reloadable plugin. The user clones a git
repo (`~/.zenbu/plugins/zenbu/`) and modifies any file; dynohot swaps the module
live without restart.

> Authoritative reference: `~/.zenbu/plugins/zenbu/DOCS.md`. Read it in full
> the first time you touch anything non-trivial. This file points at specific
> parts.

## Repository layout

```
~/.zenbu/
├── config.jsonc                     # lists plugin manifests to load
├── registry/                        # generated; zen link writes these
│   ├── services.ts                  # typed ServiceRouter across all services
│   └── db-sections.ts               # typed DbRoot across all plugin sections
└── plugins/
    ├── zenbu/                       # the main monorepo (kernel + tooling)
    │   ├── apps/kernel/             # Electron shell (only precompiled code)
    │   ├── packages/                # see below
    │   ├── registry.jsonl           # plugin catalog (name, description, repo)
    │   ├── DOCS.md                  # full architecture doc
    │   └── packages/init/setup.ts   # idempotent first-run installer (run via bun)
    └── <third-party plugins>/       # each with its own zenbu.plugin.json
```

## Packages you will touch most

| Package | What it is | Start here |
|---|---|---|
| `packages/init` | **The main plugin.** All core services + the React renderer. | `src/main/services/`, `src/renderer/` |
| `packages/agent` | ACP client + Agent abstraction (Effect-based). Skills live here. | `src/agent.ts`, `src/skills/` |
| `packages/kyju` | Reactive SQLite-backed DB with cross-process replication. | `src/v2/db/`, `src/v2/client/` |
| `packages/advice` | Emacs-style function interception (Babel transform + runtime). | `src/node-loader.ts`, `src/runtime/` |
| `packages/dynohot` | ESM HMR. Rewrites imports into live proxies. | (rarely edited) |
| `packages/zenrpc` | Typed RPC over WebSocket. | `src/` |
| `packages/claude-acp`, `packages/codex-acp`, `packages/mock-acp` | ACP bridges to specific LLM backends | — |
| `packages/zen` | The `zen` CLI (hot-editable). | `src/bin.ts` |
| `packages/ui` | Shared React primitives. | — |

## Where specific functionality lives

### Services (main process)
`packages/init/src/main/services/` — every file is a `Service` subclass. Public
methods are auto-exposed as RPC namespaced by `static key`. Hot-reloads via
`runtime.register(Cls, import.meta.hot)` at the bottom of each file.

| Concern | File |
|---|---|
| Database + sections + migration discovery | `db.ts` |
| HTTP + WebSocket server | `server.ts`, `http.ts` |
| Typed RPC auto-router | `rpc.ts` |
| Electron windows, dock, menus | `window.ts` |
| Vite dev servers for views | `reloader.ts` |
| View ↔ scope registry | `view-registry.ts` |
| The core (orchestrator+views) Vite server | `core-renderer.ts` |
| Agent lifecycle, ACP proxying, first-prompt skill preamble | `agent.ts` |
| Plugin installer (clones repo, runs setup.ts) | `installer.ts` |
| Advice + content script config | `advice-config.ts` |
| CLI socket (`zen` commands ↔ running app) | `cli-socket.ts`, `cli-intent.ts` |
| File scanner (non-gitignore-aware today) | `file-scanner.ts` |

The Service base class + DAG initializer lives at
`packages/init/src/main/runtime.ts`.

### Renderer (orchestrator + views)
`packages/init/src/renderer/`

| Concern | Location |
|---|---|
| Orchestrator root UI (iframe host, tabs, panes) | `orchestrator/App.tsx` |
| Chat view | `views/chat/` (components, plugins, ChatDisplay.tsx, Composer.tsx) |
| Minimap | `views/chat/components/MinimapContent.tsx` |
| Settings view | `views/settings/` |
| Shared hooks / providers (`useRpc`, `useDb`) | `lib/providers.ts`, `lib/ws-connection.ts` |
| Frontend advice registration | `orchestrator/advice/` |

Every view is a Vite-served page loaded in an iframe; it connects back to the
kernel over a single WebSocket that multiplexes `{ ch: "rpc" }` and
`{ ch: "db" }` frames.

### Schema + DB
- Kernel schema (authoritative root of most state): `packages/init/shared/schema/index.ts`
- Kernel migrations: `packages/init/kyju/`
- CLI: `zen kyju generate` (diff schema → new migration) and `zen kyju db <...>`
  for inspection.
- Kyju primitives live in `packages/kyju/src/v2/db/schema.ts` — `f.array`,
  `f.record`, `f.collection`, `f.blob`, `makeCollection(...)` for preallocating
  nested collection refs.

### Agents
- `packages/agent/src/agent.ts` — the `Agent` class (Effect-based lifecycle, ACP
  session management, event log, first-prompt preamble latch).
- `packages/agent/src/client.ts` — `AcpClient` (spawns subprocess, NDJSON).
- `packages/agent/src/skills/` — skill discovery (open spec `SKILL.md`,
  gitignore-aware) + routing-metadata formatter.
- `packages/init/src/main/services/agent.ts` — `AgentService`: process registry,
  config-option fanout, first-prompt latch (reads/writes `agent.firstPromptSentAt`
  on the DB record), default `skillRoots → ~/.zenbu/skills`.

### Advice + content scripts
- Transform: `packages/advice/src/node-loader.ts`, `src/vite-plugin.ts`
- Runtime: `packages/advice/src/runtime/`
- Plugin API: `packages/init/src/main/services/advice-config.ts`
  (`registerAdvice`, `registerContentScript`)

### Modes
- Schema fields: `majorMode: string`, `minorModes: string[]` on the kernel root.
- Read/write from anywhere that has the DB client.

## Philosophy — things that are load-bearing

1. **Every module is hot-reloadable.** Avoid module-level mutable state; put it
   in `Service` effects so cleanup runs on re-evaluation. Don't cache
   import-time values that should change on edit.
2. **Services wire themselves.** Don't write routers by hand; add a public
   method to a `Service` and it's automatically RPC-accessible after
   `zen link` regenerates types.
3. **The DB is the bus.** Main ↔ renderer sync is through Kyju, not `ipcMain`.
   If you need a view to react to main-process state, put it in the schema.
4. **Plugins get equal footing with the kernel.** The kernel is a plugin; it
   uses the same manifest + section system as third parties. Don't build
   special paths that only the kernel can take.
5. **Commit messages and code comments are instructions to future merge
   agents.** Pulls that conflict will be resolved by an LLM reading the
   history; explicit intent matters.

## Portability

- Zenbu ships its own `bun` + `pnpm` at `~/Library/Caches/Zenbu/bin/`.
  Set by `bootstrapEnv` in `apps/kernel/src/shell/env-bootstrap.ts`.
- Hard user-system deps: only Xcode Command Line Tools (git + bash).
- User overrides: `ZENBU_BUN`, `ZENBU_PNPM`, `ZENBU_GIT` env vars.
- All plugin `setup.ts` scripts inherit the isolated toolchain env.
- Every plugin's `setup.ts` must be idempotent and use the `##ZENBU_STEP:`
  protocol for progress reporting.

## Conventions — things to do (or not) when editing

- **Use `ni`** to install packages (auto-detects pnpm/npm/bun). Never run
  `npm install` / `pnpm install` directly.
- **Don't start the dev server** — assume the user already has it running.
  Zenbu hot-reloads on file save, main process included. If you break a file,
  the app breaks. Make incremental edits that leave the system in a valid state
  at every save.
- **Run `zen link`** after adding/removing a service or changing a schema — it
  regenerates `~/.zenbu/registry/{services,db-sections}.ts` so `useRpc`/`useDb`
  stay typed.
- **Run `zen kyju generate`** after changing a schema — writes a migration, a
  snapshot, and updates the journal + barrel.
- **Run `zen doctor`** after pulling a new `setup.ts` step (or trigger the update from the UI, which does the same thing and prompts Relaunch if deps changed).
- Plugin registry lives at `packages/zenbu/registry.jsonl` (newline-delimited
  JSON). To publish, PR a line with your plugin's git URL.

## Known gaps / future work

Documented at the bottom of `DOCS.md`:
- Service `setup()` method for first-time plugin installation.
- Commit-hash pinning in `registry.jsonl`.
- Orchestrator slot system (so views declare where they render).
- Dynamic code execution into a view's iframe (chrome.tabs.executeScript analog).
- Agent-assisted merge conflict resolution on `git pull`.
