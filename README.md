<p align="center">
  <img src="./docs/logo.png" alt="Zenbu" width="180" />
</p>

# Zenbu

![status: beta](https://img.shields.io/badge/status-beta-orange)

The extensible coding agent GUI.

<p align="center">
  <img src="./docs/screenshot.webp" alt="Zenbu" />
</p>

## Installation

Download the latest build from [zenbu.dev/download](https://www.zenbu.dev/download) or [GitHub Releases](https://github.com/zenbu-labs/zenbu/releases). Open the app and it sets itself up under `~/.zenbu/` on first launch.

## Configuring agents

Zenbu ships with **codex**, **claude**, **cursor**, **opencode**, and **copilot** preinstalled. It assumes you've already authenticated whichever one you want to use through its own CLI. You can add more agents (that are [acp compatible](https://agentclientprotocol.com/get-started/registry)) inside Zenbu Settings.

## Plugins

Zenbu is built out of plugins. Each plugin is a folder with its own manifest, code, and UI, and `~/.zenbu/config.jsonc` tracks which ones are loaded by absolute path. They can live anywhere on disk; by convention they go under `~/.zenbu/plugins/<name>/`. The core app is built the same way: it's a plugin that registers services, views, and schema just like any other.

Browse the marketplace inside the app to install a plugin with one click, or run `zen init <name>` from the terminal to scaffold your own. The current catalog lives in [`registry.jsonl`](./registry.jsonl).

## `zen` CLI

The installer adds `zen` to your PATH. The common commands:

```bash
zen                     # open a new window
zen --agent claude      # open with a specific agent
zen init my-plugin      # scaffold a new plugin
zen doctor              # re-run setup if something looks off
zen link                # regenerate registry types after editing a service or schema
```

### Inspect the database

Zenbu's state lives in a local reactive database. `zen kyju db` dumps it from the terminal:

```bash
zen kyju db root                # full root document
zen kyju db collections         # list every collection
zen kyju db collection <id>     # page through a collection
```

When you change a plugin's schema, generate a migration with:

```bash
zen kyju generate --name add_my_field
```

### Script the running app

`zen exec` runs TypeScript against a live RPC connection to the running app. `rpc` (typed) and `events` are bound in scope, so you can call any service method or subscribe to events without setting up a socket yourself:

```bash
zen exec -e 'console.log(await rpc.cli.listAgents())'
zen exec -e 'const a = await rpc.cli.listAgents(); console.log(a.agents.length)'
zen exec ./my-automation.ts
```

Run `zen --help` for the full list of subcommands.

## Some notes

Very early project. Expect lots of bugs.

The plugin API is not yet stable and incomplete.

If an agent breaks your code, `git stash` inside `~/.zenbu/plugins/zenbu`, or delete `~/.zenbu/` and the app will reinstall itself on next launch.

## Plugin API

Work in progress. See [`DOCS.md`](./DOCS.md) for the current reference.
