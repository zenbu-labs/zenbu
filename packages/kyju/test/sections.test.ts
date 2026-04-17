import { describe, it, expect, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import zod from "zod";
import { nanoid } from "nanoid";
import { createDb } from "../src/v2/db/db";
import { createReplica } from "../src/v2/replica/replica";
import { createClient } from "../src/v2/client/client";
import { createSchema, f, type SchemaShape } from "../src/v2/db/schema";
import type { KyjuMigration, SectionConfig } from "../src/v2/migrations";
import { VERSION } from "../src/v2/shared";

function tmpDbPath() {
  return path.join(os.tmpdir(), `kyju-sections-test-${nanoid()}`);
}

async function openSectionedDb(dbPath: string, sections: SectionConfig[]) {
  let db: Awaited<ReturnType<typeof createDb>>;

  const replica = createReplica({
    send: (event) => db.postMessage(event),
    maxPageSizeBytes: 1024 * 1024,
  });

  db = await createDb({
    path: dbPath,
    sections,
    send: (event) => replica.postMessage(event),
  });

  await replica.postMessage({ kind: "connect", version: VERSION });
  return { db, replica };
}

const alphaSchema = createSchema({
  items: f.array(zod.object({ id: zod.string(), text: zod.string() })).default([]),
  count: f.number().default(0),
});

const betaSchema = createSchema({
  config: f.object({ theme: zod.string() }).default({ theme: "dark" }),
});

const alphaSection: SectionConfig = {
  name: "alpha",
  schema: alphaSchema,
  migrations: [],
};

const betaSection: SectionConfig = {
  name: "beta",
  schema: betaSchema,
  migrations: [],
};

let cleanupPath: string | null = null;
afterEach(() => {
  if (cleanupPath) {
    fs.rmSync(cleanupPath, { recursive: true, force: true });
    cleanupPath = null;
  }
});

describe("sectioned DB initialization", () => {
  it("creates root with plugin containing all sections", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const { replica } = await openSectionedDb(dbPath, [alphaSection, betaSection]);
    const client = createClient<SchemaShape>(replica);

    const root = client.readRoot() as Record<string, any>;
    expect(root.plugin).toBeDefined();
    expect(root.plugin.alpha).toBeDefined();
    expect(root.plugin.beta).toBeDefined();
    expect(root.plugin.alpha.items).toEqual([]);
    expect(root.plugin.alpha.count).toBe(0);
    expect(root.plugin.beta.config).toEqual({ theme: "dark" });
  });

  it("initializes collections within sections", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const withCollection = createSchema({
      logs: f.collection(zod.object({ msg: zod.string() })),
    });

    const { replica } = await openSectionedDb(dbPath, [
      { name: "gamma", schema: withCollection, migrations: [] },
    ]);
    const client = createClient<SchemaShape>(replica);

    const root = client.readRoot() as Record<string, any>;
    expect(root.plugin.gamma.logs).toBeDefined();
    expect(root.plugin.gamma.logs.collectionId).toBeTruthy();

    const collDir = path.join(dbPath, "collections", root.plugin.gamma.logs.collectionId);
    expect(fs.existsSync(collDir)).toBe(true);
  });

  it("errors on duplicate section names", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    await expect(
      openSectionedDb(dbPath, [
        { name: "dup", schema: alphaSchema, migrations: [] },
        { name: "dup", schema: betaSchema, migrations: [] },
      ]),
    ).rejects.toThrow("Duplicate section names: dup");
  });
});

describe("section migrations", () => {
  it("applies declarative add to scoped section path", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const initialSchema = createSchema({
      title: f.string().default("hello"),
    });

    await createDb({
      path: dbPath,
      sections: [{ name: "alpha", schema: initialSchema, migrations: [] }],
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
          { op: "add", key: "count", kind: "data", hasDefault: true, default: 42 },
        ],
      },
    ];

    const { replica } = await openSectionedDb(dbPath, [
      { name: "alpha", schema: nextSchema, migrations },
    ]);
    const client = createClient<SchemaShape>(replica);

    const root = client.readRoot() as Record<string, any>;
    expect(root.plugin.alpha.title).toBe("hello");
    expect(root.plugin.alpha.count).toBe(42);
    expect(root.count).toBeUndefined();
  });

  it("imperative migrate receives only section data", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const schema = createSchema({
      value: f.number().default(5),
    });

    await createDb({
      path: dbPath,
      sections: [{ name: "alpha", schema, migrations: [] }],
      send: () => {},
    });

    let receivedPrev: any = null;
    const migrations: KyjuMigration[] = [
      {
        version: 1,
        migrate: (prev) => {
          receivedPrev = prev;
          return { value: prev.value * 10 };
        },
      },
    ];

    const { replica } = await openSectionedDb(dbPath, [
      { name: "alpha", schema, migrations },
    ]);
    const client = createClient<SchemaShape>(replica);

    expect(receivedPrev).toEqual({ value: 5 });
    expect(receivedPrev.plugin).toBeUndefined();
    const root = client.readRoot() as Record<string, any>;
    expect(root.plugin.alpha.value).toBe(50);
  });

  it("tracks versions independently per section", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const schemaA = createSchema({ x: f.number().default(1) });
    const schemaB = createSchema({ y: f.string().default("a") });

    const migrationsA: KyjuMigration[] = [
      { version: 1, migrate: (prev) => ({ x: prev.x + 1 }) },
      { version: 2, migrate: (prev) => ({ x: prev.x * 10 }) },
    ];

    const migrationsB: KyjuMigration[] = [
      { version: 1, migrate: (prev) => ({ y: prev.y + "!" }) },
    ];

    const { replica } = await openSectionedDb(dbPath, [
      { name: "alpha", schema: schemaA, migrations: migrationsA },
      { name: "beta", schema: schemaB, migrations: migrationsB },
    ]);
    const client = createClient<SchemaShape>(replica);

    const root = client.readRoot() as Record<string, any>;
    expect(root.plugin.alpha.x).toBe(20);
    expect(root.plugin.beta.y).toBe("a!");

    expect(root._plugins.sectionMigrator.alpha.version).toBe(2);
    expect(root._plugins.sectionMigrator.beta.version).toBe(1);
  });

  it("does not re-run migrations on reopen", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const schema = createSchema({ x: f.number().default(1) });
    const migrations: KyjuMigration[] = [
      { version: 1, migrate: (prev) => ({ x: prev.x + 100 }) },
    ];

    await openSectionedDb(dbPath, [
      { name: "alpha", schema, migrations },
    ]);

    const { replica } = await openSectionedDb(dbPath, [
      { name: "alpha", schema, migrations },
    ]);
    const client = createClient<SchemaShape>(replica);

    const root = client.readRoot() as Record<string, any>;
    expect(root.plugin.alpha.x).toBe(101);
  });

  it("adds collection via migration within a section", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const initialSchema = createSchema({
      title: f.string().default("hi"),
    });

    await createDb({
      path: dbPath,
      sections: [{ name: "alpha", schema: initialSchema, migrations: [] }],
      send: () => {},
    });

    const nextSchema = createSchema({
      title: f.string().default(""),
      logs: f.collection(zod.object({ msg: zod.string() })),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [{ op: "add", key: "logs", kind: "collection" }],
      },
    ];

    const { replica } = await openSectionedDb(dbPath, [
      { name: "alpha", schema: nextSchema, migrations },
    ]);
    const client = createClient<SchemaShape>(replica);

    const root = client.readRoot() as Record<string, any>;
    expect(root.plugin.alpha.logs).toBeDefined();
    expect(root.plugin.alpha.logs.collectionId).toBeTruthy();

    const collDir = path.join(dbPath, "collections", root.plugin.alpha.logs.collectionId);
    expect(fs.existsSync(collDir)).toBe(true);
  });

  it("sections do not interfere with each other", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const schemaA = createSchema({ x: f.number().default(1) });
    const schemaB = createSchema({ x: f.number().default(100) });

    const migrationsA: KyjuMigration[] = [
      { version: 1, migrate: (prev) => ({ x: prev.x + 1 }) },
    ];

    const { replica } = await openSectionedDb(dbPath, [
      { name: "alpha", schema: schemaA, migrations: migrationsA },
      { name: "beta", schema: schemaB, migrations: [] },
    ]);
    const client = createClient<SchemaShape>(replica);

    const root = client.readRoot() as Record<string, any>;
    expect(root.plugin.alpha.x).toBe(2);
    expect(root.plugin.beta.x).toBe(100);
  });

  it("reopening with a new section preserves existing ones", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const schemaA = createSchema({ x: f.number().default(1) });

    await openSectionedDb(dbPath, [
      { name: "alpha", schema: schemaA, migrations: [] },
    ]);

    const schemaB = createSchema({ y: f.string().default("new") });

    const { replica } = await openSectionedDb(dbPath, [
      { name: "alpha", schema: schemaA, migrations: [] },
      { name: "beta", schema: schemaB, migrations: [] },
    ]);
    const client = createClient<SchemaShape>(replica);

    const root = client.readRoot() as Record<string, any>;
    expect(root.plugin.alpha.x).toBe(1);
    expect(root.plugin.beta).toBeUndefined();
  });

  it("multi-step migration chain within a section", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const s0 = createSchema({ x: f.number().default(1) });
    await createDb({
      path: dbPath,
      sections: [{ name: "alpha", schema: s0, migrations: [] }],
      send: () => {},
    });

    const sFinal = createSchema({
      x: f.number().default(0),
      y: f.number().default(0),
    });

    const migrations: KyjuMigration[] = [
      {
        version: 1,
        operations: [
          { op: "add", key: "y", kind: "data", hasDefault: true, default: 10 },
        ],
      },
      {
        version: 2,
        migrate: (prev) => ({ x: prev.x * 100, y: prev.y * 2 }),
      },
    ];

    const { replica } = await openSectionedDb(dbPath, [
      { name: "alpha", schema: sFinal, migrations },
    ]);
    const client = createClient<SchemaShape>(replica);

    const root = client.readRoot() as Record<string, any>;
    expect(root.plugin.alpha.x).toBe(100);
    expect(root.plugin.alpha.y).toBe(20);
  });
});
