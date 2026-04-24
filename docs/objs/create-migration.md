# Create a Kyju Database Migration

## What You're Doing

Writing a migration to evolve the database schema—adding, removing, or modifying fields in the Kyju database. Migrations run automatically when the app starts and the stored version is behind.

## Background

### How Migrations Work

Migrations are an ordered array exported from `packages/init/kyju/index.ts`. The migration plugin reads the stored version from `root._plugins.kyjuMigrator.version` (defaults to 0) and runs each migration from that index up to `migrations.length - 1`.

**Ordering is by array index, not by the `version` field.** The `version` number on each migration is for documentation/generator use. What matters is position in the array.

### Two Styles of Migration

1. **Declarative (`operations`)** — Declare what to add/remove. The runtime applies them.
2. **Custom (`migrate`)** — A function that receives the previous root data and returns the new root. Use this when you need to transform existing data.

You can combine both: `operations` for structural changes, `migrate` for data transforms.

### The Barrel and Version Padding

The migrations barrel (`packages/init/kyju/index.ts`) may contain `noop` entries to pad the array when earlier development left the stored version ahead of the real migration count:

```typescript
const noop: KyjuMigration = { version: 0 }
export const migrations = [m0, noop, noop, m1, m2]
```

New migrations are always appended to the end.

## Steps

### Option A: Manual Migration

#### 1. Create the Migration File

Create `packages/init/kyju/NNNN_description.ts` where `NNNN` is the next sequential number:

**Declarative (adding fields):**

```typescript
import type { KyjuMigration } from "#zenbu/kyju/migrations"

const migration: KyjuMigration = {
  version: 4,
  operations: [
    { op: "add", key: "myField", kind: "data", hasDefault: true, default: "hello" },
  ],
}

export default migration
```

**Custom (transforming data):**

```typescript
import type { KyjuMigration } from "#zenbu/kyju/migrations"

const migration: KyjuMigration = {
  version: 4,
  migrate: (prev) => {
    const data = { ...prev }

    if (Array.isArray(data.views)) {
      data.views = data.views.map((view: any) => ({
        ...view,
        newProp: view.newProp ?? "default",
      }))
    }

    return data
  },
}

export default migration
```

**Combined:**

```typescript
import type { KyjuMigration } from "#zenbu/kyju/migrations"

const migration: KyjuMigration = {
  version: 4,
  operations: [
    { op: "add", key: "myNewCollection", kind: "collection" },
  ],
  migrate: (prev, { apply }) => {
    const data = apply(prev)
    data.existingField = transformSomehow(data.existingField)
    return data
  },
}

export default migration
```

When both are present, `migrate` receives an `apply` function that runs the declarative operations. Call `apply(prev)` first, then do your custom transforms.

#### 2. Add to the Barrel

Edit `packages/init/kyju/index.ts`:

```typescript
import m0 from "./0000_initial"
import m1 from "./0001_add_agent_id_and_mock_acp"
import m2 from "./0002_add_view_registry"
import m3 from "./0003_my_new_migration"
import type { KyjuMigration } from "#zenbu/kyju/migrations"

const noop: KyjuMigration = { version: 0 }

export const migrations = [m0, noop, noop, m1, m2, m3]
```

Append `m3` at the end. The migration runs at index 5 (for a database currently at version 5).

### Option B: CLI Generator

The `kyju generate` command diffs the current schema against the last snapshot and generates a migration automatically.

```bash
cd packages/kernel
pnpm kyju generate --name add_my_field
```

This requires `packages/init/kyju.config.ts`:

```typescript
import { defineConfig } from "#zenbu/kyju/config"

export default defineConfig({
  schema: "./shared/schema/index.ts",
  out: "./kyju",
})
```

The generator:
1. Loads the schema from the config path
2. Compares against the last snapshot in `kyju/meta/`
3. Writes a new migration file, snapshot, and journal entry
4. Regenerates the barrel `kyju/index.ts`

The generator handles `add` and `remove` operations. For `alter` operations (changing field types), it creates a stub that requires manual editing.

## Operation Types

| Operation | When to Use |
|-----------|------------|
| `{ op: "add", key: "name", kind: "data", hasDefault: true, default: value }` | Adding a new data field |
| `{ op: "add", key: "name", kind: "collection" }` | Adding a new collection |
| `{ op: "add", key: "name", kind: "blob" }` | Adding a new blob |
| `{ op: "remove", key: "name", kind: "data" }` | Removing a data field |
| `{ op: "remove", key: "name", kind: "collection" }` | Removing a collection |

## Real Examples

**Declarative — adding `viewRegistry`** (`0002_add_view_registry.ts`):
```typescript
const migration: KyjuMigration = {
  version: 3,
  operations: [
    { op: "add", key: "viewRegistry", kind: "data", hasDefault: true, default: [] },
  ],
}
```

**Custom — data transform** (`0001_add_agent_id_and_mock_acp.ts`):
```typescript
const migration: KyjuMigration = {
  version: 2,
  migrate: (prev) => {
    const data = { ...prev }
    const agents = Array.isArray(data.agents) ? [...data.agents] : []
    if (!agents.some((a: any) => a.id === "mock-acp")) {
      agents.push({
        id: "mock-acp",
        name: "Mock Agent",
        startCommand: "npx tsx node_modules/#zenbu/mock-acp/src/index.ts",
      })
    }
    data.agents = agents
    if (Array.isArray(data.views)) {
      data.views = data.views.map((view: any) => {
        if (!view.agentId) return { ...view, agentId: data.selectedAgentId ?? "codex-acp" }
        return view
      })
    }
    return data
  },
}
```

## Checklist

- [ ] Migration file created in `packages/init/kyju/`
- [ ] Exported as `default` with `version`, and `operations` and/or `migrate`
- [ ] Added to the `migrations` array in `packages/init/kyju/index.ts` (appended at the end)
- [ ] Corresponding schema field added/updated in `shared/schema/index.ts`
- [ ] Tested by deleting the DB (`/tmp/zenbu-desktop-db`) and restarting, or by running against an existing DB
