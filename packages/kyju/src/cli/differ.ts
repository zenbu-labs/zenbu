import type { MigrationOp } from "../v2/migrations";
import type { SchemaSnapshot, FieldSnapshot } from "./serializer";

function stableStringify(value: any): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

export function diffSnapshots(
  prev: SchemaSnapshot,
  next: SchemaSnapshot,
): MigrationOp[] {
  const ops: MigrationOp[] = [];
  const prevKeys = new Set(Object.keys(prev.fields));
  const nextKeys = new Set(Object.keys(next.fields));

  for (const key of nextKeys) {
    if (!prevKeys.has(key)) {
      const f = next.fields[key]!;
      ops.push(addOp(key, f));
    }
  }

  for (const key of prevKeys) {
    if (!nextKeys.has(key)) {
      const f = prev.fields[key]!;
      ops.push({ op: "remove", key, kind: f.kind });
    }
  }

  for (const key of nextKeys) {
    if (!prevKeys.has(key)) continue;
    const pf = prev.fields[key]!;
    const nf = next.fields[key]!;

    if (pf.kind !== nf.kind) {
      ops.push({
        op: "alter",
        key,
        changes: { kindChanged: { from: pf.kind, to: nf.kind } },
      });
      continue;
    }

    if (pf.kind === "data" && nf.kind === "data") {
      const changes: Record<string, any> = {};
      if (pf.typeHash !== nf.typeHash) {
        changes.typeHash = { from: pf.typeHash, to: nf.typeHash };
      }
      if (stableStringify(pf.default) !== stableStringify(nf.default)) {
        changes.default = { from: pf.default, to: nf.default };
      }
      if (pf.hasDefault !== nf.hasDefault) {
        changes.hasDefault = { from: pf.hasDefault, to: nf.hasDefault };
      }
      if (Object.keys(changes).length > 0) {
        ops.push({ op: "alter", key, changes });
      }
    }
  }

  return ops;
}

function addOp(key: string, f: FieldSnapshot): MigrationOp {
  switch (f.kind) {
    case "collection":
      return { op: "add", key, kind: "collection", debugName: f.debugName };
    case "blob":
      return { op: "add", key, kind: "blob", debugName: f.debugName };
    case "data":
      return {
        op: "add",
        key,
        kind: "data",
        hasDefault: f.hasDefault,
        ...(f.hasDefault ? { default: f.default } : {}),
      };
  }
}
