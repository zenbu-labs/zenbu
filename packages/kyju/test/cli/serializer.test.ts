import { describe, it, expect } from "vitest";
import zod from "zod";
import { createSchema, f } from "../../src/v2/db/schema";
import { serializeSchema, emptySnapshot } from "../../src/cli/serializer";

describe("serializeSchema", () => {
  it("serializes data fields with defaults", () => {
    const schema = createSchema({
      title: f.string().default("hello"),
      count: f.number().default(42),
    });
    const snap = serializeSchema(schema, "id-1", "prev-1");

    expect(snap.id).toBe("id-1");
    expect(snap.prevId).toBe("prev-1");
    expect(snap.fields.title).toEqual({
      kind: "data",
      hasDefault: true,
      default: "hello",
      typeHash: expect.any(String),
    });
    expect(snap.fields.count).toEqual({
      kind: "data",
      hasDefault: true,
      default: 42,
      typeHash: expect.any(String),
    });
  });

  it("serializes data fields without defaults", () => {
    const schema = createSchema({
      name: f.string(),
    });
    const snap = serializeSchema(schema, "id-1", "");

    expect(snap.fields.name).toEqual({
      kind: "data",
      hasDefault: false,
      typeHash: expect.any(String),
    });
    expect("default" in snap.fields.name!).toBe(false);
  });

  it("serializes collection fields", () => {
    const schema = createSchema({
      messages: f.collection(zod.object({ text: zod.string() })),
    });
    const snap = serializeSchema(schema, "id-1", "");

    expect(snap.fields.messages).toEqual({ kind: "collection" });
  });

  it("serializes collection fields with debugName", () => {
    const schema = createSchema({
      logs: f.collection(zod.object({ msg: zod.string() }), { debugName: "app-logs" }),
    });
    const snap = serializeSchema(schema, "id-1", "");

    expect(snap.fields.logs).toEqual({
      kind: "collection",
      debugName: "app-logs",
    });
  });

  it("serializes blob fields", () => {
    const schema = createSchema({
      avatar: f.blob(),
    });
    const snap = serializeSchema(schema, "id-1", "");

    expect(snap.fields.avatar).toEqual({ kind: "blob" });
  });

  it("typeHash is stable for identical schemas", () => {
    const s1 = createSchema({ x: f.string().default("") });
    const s2 = createSchema({ x: f.string().default("") });
    const snap1 = serializeSchema(s1, "a", "");
    const snap2 = serializeSchema(s2, "b", "");

    expect((snap1.fields.x as any).typeHash).toBe(
      (snap2.fields.x as any).typeHash,
    );
  });

  it("typeHash differs for different types", () => {
    const s1 = createSchema({ x: f.string().default("") });
    const s2 = createSchema({ x: f.number().default(0) });
    const snap1 = serializeSchema(s1, "a", "");
    const snap2 = serializeSchema(s2, "b", "");

    expect((snap1.fields.x as any).typeHash).not.toBe(
      (snap2.fields.x as any).typeHash,
    );
  });

  it("serializes complex nested types deterministically", () => {
    const schema = createSchema({
      settings: f.object({
        theme: zod.enum(["light", "dark"]),
        fontSize: zod.number(),
      }).default({ theme: "light", fontSize: 14 }),
      tags: f.array(zod.string()).default([]),
      meta: f.record(zod.string(), zod.number()).default({}),
    });

    const snap1 = serializeSchema(schema, "a", "");
    const snap2 = serializeSchema(schema, "b", "");

    expect((snap1.fields.settings as any).typeHash).toBe(
      (snap2.fields.settings as any).typeHash,
    );
    expect((snap1.fields.tags as any).typeHash).toBe(
      (snap2.fields.tags as any).typeHash,
    );
    expect((snap1.fields.meta as any).typeHash).toBe(
      (snap2.fields.meta as any).typeHash,
    );
  });

  it("serializes mixed field types", () => {
    const schema = createSchema({
      title: f.string().default(""),
      items: f.collection(zod.object({ id: zod.string() })),
      avatar: f.blob(),
      optional: f.string(),
    });
    const snap = serializeSchema(schema, "id-1", "");

    expect(snap.fields.title!.kind).toBe("data");
    expect(snap.fields.items!.kind).toBe("collection");
    expect(snap.fields.avatar!.kind).toBe("blob");
    expect(snap.fields.optional!.kind).toBe("data");
    expect((snap.fields.optional as any).hasDefault).toBe(false);
  });

  it("complex defaults are serialized correctly", () => {
    const schema = createSchema({
      config: f.object({ a: zod.string(), b: zod.number() }).default({ a: "x", b: 1 }),
      list: f.array(zod.string()).default(["a", "b"]),
    });
    const snap = serializeSchema(schema, "id-1", "");

    expect((snap.fields.config as any).default).toEqual({ a: "x", b: 1 });
    expect((snap.fields.list as any).default).toEqual(["a", "b"]);
  });

  it("emptySnapshot has no fields", () => {
    expect(emptySnapshot.fields).toEqual({});
    expect(emptySnapshot.prevId).toBe("");
  });
});
