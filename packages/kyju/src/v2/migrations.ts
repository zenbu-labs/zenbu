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
  /**
   * Runs after the root is written and any new collections/blobs are created.
   * Use when you need client access to concat into a fresh collection or
   * perform any async follow-up work that can't fit in the pure `migrate`
   * transform. Receives a client scoped to the DB root.
   */
  afterMigrate?: (ctx: { client: any }) => Promise<void> | void;
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

/**
 * Returns true if `current` is "structurally equivalent" to `oldDefault`,
 * tolerating extra keys on objects that `oldDefault` didn't know about.
 *
 * Why this exists: when an alter op carries a `default` change, apply()
 * uses this to decide whether the current DB value is "still the stale
 * default" and therefore safe to overwrite with the new one. Strict
 * equality would skip the overwrite whenever an intermediate migration
 * (via a custom `migrate()`) enriched entries with new schema fields —
 * which is common. That bug left users stuck on old defaults indefinitely.
 *
 * For objects: every key in `oldDefault` must be present and match in
 * `current`; `current` is allowed to have *additional* keys (enrichment
 * artifacts). For arrays: same length + elementwise subset match. For
 * primitives: strict equality.
 */
function isDefaultSubsetMatch(current: any, oldDefault: any): boolean {
  if (oldDefault === null || oldDefault === undefined) {
    return current === oldDefault;
  }
  if (typeof oldDefault !== "object") {
    return current === oldDefault;
  }
  if (Array.isArray(oldDefault)) {
    if (!Array.isArray(current) || current.length !== oldDefault.length) return false;
    return oldDefault.every((item, i) => isDefaultSubsetMatch(current[i], item));
  }
  if (typeof current !== "object" || current === null || Array.isArray(current)) {
    return false;
  }
  for (const key of Object.keys(oldDefault)) {
    if (!(key in current)) return false;
    if (!isDefaultSubsetMatch(current[key], oldDefault[key])) return false;
  }
  return true;
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
          if (isDefaultSubsetMatch(current, oldDefault)) {
            result[op.key] = op.changes.default.to;
          }
        }
        break;
      }
    }
  }

  return result;
}
