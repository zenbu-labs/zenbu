# Install a Plugin

## What You're Doing

Adding a third-party plugin to your Zenbu installation so its services load alongside the kernel.

## Background

### How Plugin Loading Works

The shell reads `~/.zenbu/config.json` on startup. This file lists absolute paths to `zenbu.plugin.json` manifests. For each manifest, the shell's loader chain imports all service files, which register with the shared `ServiceRuntime`.

Because `config.json` is watched by dynohot, adding a new manifest path while the app is running will trigger a re-evaluation of the virtual plugin root, importing the new plugin's services live.

### What `config.json` Looks Like

```json
{
  "plugins": [
    "/Users/you/.zenbu/plugins/zenbu/packages/init/zenbu.plugin.json"
  ]
}
```

The file lives at `~/.zenbu/config.json`. Each entry is an absolute path to a plugin's `zenbu.plugin.json` manifest.

## Steps

### 1. Clone the Plugin Repository

```bash
git clone <plugin-repo-url> ~/.zenbu/plugins/<plugin-name>
```

You can clone anywhere, but `~/.zenbu/plugins/` is the conventional location.

### 2. Install Dependencies

```bash
cd ~/.zenbu/plugins/<plugin-name>
# if the plugin has a setup.sh:
bash setup.sh
# otherwise:
pnpm install   # or npm install, etc.
```

### 3. Add the Manifest to Config

Edit `~/.zenbu/config.json` to include the plugin's manifest path:

```json
{
  "plugins": [
    "/Users/you/.zenbu/plugins/zenbu/packages/init/zenbu.plugin.json",
    "/Users/you/.zenbu/plugins/<plugin-name>/zenbu.plugin.json"
  ]
}
```

If the app is running, the config file change is detected by dynohot's file watcher. The virtual `zenbu:plugins` module re-evaluates, importing the new plugin's services. They register with the runtime, the dependency graph is rebuilt, and the new services evaluate in the correct order.

If the app is not running, the plugin will load on next startup.

### 4. Verify

The plugin's services should log their startup messages in the Electron main process console (View > Toggle Developer Tools in the app, or check terminal output).

You can also check via RPC in the Settings dialog, which calls `getInstalledPlugins()` to list all loaded plugins and their service counts.

## Removing a Plugin

Remove its manifest path from `~/.zenbu/config.json`. Dynohot detects the config change, the virtual module re-evaluates without the removed plugin's imports, and dynohot's prune callbacks trigger `runtime.unregister()` for each of that plugin's services.

## Plugin Registry

The file `registry.jsonl` at the repo root catalogs known plugins:

```jsonl
{"name": "kernel", "description": "...", "repo": "https://github.com/RobPruzan/zenbu"}
```

This is a discovery catalog only—it does not affect loading. The Settings dialog reads this via `getPluginRegistry()` RPC to show available plugins with links to their repos. Installing still requires the manual steps above.
