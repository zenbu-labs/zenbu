import { describe, it, expect, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import zod from "zod";
import { nanoid } from "nanoid";
import { createDb } from "../src/v2/db/db";
import { createReplica } from "../src/v2/replica/replica";
import { createClient } from "../src/v2/client/client";
import { createSchema, f, type InferSchema } from "../src/v2/db/schema";
import type { KyjuMigration } from "../src/v2/migrations";
import { applyOperations } from "../src/v2/migrations";
import { VERSION } from "../src/v2/shared";

const baseSchema = createSchema({
  title: f.string().default("untitled"),
});

function tmpDbPath() {
  return path.join(os.tmpdir(), `kyju-migration-test-${nanoid()}`);
}

async function openDb(dbPath: string, schema: any, migrations: KyjuMigration[] = []) {
  let db: ReturnType<typeof createDb> extends Promise<infer T> ? T : never;

  const replica = createReplica({
    send: (event) => db.postMessage(event),
    maxPageSizeBytes: 1024 * 1024,
  });

  db = await createDb({
    path: dbPath,
    schema,
    migrations,
    send: (event) => replica.postMessage(event),
  });

  await replica.postMessage({ kind: "connect", version: VERSION });
  return { db, replica };
}

let cleanupPath: string | null = null;
afterEach(() => {
  if (cleanupPath) {
    fs.rmSync(cleanupPath, { recursive: true, force: true });
    cleanupPath = null;
  }
});

describe("migration plugin (operations-based)", () => {
  it("fresh DB with no migrations works", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const { replica } = await openDb(dbPath, baseSchema, []);
    const client = createClient<InferSchema<typeof baseSchema>>(replica);

    expect(client.title.read()).toBe("untitled");
  });

  it("declarative add field -> field appears with default", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    await createDb({
      path: dbPath,
      schema: baseSchema,
      migrations: [],
      send: () => {},
    });

    const nextSchema = createSchema({
      title: f.string().default(""),
      count: f.number().default(0),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [
          { op: "add", key: "count", kind: "data", hasDefault: true, default: 99 },
        ],
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    expect(client.title.read()).toBe("untitled");
    expect(client.count.read()).toBe(99);
  });

  it("declarative remove field -> field gone", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const initialSchema = createSchema({
      title: f.string().default("keep me"),
      obsolete: f.string().default("drop me"),
    });

    await createDb({
      path: dbPath,
      schema: initialSchema,
      migrations: [],
      send: () => {},
    });

    const nextSchema = createSchema({
      title: f.string().default(""),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [{ op: "remove", key: "obsolete", kind: "data" }],
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    expect(client.title.read()).toBe("keep me");
    expect((client.readRoot() as any).obsolete).toBeUndefined();
  });

  it("declarative add collection -> collection created on disk", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    await createDb({
      path: dbPath,
      schema: baseSchema,
      migrations: [],
      send: () => {},
    });

    const nextSchema = createSchema({
      title: f.string().default(""),
      items: f.collection<{ id: string }>(),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [{ op: "add", key: "items", kind: "collection" }],
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    const root = client.readRoot() as any;
    expect(root.items).toBeDefined();
    expect(root.items.collectionId).toBeTruthy();

    const collDir = path.join(dbPath, "collections", root.items.collectionId);
    expect(fs.existsSync(collDir)).toBe(true);
  });

  it("declarative add blob -> blob created on disk", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    await createDb({
      path: dbPath,
      schema: baseSchema,
      migrations: [],
      send: () => {},
    });

    const nextSchema = createSchema({
      title: f.string().default(""),
      avatar: f.blob(),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [{ op: "add", key: "avatar", kind: "blob" }],
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    const root = client.readRoot() as any;
    expect(root.avatar).toBeDefined();
    expect(root.avatar.blobId).toBeTruthy();
  });

  it("declarative remove collection -> storage deleted", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const initialSchema = createSchema({
      title: f.string().default("hi"),
      logs: f.collection<{ msg: string }>(),
    });

    await createDb({
      path: dbPath,
      schema: initialSchema,
      migrations: [],
      send: () => {},
    });

    const rootBefore = JSON.parse(
      fs.readFileSync(path.join(dbPath, "root.json"), "utf-8"),
    );
    const collectionId = rootBefore.logs.collectionId;
    expect(fs.existsSync(path.join(dbPath, "collections", collectionId))).toBe(true);

    const nextSchema = createSchema({
      title: f.string().default(""),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [{ op: "remove", key: "logs", kind: "collection" }],
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    expect(client.title.read()).toBe("hi");
    expect((client.readRoot() as any).logs).toBeUndefined();
    expect(fs.existsSync(path.join(dbPath, "collections", collectionId))).toBe(false);
  });

  it("already at target version -> no-op", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const schema = createSchema({
      title: f.string().default(""),
      count: f.number().default(0),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [
          { op: "add", key: "count", kind: "data", hasDefault: true, default: 42 },
        ],
      },
    ];

    await openDb(dbPath, schema, migrations);

    const { replica } = await openDb(dbPath, schema, migrations);
    const client = createClient<InferSchema<typeof schema>>(replica);

    expect(client.count.read()).toBe(42);
  });

  it("complex defaults (objects, arrays) applied correctly", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    await createDb({
      path: dbPath,
      schema: baseSchema,
      migrations: [],
      send: () => {},
    });

    const nextSchema = createSchema({
      title: f.string().default(""),
      tags: f.array(zod.string()).default([]),
      settings: f.object({ theme: zod.string(), volume: zod.number() }).default({ theme: "dark", volume: 80 }),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [
          {
            op: "add",
            key: "tags",
            kind: "data",
            hasDefault: true,
            default: ["default"],
          },
          {
            op: "add",
            key: "settings",
            kind: "data",
            hasDefault: true,
            default: { theme: "dark", volume: 80 },
          },
        ],
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    expect(client.tags.read()).toEqual(["default"]);
    expect(client.settings.read()).toEqual({ theme: "dark", volume: 80 });
  });
});

describe("migration plugin (imperative)", () => {
  it("migrate function transforms data correctly", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const initialSchema = createSchema({
      count: f.number().default(5),
    });

    await createDb({
      path: dbPath,
      schema: initialSchema,
      migrations: [],
      send: () => {},
    });

    const nextSchema = createSchema({
      count: f.number().default(0),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        migrate: (prev) => ({ count: prev.count * 10 }),
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    expect(client.count.read()).toBe(50);
  });

  it("migrate with apply -> auto-applies ops then user transforms", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const initialSchema = createSchema({
      title: f.string().default("hello"),
    });

    await createDb({
      path: dbPath,
      schema: initialSchema,
      migrations: [],
      send: () => {},
    });

    const nextSchema = createSchema({
      title: f.string().default(""),
      subtitle: f.string().default(""),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [
          { op: "add", key: "subtitle", kind: "data", hasDefault: true, default: "" },
        ],
        migrate: (prev, { apply }) => {
          const result = apply(prev);
          result.subtitle = prev.title + " (derived)";
          return result;
        },
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    expect(client.title.read()).toBe("hello");
    expect(client.subtitle.read()).toBe("hello (derived)");
  });
});

describe("migration plugin (multi-step)", () => {
  it("multi-step chain (v0 -> v1 -> v2 -> v3) in one open", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const s0 = createSchema({
      x: f.number().default(1),
    });

    await createDb({
      path: dbPath,
      schema: s0,
      migrations: [],
      send: () => {},
    });

    const sFinal = createSchema({
      x: f.number().default(0),
      y: f.number().default(0),
      z: f.string().default(""),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [
          { op: "add", key: "y", kind: "data", hasDefault: true, default: 100 },
        ],
      },
      {
        version: 2,
        migrate: (prev) => ({ x: prev.x * 2, y: prev.y * 3 }),
      },
      {
        version: 3,
        operations: [
          { op: "add", key: "z", kind: "data", hasDefault: true, default: "final" },
        ],
      },
    ];

    const { replica } = await openDb(dbPath, sFinal, migrations);
    const client = createClient<InferSchema<typeof sFinal>>(replica);

    expect(client.x.read()).toBe(2);
    expect(client.y.read()).toBe(300);
    expect(client.z.read()).toBe("final");
  });

  it("mixed declarative + imperative across versions", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const s0 = createSchema({
      name: f.string().default("alice"),
    });

    await createDb({
      path: dbPath,
      schema: s0,
      migrations: [],
      send: () => {},
    });

    const sFinal = createSchema({
      name: f.string().default(""),
      greeting: f.string().default(""),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        migrate: (prev) => ({ name: prev.name.toUpperCase() }),
      },
      {
        version: 2,
        operations: [
          {
            op: "add",
            key: "greeting",
            kind: "data",
            hasDefault: true,
            default: "hello",
          },
        ],
      },
    ];

    const { replica } = await openDb(dbPath, sFinal, migrations);
    const client = createClient<InferSchema<typeof sFinal>>(replica);

    expect(client.name.read()).toBe("ALICE");
    expect(client.greeting.read()).toBe("hello");
  });

  it("partial migration: DB at v1, migrations has 3 -> runs only v2 and v3", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const s0 = createSchema({
      x: f.number().default(10),
    });

    const migrationsV1: KyjuMigration[] = [
      {
        version: 1,
        migrate: (prev) => ({ x: prev.x + 1 }),
      },
    ];

    await openDb(dbPath, s0, migrationsV1);

    const sFinal = createSchema({
      x: f.number().default(0),
      y: f.number().default(0),
    });

    const allMigrations: KyjuMigration[] = [
      ...migrationsV1,
      {
        version: 2,
        operations: [
          { op: "add", key: "y", kind: "data", hasDefault: true, default: 50 },
        ],
      },
      {
        version: 3,
        migrate: (prev) => ({ x: prev.x * 100, y: prev.y }),
      },
    ];

    const { replica } = await openDb(dbPath, sFinal, allMigrations);
    const client = createClient<InferSchema<typeof sFinal>>(replica);

    expect(client.x.read()).toBe(1100);
    expect(client.y.read()).toBe(50);
  });
});

describe("applyOperations (unit)", () => {
  it("alter with default change updates value matching old default", () => {
    const data = { mode: "" };
    const result = applyOperations(data, [
      {
        op: "alter",
        key: "mode",
        changes: { default: { from: "", to: "fundamental-mode" } },
      },
    ]);
    expect(result.mode).toBe("fundamental-mode");
  });

  it("alter with default change does NOT overwrite user-set value", () => {
    const data = { mode: "custom-mode" };
    const result = applyOperations(data, [
      {
        op: "alter",
        key: "mode",
        changes: { default: { from: "", to: "fundamental-mode" } },
      },
    ]);
    expect(result.mode).toBe("custom-mode");
  });

  it("alter with default change works for object defaults", () => {
    const data = { config: { theme: "light", size: 14 } };
    const result = applyOperations(data, [
      {
        op: "alter",
        key: "config",
        changes: {
          default: {
            from: { theme: "light", size: 14 },
            to: { theme: "dark", size: 16 },
          },
        },
      },
    ]);
    expect(result.config).toEqual({ theme: "dark", size: 16 });
  });

  it("alter with default change works for array defaults", () => {
    const data = { tags: [] as string[] };
    const result = applyOperations(data, [
      {
        op: "alter",
        key: "tags",
        changes: { default: { from: [], to: ["default"] } },
      },
    ]);
    expect(result.tags).toEqual(["default"]);
  });

  it("alter with default change applies when prior migration enriched array items with new fields", () => {
    // Simulates: initial default was [{id:"a", name:"A"}]; an intermediate
    // migration enriched each entry with `newField`; now we bump the default
    // to []. Strict equality would see the enriched value as "user data" and
    // skip the bump, leaving the stale entry forever. Subset match detects
    // enrichment and applies the new default.
    const data = {
      configs: [
        { id: "a", name: "A", newField: "enriched" },
      ],
    };
    const result = applyOperations(data, [
      {
        op: "alter",
        key: "configs",
        changes: {
          default: {
            from: [{ id: "a", name: "A" }],
            to: [],
          },
        },
      },
    ]);
    expect(result.configs).toEqual([]);
  });

  it("alter with default change preserves user data when array length differs from old default", () => {
    const data = {
      configs: [
        { id: "a", name: "A" },
        { id: "user-added", name: "Mine" },
      ],
    };
    const result = applyOperations(data, [
      {
        op: "alter",
        key: "configs",
        changes: {
          default: {
            from: [{ id: "a", name: "A" }],
            to: [],
          },
        },
      },
    ]);
    expect(result.configs).toEqual([
      { id: "a", name: "A" },
      { id: "user-added", name: "Mine" },
    ]);
  });

  it("alter with default change preserves user data when an array item has a mismatching required field", () => {
    const data = {
      configs: [{ id: "user-different", name: "A" }],
    };
    const result = applyOperations(data, [
      {
        op: "alter",
        key: "configs",
        changes: {
          default: {
            from: [{ id: "a", name: "A" }],
            to: [],
          },
        },
      },
    ]);
    expect(result.configs).toEqual([{ id: "user-different", name: "A" }]);
  });

  it("alter with only typeHash change (no default change) is still a no-op", () => {
    const data = { count: 42 };
    const result = applyOperations(data, [
      {
        op: "alter",
        key: "count",
        changes: { typeHash: { from: "aaa", to: "bbb" } },
      },
    ]);
    expect(result.count).toBe(42);
  });

  it("add overwrites existing key (migration default takes precedence over schema init)", () => {
    const data = { mode: "schema-default" };
    const result = applyOperations(data, [
      { op: "add", key: "mode", kind: "data", hasDefault: true, default: "migration-default" },
    ]);
    expect(result.mode).toBe("migration-default");
  });

  it("add sets value for missing key", () => {
    const data = {};
    const result = applyOperations(data, [
      { op: "add", key: "mode", kind: "data", hasDefault: true, default: "hello" },
    ]);
    expect(result.mode).toBe("hello");
  });

  it("remove on missing key is a no-op", () => {
    const data = { a: 1 };
    const result = applyOperations(data, [
      { op: "remove", key: "nonexistent", kind: "data" },
    ]);
    expect(result).toEqual({ a: 1 });
  });

  it("operations are applied in order", () => {
    const data = {};
    const result = applyOperations(data, [
      { op: "add", key: "x", kind: "data", hasDefault: true, default: 10 },
      { op: "remove", key: "x", kind: "data" },
    ]);
    expect(result.x).toBeUndefined();
  });

  it("add without default sets undefined", () => {
    const data = {};
    const result = applyOperations(data, [
      { op: "add", key: "x", kind: "data", hasDefault: false },
    ]);
    expect("x" in result).toBe(true);
    expect(result.x).toBeUndefined();
  });
});

describe("migration plugin (default-only alter via runtime)", () => {
  it("alter op with default change migrates data at runtime", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const initialSchema = createSchema({
      mode: f.string().default(""),
    });

    await createDb({
      path: dbPath,
      schema: initialSchema,
      migrations: [],
      send: () => {},
    });

    const nextSchema = createSchema({
      mode: f.string().default("fundamental-mode"),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [
          {
            op: "alter",
            key: "mode",
            changes: { default: { from: "", to: "fundamental-mode" } },
          },
        ],
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    expect(client.mode.read()).toBe("fundamental-mode");
  });

  it("alter op with default change preserves user-modified values", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const initialSchema = createSchema({
      mode: f.string().default(""),
    });

    const { replica: r0 } = await openDb(dbPath, initialSchema, []);
    const c0 = createClient<InferSchema<typeof initialSchema>>(r0);
    await c0.mode.set("user-custom-mode");

    const nextSchema = createSchema({
      mode: f.string().default("fundamental-mode"),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [
          {
            op: "alter",
            key: "mode",
            changes: { default: { from: "", to: "fundamental-mode" } },
          },
        ],
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    expect(client.mode.read()).toBe("user-custom-mode");
  });

  it("alter op with default change applies after an intermediate migration enriched array items", async () => {
    // Regression: in the real init schema, migration A enriched each
    // agentConfigs entry with new fields, then migration B tried to bump the
    // default from the un-enriched shape to []. Strict equality fails to
    // match (enriched > original), so B was silently skipped and fresh
    // users kept the stale seed forever. Fixed via isDefaultSubsetMatch.
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const initialSchema = createSchema({
      configs: f
        .array(zod.object({ id: zod.string(), name: zod.string() }))
        .default([{ id: "legacy", name: "Legacy" }]),
    });

    await createDb({
      path: dbPath,
      schema: initialSchema,
      migrations: [],
      send: () => {},
    });

    const nextSchema = createSchema({
      configs: f
        .array(
          zod.object({
            id: zod.string(),
            name: zod.string(),
            extra: zod.string().optional(),
          }),
        )
        .default([]),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        migrate(prev) {
          return {
            ...prev,
            configs: (prev.configs ?? []).map((c: { id: string; name: string }) => ({
              ...c,
              extra: "enriched",
            })),
          };
        },
      },
      {
        version: 2,
        operations: [
          {
            op: "alter",
            key: "configs",
            changes: {
              default: {
                from: [{ id: "legacy", name: "Legacy" }],
                to: [],
              },
            },
          },
        ],
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    expect(client.configs.read()).toEqual([]);
  });
});

describe("migration plugin (imperative array transform)", () => {
  it("migrate function can add items to arrays and add fields to array items", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    // Simulate a desktop-like schema with agents and views arrays
    const initialSchema = createSchema({
      views: f.array(
        zod.object({
          id: zod.string(),
          type: zod.string(),
          title: zod.string(),
          active: zod.boolean(),
        }),
      ).default([]),
      agents: f.array(
        zod.object({
          id: zod.string(),
          name: zod.string(),
          startCommand: zod.string(),
        }),
      ).default([{ id: "codex-acp", name: "Codex", startCommand: "" }]),
      selectedAgentId: f.string().default("codex-acp"),
    });

    // Create DB with initial data
    const { replica: r0 } = await openDb(dbPath, initialSchema, []);
    const c0 = createClient<InferSchema<typeof initialSchema>>(r0);

    // Add some views without agentId
    await c0.views.set([
      { id: "v1", type: "chat", title: "Chat 1", active: true },
      { id: "v2", type: "chat", title: "Chat 2", active: false },
    ]);

    // Verify initial state
    expect(c0.agents.read()).toEqual([
      { id: "codex-acp", name: "Codex", startCommand: "" },
    ]);
    expect((c0.views.read() as any[]).every((v: any) => !v.agentId)).toBe(true);

    // Now open with migration that adds mock-acp and agentId
    const nextSchema = createSchema({
      views: f.array(
        zod.object({
          id: zod.string(),
          type: zod.string(),
          title: zod.string(),
          active: zod.boolean(),
          agentId: zod.string().optional(),
        }),
      ).default([]),
      agents: f.array(
        zod.object({
          id: zod.string(),
          name: zod.string(),
          startCommand: zod.string(),
        }),
      ).default([]),
      selectedAgentId: f.string().default("codex-acp"),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        migrate: (prev) => {
          const data = { ...prev };

          // Add mock-acp agent
          const agents = Array.isArray(data.agents) ? [...data.agents] : [];
          if (!agents.some((a: any) => a.id === "mock-acp")) {
            agents.push({
              id: "mock-acp",
              name: "Mock Agent",
              startCommand: "npx tsx mock-acp/src/index.ts",
            });
          }
          data.agents = agents;

          // Add agentId to views
          if (Array.isArray(data.views)) {
            data.views = data.views.map((view: any) => {
              if (!view.agentId) {
                return { ...view, agentId: data.selectedAgentId ?? "codex-acp" };
              }
              return view;
            });
          }

          return data;
        },
      },
    ];

    const { replica } = await openDb(dbPath, nextSchema, migrations);
    const client = createClient<InferSchema<typeof nextSchema>>(replica);

    // Verify agents now includes mock-acp
    const agents = client.agents.read() as any[];
    expect(agents).toHaveLength(2);
    expect(agents[0].id).toBe("codex-acp");
    expect(agents[1].id).toBe("mock-acp");
    expect(agents[1].name).toBe("Mock Agent");

    // Verify views now have agentId
    const views = client.views.read() as any[];
    expect(views).toHaveLength(2);
    expect(views[0].agentId).toBe("codex-acp");
    expect(views[1].agentId).toBe("codex-acp");

    // selectedAgentId should be preserved
    expect(client.selectedAgentId.read()).toBe("codex-acp");
  });

  it("migrate is idempotent - re-running doesn't duplicate agents", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const schema = createSchema({
      agents: f.array(
        zod.object({
          id: zod.string(),
          name: zod.string(),
        }),
      ).default([{ id: "a", name: "Agent A" }]),
    });

    const migration: KyjuMigration = {
      version: 1,
      migrate: (prev) => {
        const data = { ...prev };
        const agents = Array.isArray(data.agents) ? [...data.agents] : [];
        if (!agents.some((a: any) => a.id === "b")) {
          agents.push({ id: "b", name: "Agent B" });
        }
        data.agents = agents;
        return data;
      },
    };

    // Run migration
    await openDb(dbPath, schema, [migration]);

    // Run again - should not duplicate
    const { replica } = await openDb(dbPath, schema, [migration]);
    const client = createClient<InferSchema<typeof schema>>(replica);

    const agents = client.agents.read() as any[];
    expect(agents).toHaveLength(2);
    expect(agents.filter((a: any) => a.id === "b")).toHaveLength(1);
  });
});
