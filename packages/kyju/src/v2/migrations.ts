import { nanoid } from "nanoid";
import type { Schema } from "./db/schema";

export type MigrationOp =
  | { op: "add"; key: string; kind: "data"; hasDefault: boolean; default?: any }
  | { op: "add"; key: string; kind: "collection"; debugName?: string }
  | { op: "add"; key: string; kind: "blob"; debugName?: string }
  | { op: "remove"; key: string; kind: "collection" | "blob" | "data" }
  | { op: "alter"; key: string; changes: Record<string, any> };

export type KyjuMigration = {
  version: number;
  operations?: MigrationOp[];
  migrate?: (prev: any, ctx: { apply: (data: any) => any }) => any;
};

export type SectionConfig = {
  name: string;
  schema: Schema;
  migrations: KyjuMigration[];
};

function stableStringify(value: any): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

export function applyOperations(
  data: Record<string, any>,
  ops: MigrationOp[],
): Record<string, any> {
  const result: Record<string, any> = { ...data };

  for (const op of ops) {
    switch (op.op) {
      case "add": {
        if (op.kind === "collection") {
          result[op.key] = {
            collectionId: nanoid(),
            debugName: op.debugName ?? op.key,
          };
        } else if (op.kind === "blob") {
          result[op.key] = {
            blobId: nanoid(),
            debugName: op.debugName ?? op.key,
          };
        } else if (op.hasDefault) {
          result[op.key] = op.default;
        } else {
          result[op.key] = undefined;
        }
        break;
      }
      case "remove": {
        delete result[op.key];
        break;
      }
      case "alter": {
        if (op.changes.default) {
          const current = result[op.key];
          const oldDefault = op.changes.default.from;
          if (stableStringify(current) === stableStringify(oldDefault)) {
            result[op.key] = op.changes.default.to;
          }
        }
        break;
      }
    }
  }

  return result;
}
