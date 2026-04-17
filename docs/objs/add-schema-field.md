# Add a Field to the Database Schema

## What You're Doing

Adding a new field to the Kyju database schema so you can store and read data across the main process and all renderer views.

## Background

### What Is Kyju?

Kyju is a reactive SQLite-backed database designed for cross-process state. The main process holds the authoritative database; each renderer iframe holds an eventually-consistent replica. Changes propagate over WebSocket in real time.

### The Schema

The schema is defined in `packages/init/shared/schema/index.ts` using `createSchema` and the `f` helper from `@zenbu/kyju/schema`. The `f` proxy wraps Zod types and adds Kyju-specific field descriptors.

### Field Types

| Helper | What it creates | Example |
|--------|----------------|---------|
| `f.string()` | String field | `f.string().default("")` |
| `f.boolean()` | Boolean field | `f.boolean().default(false)` |
| `f.array(zodSchema)` | Array of objects | `f.array(zod.object({ id: zod.string() })).default([])` |
| `f.record(keySchema, valueSchema)` | Key-value map | `f.record(zod.string(), zod.string()).default({})` |
| `f.collection<T>()` | Append-only collection (paginated) | `f.collection<{ id: string; text: string }>()` |
| `f.blob()` | Binary blob | `f.blob()` |

Fields with `.default(value)` are initialized to that value when the database is created or migrated. Fields without defaults must be added via migration with explicit initial values.

### Schema Changes Require Migrations

When you add a field to the schema, existing databases don't have that column. You need a migration to add it. Without a migration, the field exists in TypeScript types but not in stored data.

## Steps

### 1. Add the Field to the Schema

Edit `packages/init/shared/schema/index.ts`:

```typescript
import zod from "zod"
import { createSchema, f, type InferSchema } from "@zenbu/kyju/schema"

export const appSchema = createSchema({
  // ... existing fields ...

  myNewField: f.string().default("initial value"),
  // or
  myList: f.array(zod.object({
    id: zod.string(),
    name: zod.string(),
    value: zod.number(),
  })).default([]),
  // or
  myCollection: f.collection<{
    id: string
    timestamp: number
    payload: string
  }>(),
})
```

### 2. Create a Migration

Create a new migration file in `packages/init/kyju/`. See the `create-migration` command for full details. The short version:

Create `packages/init/kyju/NNNN_add_my_field.ts`:

```typescript
import type { KyjuMigration } from "@zenbu/kyju/migrations"

const migration: KyjuMigration = {
  version: N,
  operations: [
    { op: "add", key: "myNewField", kind: "data", hasDefault: true, default: "initial value" },
  ],
}

export default migration
```

Then add it to the barrel in `packages/init/kyju/index.ts`:

```typescript
import m3 from "./NNNN_add_my_field"
export const migrations = [m0, noop, noop, m1, m2, m3]
```

### 3. Use the Field

**Main process** (in a service):
```typescript
const root = this.ctx.db.client.readRoot()
console.log(root.myNewField)

await Effect.runPromise(
  this.ctx.db.client.update((root) => {
    root.myNewField = "new value"
  })
)
```

**Renderer** (in a React component inside providers):
```typescript
import { useDb } from "../../lib/kyju-react"

function MyComponent() {
  const myField = useDb((root) => root.myNewField)
  return <div>{myField}</div>
}
```

The `useDb` hook re-renders whenever the selected value changes in the replica.

### For Collections

Collections are append-only and paginated. They use a different API:

**Main process:**
```typescript
await Effect.runPromise(
  this.ctx.db.client.myCollection.concat([
    { id: "1", timestamp: Date.now(), payload: "hello" },
  ])
)
```

**Renderer** (collections are read differently—typically through RPC or by storing derived data in a regular field).

## Checklist

- [ ] Field added to `appSchema` in `shared/schema/index.ts`
- [ ] Migration created in `packages/init/kyju/`
- [ ] Migration added to barrel in `packages/init/kyju/index.ts`
- [ ] Field accessible via `client.readRoot()` in main process
- [ ] Field accessible via `useDb()` in renderer
