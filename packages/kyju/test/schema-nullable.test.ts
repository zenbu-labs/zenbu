import { describe, it, expect, afterEach } from "vitest";
import zod from "zod";
import fs from "node:fs";
import path from "node:path";
import { createSchema, f, type InferRoot } from "../src/v2/db/schema";
import { serializeSchema } from "../src/cli/serializer";
import { setup } from "./helpers";

let cleanup: () => void;
afterEach(() => cleanup?.());

describe("f.nullable()", () => {
  const nullableSchema = createSchema({
    name: f.string().nullable().default(null),
    count: f.number().nullable().default(null),
    label: f.string().nullable().default("hello"),
  });

  it("produces a FieldWithDefault that can call .default(null)", () => {
    const field = f.string().nullable();
    expect(field).toHaveProperty("default");
    expect(field).toHaveProperty("nullable");
    expect(field).toHaveProperty("_hasDefault", false);

    const withDefault = field.default(null);
    expect(withDefault._hasDefault).toBe(true);
    expect(withDefault._defaultValue).toBe(null);
  });

  it("allows non-null default on nullable field", () => {
    const field = f.string().nullable().default("hello");
    expect(field._hasDefault).toBe(true);
    expect(field._defaultValue).toBe("hello");
  });

  it("initializes db root with null defaults", async () => {
    const ctx = await setup({ schema: nullableSchema });
    cleanup = ctx.cleanup;

    const rootJson = JSON.parse(
      fs.readFileSync(path.join(ctx.dbPath, "root.json"), "utf-8"),
    );
    expect(rootJson.name).toBe(null);
    expect(rootJson.count).toBe(null);
    expect(rootJson.label).toBe("hello");
  });

  it("can set and read nullable field values", async () => {
    const ctx = await setup({ schema: nullableSchema });
    cleanup = ctx.cleanup;

    await ctx.replica.postMessage({
      kind: "write",
      op: { type: "root.set", path: ["name"], value: "test" },
    });
    expect((ctx.client.readRoot() as any).name).toBe("test");

    await ctx.replica.postMessage({
      kind: "write",
      op: { type: "root.set", path: ["name"], value: null },
    });
    expect((ctx.client.readRoot() as any).name).toBe(null);
  });

  it("serializes nullable fields correctly for migrations", () => {
    const snapshot = serializeSchema(nullableSchema, "test-id", "prev-id");

    expect(snapshot.fields.name).toMatchObject({
      kind: "data",
      hasDefault: true,
      default: null,
    });
    expect(snapshot.fields.count).toMatchObject({
      kind: "data",
      hasDefault: true,
      default: null,
    });
    expect(snapshot.fields.label).toMatchObject({
      kind: "data",
      hasDefault: true,
      default: "hello",
    });
  });

  it("nullable field has a different typeHash than non-nullable", () => {
    const plainSchema = createSchema({
      name: f.string().default(""),
    });
    const nullSchema = createSchema({
      name: f.string().nullable().default(null),
    });

    const plainSnap = serializeSchema(plainSchema, "a", "");
    const nullSnap = serializeSchema(nullSchema, "b", "");

    expect(plainSnap.fields.name!.kind).toBe("data");
    expect(nullSnap.fields.name!.kind).toBe("data");
    if (plainSnap.fields.name!.kind === "data" && nullSnap.fields.name!.kind === "data") {
      expect(plainSnap.fields.name!.typeHash).not.toBe(nullSnap.fields.name!.typeHash);
    }
  });

  it("nullable() is chainable from any f.* method", () => {
    // All of these should work without throwing
    const s = f.string().nullable().default(null);
    const n = f.number().nullable().default(null);
    const b = f.boolean().nullable().default(null);
    const a = f.array(zod.string()).nullable().default(null);
    const r = f.record(zod.string(), zod.number()).nullable().default(null);

    expect(s._defaultValue).toBe(null);
    expect(n._defaultValue).toBe(null);
    expect(b._defaultValue).toBe(null);
    expect(a._defaultValue).toBe(null);
    expect(r._defaultValue).toBe(null);
  });
});
