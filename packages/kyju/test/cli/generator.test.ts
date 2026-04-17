import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";
import { generate, readJournal, getLastSnapshot } from "../../src/cli/generator";
import type { SchemaSnapshot } from "../../src/cli/serializer";
import type { MigrationOp } from "../../src/v2/migrations";

function tmpDir() {
  const p = path.join(os.tmpdir(), `kyju-gen-test-${nanoid()}`);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

let cleanups: string[] = [];
afterEach(() => {
  for (const p of cleanups) {
    fs.rmSync(p, { recursive: true, force: true });
  }
  cleanups = [];
});

function makeSnapshot(
  fields: SchemaSnapshot["fields"],
  id = "snap-1",
  prevId = "",
): SchemaSnapshot {
  return { id, prevId, fields };
}

describe("generator", () => {
  it("generates initial migration files", () => {
    const out = tmpDir();
    cleanups.push(out);

    const snapshot = makeSnapshot(
      { title: { kind: "data", hasDefault: true, default: "", typeHash: "abc" } },
      "id-1",
      "",
    );
    const ops: MigrationOp[] = [
      { op: "add", key: "title", kind: "data", hasDefault: true, default: "" },
    ];

    const result = generate({ outPath: out, snapshot, ops, name: "initial" });

    expect(fs.existsSync(result.migrationPath)).toBe(true);
    expect(fs.existsSync(result.snapshotPath)).toBe(true);
    expect(fs.existsSync(result.barrelPath)).toBe(true);

    const migContent = fs.readFileSync(result.migrationPath, "utf-8");
    expect(migContent).toContain("KyjuMigration");
    expect(migContent).not.toContain("@zenbu/kyju/migrations");
    expect(migContent).not.toContain("@testbu/kyju");
    expect(migContent).toContain('"add"');
    expect(migContent).toContain("version: 1");

    const journal = readJournal(out);
    expect(journal.entries).toHaveLength(1);
    expect(journal.entries[0]!.idx).toBe(0);
    expect(journal.entries[0]!.tag).toBe("initial");
  });

  it("generates barrel with correct imports", () => {
    const out = tmpDir();
    cleanups.push(out);

    const snapshot = makeSnapshot({}, "id-1", "");
    generate({ outPath: out, snapshot, ops: [], name: "first" });

    const barrel = fs.readFileSync(path.join(out, "index.ts"), "utf-8");
    expect(barrel).toContain('import m0 from "./0000_first"');
    expect(barrel).toContain("export const migrations = [m0]");
  });

  it("consecutive generates produce incrementing prefixes", () => {
    const out = tmpDir();
    cleanups.push(out);

    const snap1 = makeSnapshot({}, "id-1", "");
    generate({ outPath: out, snapshot: snap1, ops: [], name: "first" });

    const snap2 = makeSnapshot(
      { x: { kind: "data", hasDefault: true, default: 0, typeHash: "abc" } },
      "id-2",
      "id-1",
    );
    generate({
      outPath: out,
      snapshot: snap2,
      ops: [{ op: "add", key: "x", kind: "data", hasDefault: true, default: 0 }],
      name: "second",
    });

    expect(fs.existsSync(path.join(out, "0000_first.ts"))).toBe(true);
    expect(fs.existsSync(path.join(out, "0001_second.ts"))).toBe(true);

    const barrel = fs.readFileSync(path.join(out, "index.ts"), "utf-8");
    expect(barrel).toContain("import m0");
    expect(barrel).toContain("import m1");
    expect(barrel).toContain("export const migrations = [m0, m1]");
  });

  it("snapshot written with correct id/prevId", () => {
    const out = tmpDir();
    cleanups.push(out);

    const snapshot = makeSnapshot(
      { x: { kind: "data", hasDefault: true, default: 0, typeHash: "abc" } },
      "snap-id-123",
      "prev-snap-456",
    );
    const result = generate({ outPath: out, snapshot, ops: [], name: "test" });

    const saved = JSON.parse(fs.readFileSync(result.snapshotPath, "utf-8"));
    expect(saved.id).toBe("snap-id-123");
    expect(saved.prevId).toBe("prev-snap-456");
    expect(saved.fields.x.kind).toBe("data");
  });

  it("--custom generates skeleton migrate function", () => {
    const out = tmpDir();
    cleanups.push(out);

    const snapshot = makeSnapshot({}, "id-1", "");
    const ops: MigrationOp[] = [
      { op: "add", key: "x", kind: "data", hasDefault: true, default: 0 },
    ];
    const result = generate({
      outPath: out,
      snapshot,
      ops,
      name: "custom",
      custom: true,
    });

    const content = fs.readFileSync(result.migrationPath, "utf-8");
    expect(content).toContain("migrate(prev, { apply })");
    expect(content).toContain("apply(prev)");
  });

  it("alter ops auto-trigger custom migration", () => {
    const out = tmpDir();
    cleanups.push(out);

    const snapshot = makeSnapshot({}, "id-1", "");
    const ops: MigrationOp[] = [
      { op: "alter", key: "x", changes: { typeHash: { from: "a", to: "b" } } },
    ];
    const result = generate({ outPath: out, snapshot, ops, name: "alter" });

    const content = fs.readFileSync(result.migrationPath, "utf-8");
    expect(content).toContain("migrate(prev, { apply })");
  });

  it("getLastSnapshot returns null for empty journal", () => {
    const out = tmpDir();
    cleanups.push(out);
    const journal = readJournal(out);
    expect(getLastSnapshot(out, journal)).toBe(null);
  });

  it("getLastSnapshot returns the latest snapshot", () => {
    const out = tmpDir();
    cleanups.push(out);

    const snap1 = makeSnapshot({}, "id-1", "");
    generate({ outPath: out, snapshot: snap1, ops: [], name: "first" });

    const snap2 = makeSnapshot(
      { y: { kind: "collection" } },
      "id-2",
      "id-1",
    );
    generate({
      outPath: out,
      snapshot: snap2,
      ops: [{ op: "add", key: "y", kind: "collection" }],
      name: "second",
    });

    const journal = readJournal(out);
    const last = getLastSnapshot(out, journal);
    expect(last).not.toBeNull();
    expect(last!.id).toBe("id-2");
    expect(last!.fields.y).toEqual({ kind: "collection" });
  });

  it("journal tracks entries correctly", () => {
    const out = tmpDir();
    cleanups.push(out);

    generate({
      outPath: out,
      snapshot: makeSnapshot({}, "a", ""),
      ops: [],
      name: "first",
    });
    generate({
      outPath: out,
      snapshot: makeSnapshot({}, "b", "a"),
      ops: [],
      name: "second",
    });
    generate({
      outPath: out,
      snapshot: makeSnapshot({}, "c", "b"),
      ops: [],
      name: "third",
    });

    const journal = readJournal(out);
    expect(journal.entries).toHaveLength(3);
    expect(journal.entries.map((e) => e.tag)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(journal.entries.map((e) => e.idx)).toEqual([0, 1, 2]);
  });
});
