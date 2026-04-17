import fs from "node:fs";
import path from "node:path";
import type { MigrationOp } from "../v2/migrations";
import type { SchemaSnapshot } from "./serializer";

export type JournalEntry = {
  idx: number;
  tag: string;
  when: number;
};

export type Journal = {
  version: string;
  entries: JournalEntry[];
};

const INLINE_MIGRATION_TYPES = `type MigrationOp =
  | { op: "add"; key: string; kind: "data"; hasDefault: boolean; default?: any }
  | { op: "add"; key: string; kind: "collection"; debugName?: string }
  | { op: "add"; key: string; kind: "blob"; debugName?: string }
  | { op: "remove"; key: string; kind: "collection" | "blob" | "data" }
  | { op: "alter"; key: string; changes: Record<string, any> };

type KyjuMigration = {
  version: number;
  operations?: MigrationOp[];
  migrate?: (prev: any, ctx: { apply: (data: any) => any }) => any;
};`;

function pad(n: number, width = 4): string {
  return String(n).padStart(width, "0");
}

function sanitizeTag(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function readJournal(outPath: string): Journal {
  const journalPath = path.join(outPath, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    return { version: "1", entries: [] };
  }
  return JSON.parse(fs.readFileSync(journalPath, "utf-8"));
}

export function getLastSnapshot(outPath: string, journal: Journal): SchemaSnapshot | null {
  if (journal.entries.length === 0) return null;
  const lastEntry = journal.entries[journal.entries.length - 1]!;
  const snapshotPath = path.join(outPath, "meta", `${pad(lastEntry.idx)}_snapshot.json`);
  if (!fs.existsSync(snapshotPath)) return null;
  return JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
}

export function getSnapshotAtIndex(outPath: string, journal: Journal, index: number): SchemaSnapshot | null {
  const entry = journal.entries[index];
  if (!entry) return null;
  const snapshotPath = path.join(outPath, "meta", `${pad(entry.idx)}_snapshot.json`);
  if (!fs.existsSync(snapshotPath)) return null;
  return JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
}

function generateDeclarativeMigration(idx: number, ops: MigrationOp[]): string {
  const opsJson = JSON.stringify(ops, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : "  " + line))
    .join("\n");

  return `${INLINE_MIGRATION_TYPES}

const migration: KyjuMigration = {
  version: ${idx + 1},
  operations: ${opsJson},
}

export default migration
`;
}

function generateCustomMigration(idx: number, ops: MigrationOp[]): string {
  const opsJson = JSON.stringify(ops, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : "  " + line))
    .join("\n");

  return `${INLINE_MIGRATION_TYPES}

const migration: KyjuMigration = {
  version: ${idx + 1},
  operations: ${opsJson},
  migrate(prev, { apply }) {
    const result = apply(prev)
    // customize transformation here
    return result
  },
}

export default migration
`;
}

function generateBarrel(entries: JournalEntry[]): string {
  const imports = entries.map(
    (e) => `import m${e.idx} from "./${pad(e.idx)}_${e.tag}"`,
  );
  const names = entries.map((e) => `m${e.idx}`);
  return `${imports.join("\n")}\n\nexport const migrations = [${names.join(", ")}]\n`;
}

export type GenerateOptions = {
  outPath: string;
  snapshot: SchemaSnapshot;
  ops: MigrationOp[];
  name?: string;
  custom?: boolean;
  amend?: boolean;
};

export function generate(opts: GenerateOptions): {
  migrationPath: string;
  snapshotPath: string;
  barrelPath: string;
} {
  const { outPath, snapshot, ops, name, custom, amend } = opts;

  fs.mkdirSync(path.join(outPath, "meta"), { recursive: true });

  const journal = readJournal(outPath);

  let idx: number;
  let tag: string;

  if (amend) {
    if (journal.entries.length === 0) {
      throw new Error("No migration to amend");
    }
    const lastEntry = journal.entries[journal.entries.length - 1]!;
    idx = lastEntry.idx;
    tag = sanitizeTag(name || lastEntry.tag);

    const oldMigration = path.join(outPath, `${pad(idx)}_${lastEntry.tag}.ts`);
    const oldSnapshot = path.join(outPath, "meta", `${pad(idx)}_snapshot.json`);
    if (fs.existsSync(oldMigration)) fs.unlinkSync(oldMigration);
    if (fs.existsSync(oldSnapshot)) fs.unlinkSync(oldSnapshot);

    journal.entries[journal.entries.length - 1] = { idx, tag, when: Date.now() };
  } else {
    idx = journal.entries.length;
    tag = sanitizeTag(name || `migration`);
    journal.entries.push({ idx, tag, when: Date.now() });
  }

  const prefix = pad(idx);

  const snapshotPath = path.join(outPath, "meta", `${prefix}_snapshot.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");

  const hasAlterOps = ops.some((o) => o.op === "alter");
  const useCustom = custom || hasAlterOps;

  const migrationCode = useCustom
    ? generateCustomMigration(idx, ops)
    : generateDeclarativeMigration(idx, ops);

  const migrationPath = path.join(outPath, `${prefix}_${tag}.ts`);
  fs.writeFileSync(migrationPath, migrationCode);

  const journalPath = path.join(outPath, "meta", "_journal.json");
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2) + "\n");

  const barrelPath = path.join(outPath, "index.ts");
  fs.writeFileSync(barrelPath, generateBarrel(journal.entries));

  return { migrationPath, snapshotPath, barrelPath };
}
