# Use the Kyju CLI

## What You're Doing

Inspecting and debugging the Kyju database from the command line. The CLI lets you dump the root state, list collections, inspect blobs, and run debug write operations.

## Background

### Where the Database Lives

The kernel's database is at the OS temp directory:

```
/tmp/zenbu-desktop-db       (macOS/Linux)
```

This path is set in `packages/init/src/main/services/db.ts` as `path.join(os.tmpdir(), "zenbu-desktop-db")`.

### The CLI Binary

The `kyju` binary is provided by the `#zenbu/kyju` package. The kernel's `package.json` has a script `"kyju": "kyju"` for convenience.

## Commands

### Inspect the Root State

Dump the entire root object (all top-level fields):

```bash
cd packages/kernel
pnpm kyju db --db /tmp/zenbu-desktop-db root
```

### List Collections

Show all collections with their page counts and item counts:

```bash
pnpm kyju db --db /tmp/zenbu-desktop-db collections
```

### Dump a Collection

List items in a specific collection:

```bash
pnpm kyju db --db /tmp/zenbu-desktop-db collection events
pnpm kyju db --db /tmp/zenbu-desktop-db collection events --json
pnpm kyju db --db /tmp/zenbu-desktop-db collection events --page 0
```

### List Blobs

```bash
pnpm kyju db --db /tmp/zenbu-desktop-db blobs
```

### Read a Blob

```bash
pnpm kyju db --db /tmp/zenbu-desktop-db blob <field-or-id>
```

### Show File Paths

Print the filesystem paths for root, collections, and blobs:

```bash
pnpm kyju db --db /tmp/zenbu-desktop-db paths
```

### Debug Write Operation

Apply a raw write operation (for debugging only):

```bash
pnpm kyju db --db /tmp/zenbu-desktop-db op '{"op":"add","key":"test","kind":"data","hasDefault":true,"default":"hello"}'
```

### Generate a Migration

Diff the current schema against the last snapshot and generate a migration file:

```bash
cd packages/kernel
pnpm kyju generate --name my_migration_name
```

This requires `kyju.config.ts` in the current directory:

```typescript
import { defineConfig } from "#zenbu/kyju/config"

export default defineConfig({
  schema: "./shared/schema/index.ts",
  out: "./kyju",
})
```

## Resetting the Database

To start fresh, delete the database directory while the app is not running:

```bash
rm -rf /tmp/zenbu-desktop-db
```

On next startup, `createDb` creates a fresh database and runs all migrations from scratch.

## Common Debugging Patterns

**Check if a migration ran:**
```bash
pnpm kyju db --db /tmp/zenbu-desktop-db root | grep kyjuMigrator
```
The `_plugins.kyjuMigrator.version` field shows how many migrations have been applied.

**Check view registry state:**
```bash
pnpm kyju db --db /tmp/zenbu-desktop-db root | grep viewRegistry
```

**Check agent session data:**
```bash
pnpm kyju db --db /tmp/zenbu-desktop-db collection events --json
```
