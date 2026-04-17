import { describe, it, expect, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { createDb, createReplica, createClient, type SectionConfig, type SchemaShape } from "@zenbu/kyju";
import { VERSION } from "@zenbu/kyju";

const FIXTURES = path.resolve(__dirname, "fixtures");

async function loadSection(fixtureDir: string): Promise<SectionConfig> {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(fixtureDir, "zenbu.plugin.json"), "utf8"),
  );
  const schemaModule = await import(path.resolve(fixtureDir, manifest.schema));
  const schema = schemaModule.schema ?? schemaModule.default;

  let migrations: any[] = [];
  if (manifest.migrations) {
    const migModule = await import(path.resolve(fixtureDir, manifest.migrations));
    migrations = migModule.migrations ?? migModule.default ?? [];
  } else {
    const kyjuIndex = path.join(fixtureDir, "kyju", "index.ts");
    if (fs.existsSync(kyjuIndex)) {
      const migModule = await import(kyjuIndex);
      migrations = migModule.migrations ?? migModule.default ?? [];
    }
  }

  return { name: manifest.name, schema, migrations };
}

function tmpDbPath() {
  return path.join(os.tmpdir(), `kernel-sections-test-${nanoid()}`);
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
  const client = createClient<SchemaShape>(replica);
  return { db, replica, client };
}

let cleanupPath: string | null = null;
afterEach(() => {
  if (cleanupPath) {
    fs.rmSync(cleanupPath, { recursive: true, force: true });
    cleanupPath = null;
  }
});

describe("section integration with fixture plugins", () => {
  it("loads all three fixture sections and creates correct root structure", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const sections = await Promise.all([
      loadSection(path.join(FIXTURES, "kernel-mini")),
      loadSection(path.join(FIXTURES, "plugin-alpha")),
      loadSection(path.join(FIXTURES, "plugin-beta")),
    ]);

    const { client } = await openSectionedDb(dbPath, sections);
    const root = client.readRoot() as Record<string, any>;

    expect(root.plugin.kernel).toBeDefined();
    expect(root.plugin.alpha).toBeDefined();
    expect(root.plugin.beta).toBeDefined();

    expect(root.plugin.kernel.agents).toEqual([]);
    expect(root.plugin.alpha.items).toEqual([]);
    expect(root.plugin.alpha.count).toBe(0);
    expect(root.plugin.beta.config).toEqual({ theme: "dark", lang: "en" });
  });

  it("root.json on disk has correct structure", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const sections = await Promise.all([
      loadSection(path.join(FIXTURES, "kernel-mini")),
      loadSection(path.join(FIXTURES, "plugin-alpha")),
    ]);

    await openSectionedDb(dbPath, sections);

    const rootJson = JSON.parse(
      fs.readFileSync(path.join(dbPath, "root.json"), "utf8"),
    );
    expect(rootJson.plugin).toBeDefined();
    expect(rootJson.plugin.kernel.agents).toEqual([]);
    expect(rootJson.plugin.alpha.items).toEqual([]);
  });

  it("can write and read data per section", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const sections = await Promise.all([
      loadSection(path.join(FIXTURES, "kernel-mini")),
      loadSection(path.join(FIXTURES, "plugin-alpha")),
    ]);

    const { client } = await openSectionedDb(dbPath, sections);

    await client.update((r: any) => {
      r.plugin.alpha.items = [{ id: "1", text: "hello" }];
      r.plugin.alpha.count = 42;
    });

    const root = client.readRoot() as Record<string, any>;
    expect(root.plugin.alpha.items).toEqual([{ id: "1", text: "hello" }]);
    expect(root.plugin.alpha.count).toBe(42);
    expect(root.plugin.kernel.agents).toEqual([]);
  });

  it("beta collection is accessible", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const sections = await Promise.all([
      loadSection(path.join(FIXTURES, "plugin-beta")),
    ]);

    const { client } = await openSectionedDb(dbPath, sections);
    const root = client.readRoot() as Record<string, any>;

    expect(root.plugin.beta.logs).toBeDefined();
    expect(root.plugin.beta.logs.collectionId).toBeTruthy();

    const collDir = path.join(
      dbPath,
      "collections",
      root.plugin.beta.logs.collectionId,
    );
    expect(fs.existsSync(collDir)).toBe(true);
  });

  it("migration versions are tracked per section", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const sections = await Promise.all([
      loadSection(path.join(FIXTURES, "kernel-mini")),
      loadSection(path.join(FIXTURES, "plugin-alpha")),
      loadSection(path.join(FIXTURES, "plugin-beta")),
    ]);

    const { client } = await openSectionedDb(dbPath, sections);
    const root = client.readRoot() as Record<string, any>;

    expect(root._plugins.sectionMigrator.kernel.version).toBe(1);
    expect(root._plugins.sectionMigrator.alpha.version).toBe(1);
    expect(root._plugins.sectionMigrator.beta.version).toBe(2);
  });

  it("data persists across reopen", async () => {
    const dbPath = tmpDbPath();
    cleanupPath = dbPath;

    const sections = await Promise.all([
      loadSection(path.join(FIXTURES, "kernel-mini")),
      loadSection(path.join(FIXTURES, "plugin-alpha")),
    ]);

    const { client: c1 } = await openSectionedDb(dbPath, sections);
    await c1.update((r: any) => {
      r.plugin.kernel.agents = [{ id: "a1", name: "Test" }];
    });

    const { client: c2 } = await openSectionedDb(dbPath, sections);
    const root = c2.readRoot() as Record<string, any>;
    expect(root.plugin.kernel.agents).toEqual([
      { id: "a1", name: "Test" },
    ]);
  });
});
