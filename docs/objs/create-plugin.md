# Create a Standalone Plugin

## What You're Doing

Creating a plugin in its own git repository that can be installed alongside the kernel. In Zenbu, the kernel itself is just a plugin—your plugin uses the exact same system.

## Background

### What Is a Plugin?

A plugin is a directory with a `zenbu.plugin.json` manifest that lists service files. When the manifest path is added to `~/.zenbu/config.json`, the shell's loader chain imports all listed service files, and each one registers with the shared `ServiceRuntime`.

### How Discovery Works

The shell reads `~/.zenbu/config.json`, which contains an array of absolute paths to `zenbu.plugin.json` manifests. For each manifest, the zenbu loader expands the `services` globs into side-effect imports:

```
config.json → zenbu:plugins (virtual module)
  → zenbu:barrel per manifest (virtual module)
    → import each service .ts file
      → runtime.register() in each file
```

All service files from all plugins share the same `ServiceRuntime` instance (`globalThis.__zenbu_service_runtime__`). Services from different plugins can depend on each other by key.

### The Loader Chain

Four loaders process every import in order:
1. **Zenbu loader** — resolves `zenbu:` virtual modules (config → manifest → barrel)
2. **TSX** — compiles TypeScript
3. **Advice** — Babel transform for function interception
4. **Dynohot** — HMR proxy wrapping + file watching

Your plugin code goes through all four, so it gets TypeScript support, advice transforms, and hot reloading automatically.

## Steps

### 1. Create the Repository Structure

```
my-plugin/
├── package.json
├── tsconfig.json
├── zenbu.plugin.json
├── setup.sh              (optional)
└── src/
    └── services/
        └── my-service.ts
```

### 2. Write `zenbu.plugin.json`

```json
{
  "services": [
    "src/services/*.ts"
  ]
}
```

The `services` array supports:
- **Globs**: `"src/services/*.ts"` — all `.ts` files in the directory
- **Direct paths**: `"src/services/specific.ts"`
- **Nested manifests**: `"other/zenbu.plugin.json"` — recursively loads another manifest

### 3. Write `package.json`

```json
{
  "name": "my-zenbu-plugin",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "dependencies": {}
}
```

The `package.json` is required because the shell uses it to find the project root (walks up from the manifest looking for `package.json`). This affects `process.cwd()` and TypeScript resolution.

If your plugin needs npm packages, add them as dependencies here.

### 4. Write `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

The shell finds the nearest `tsconfig.json` from the first plugin manifest and passes it to TSX.

### 5. Write Service Files

Service files follow the same pattern as kernel services. Import from the init package using the `@testbu/` alias (resolved at runtime by the alias loader, and at type-check time by `tsconfig.local.json`):

```typescript
import { Service, runtime } from "@testbu/init/src/main/runtime"
import { DbService } from "@testbu/init/src/main/services/db"

export class MyPluginService extends Service {
  static key = "my-plugin-service"
  static deps = { db: DbService }
  declare ctx: { db: DbService }

  evaluate() {
    this.effect("setup", () => {
      console.log("[my-plugin] running")
      return () => console.log("[my-plugin] cleaning up")
    })
  }
}

runtime.register(MyPluginService, (import.meta as any).hot)
```

You can also depend on kernel services by string key to avoid import path issues:

```typescript
static deps = { db: "db" }
declare ctx: { db: any }
```

### 6. (Optional) Write `setup.sh`

If your plugin has dependencies that need installation:

```bash
#!/bin/bash
set -e
echo "Installing my-plugin dependencies..."
pnpm install
echo "Setup complete."
```

The `InstallerService` will run this when `node_modules` is missing under the plugin root.

### 7. Install the Plugin

See the `install-plugin` command. The short version: add the absolute path to your `zenbu.plugin.json` to `~/.zenbu/config.json`:

```json
{
  "plugins": [
    "/Users/you/.zenbu/plugins/zenbu/packages/init/zenbu.plugin.json",
    "/path/to/my-plugin/zenbu.plugin.json"
  ]
}
```

### Adding Views from a Plugin

A plugin can register views by depending on `ViewRegistryService`. For a view with its own Vite server (not sharing the kernel's core server):

```typescript
import { Service, runtime } from "@testbu/init/src/main/runtime"
import { ViewRegistryService } from "@testbu/init/src/main/services/view-registry"

export class MyViewService extends Service {
  static key = "my-plugin-view"
  static deps = { viewRegistry: ViewRegistryService }
  declare ctx: { viewRegistry: ViewRegistryService }

  async evaluate() {
    this.effect("view", () => {
      const entry = this.ctx.viewRegistry.register(
        "my-plugin-view",
        "/path/to/my-plugin/src/renderer",
      )
    })
  }
}
```

`register()` (not `registerAlias()`) creates a new Vite dev server for this view's source directory.

### Portable Resolution: How `@testbu/` Works

Plugins are fully portable — they can live anywhere on the filesystem and work on any computer. This is achieved through three resolution layers:

**Main process (services):** The shell's alias loader intercepts `@testbu/*` imports and resolves them to `~/.zenbu/plugins/zenbu/packages/*`. It also intercepts `@zenbu/*` imports and resolves them using each package's `exports` map. No hardcoded paths needed in plugin source.

**Renderer (views):** Each plugin's `vite.config.ts` sets a resolve alias using `os.homedir()`:

```typescript
import os from "node:os"
import path from "node:path"

const packagesDir = path.join(os.homedir(), ".zenbu", "plugins", "zenbu", "packages")

export default defineConfig({
  resolve: {
    alias: {
      "@testbu": packagesDir,
      "@": path.join(packagesDir, "init", "src", "renderer"),
    },
  },
})
```

**CSS (shadcn/UI components):** Import the shared stylesheet in your plugin's `app.css`:

```css
@import "tailwindcss";
@import "@testbu/init/src/renderer/styles/shadcn.css";
```

This single import gives you CSS variables, base styles, and Tailwind class scanning for all UI components — the `@source` directives inside `shadcn.css` use relative paths that resolve correctly regardless of where your plugin lives.

**TypeScript (IDE):** `tsconfig.local.json` is gitignored and generated per machine (by `setup.sh` or manually). It maps `@testbu/*` to the local monorepo path for IDE type-checking.

## Checklist

- [ ] `zenbu.plugin.json` with `services` array
- [ ] `package.json` at the plugin root
- [ ] `tsconfig.json` extending `./tsconfig.local.json`
- [ ] `tsconfig.local.json` (gitignored, generated per machine)
- [ ] `vite.config.ts` with `@testbu` alias via `os.homedir()` (if plugin has views)
- [ ] `app.css` importing `@testbu/init/src/renderer/styles/shadcn.css` (if using UI components)
- [ ] Service files that import from `@testbu/init/...` and call `runtime.register()`
- [ ] Plugin manifest path added to `~/.zenbu/config.json`
