import { describe, it, expect } from "vitest";
import { diffSnapshots } from "../../src/cli/differ";
import type { SchemaSnapshot } from "../../src/cli/serializer";
import { emptySnapshot } from "../../src/cli/serializer";

function makeSnapshot(
  fields: SchemaSnapshot["fields"],
  id = "snap-1",
  prevId = "",
): SchemaSnapshot {
  return { id, prevId, fields };
}

describe("diffSnapshots", () => {
  it("empty -> schema with fields = all adds", () => {
    const next = makeSnapshot({
      title: { kind: "data", hasDefault: true, default: "", typeHash: "abc" },
      items: { kind: "collection" },
    });
    const ops = diffSnapshots(emptySnapshot, next);

    expect(ops).toHaveLength(2);
    expect(ops).toContainEqual({
      op: "add",
      key: "title",
      kind: "data",
      hasDefault: true,
      default: "",
    });
    expect(ops).toContainEqual({ op: "add", key: "items", kind: "collection" });
  });

  it("add fields produces add ops", () => {
    const prev = makeSnapshot({
      title: { kind: "data", hasDefault: true, default: "", typeHash: "abc" },
    });
    const next = makeSnapshot({
      title: { kind: "data", hasDefault: true, default: "", typeHash: "abc" },
      count: { kind: "data", hasDefault: true, default: 0, typeHash: "def" },
    });
    const ops = diffSnapshots(prev, next);

    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      op: "add",
      key: "count",
      kind: "data",
      hasDefault: true,
      default: 0,
    });
  });

  it("remove fields produces remove ops", () => {
    const prev = makeSnapshot({
      title: { kind: "data", hasDefault: true, default: "", typeHash: "abc" },
      obsolete: { kind: "data", hasDefault: true, default: "", typeHash: "xyz" },
    });
    const next = makeSnapshot({
      title: { kind: "data", hasDefault: true, default: "", typeHash: "abc" },
    });
    const ops = diffSnapshots(prev, next);

    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({ op: "remove", key: "obsolete", kind: "data" });
  });

  it("remove collection produces remove op with collection kind", () => {
    const prev = makeSnapshot({
      messages: { kind: "collection" },
    });
    const next = makeSnapshot({});
    const ops = diffSnapshots(prev, next);

    expect(ops).toEqual([{ op: "remove", key: "messages", kind: "collection" }]);
  });

  it("remove blob produces remove op with blob kind", () => {
    const prev = makeSnapshot({
      avatar: { kind: "blob" },
    });
    const next = makeSnapshot({});
    const ops = diffSnapshots(prev, next);

    expect(ops).toEqual([{ op: "remove", key: "avatar", kind: "blob" }]);
  });

  it("add + remove in same diff", () => {
    const prev = makeSnapshot({
      old: { kind: "data", hasDefault: true, default: "", typeHash: "abc" },
    });
    const next = makeSnapshot({
      fresh: { kind: "data", hasDefault: true, default: 0, typeHash: "def" },
    });
    const ops = diffSnapshots(prev, next);

    expect(ops).toHaveLength(2);
    expect(ops.find((o) => o.op === "add" && o.key === "fresh")).toBeTruthy();
    expect(ops.find((o) => o.op === "remove" && o.key === "old")).toBeTruthy();
  });

  it("unchanged schema produces empty ops", () => {
    const snap = makeSnapshot({
      title: { kind: "data", hasDefault: true, default: "", typeHash: "abc" },
      items: { kind: "collection" },
    });
    const ops = diffSnapshots(snap, snap);

    expect(ops).toHaveLength(0);
  });

  it("field kind change (data -> collection) produces alter op", () => {
    const prev = makeSnapshot({
      items: { kind: "data", hasDefault: true, default: [], typeHash: "abc" },
    });
    const next = makeSnapshot({
      items: { kind: "collection" },
    });
    const ops = diffSnapshots(prev, next);

    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("alter");
    expect(ops[0]!.key).toBe("items");
    expect((ops[0] as any).changes.kindChanged).toEqual({
      from: "data",
      to: "collection",
    });
  });

  it("field type change (different typeHash) produces alter op", () => {
    const prev = makeSnapshot({
      count: { kind: "data", hasDefault: true, default: 0, typeHash: "string-hash" },
    });
    const next = makeSnapshot({
      count: { kind: "data", hasDefault: true, default: 0, typeHash: "number-hash" },
    });
    const ops = diffSnapshots(prev, next);

    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("alter");
    expect((ops[0] as any).changes.typeHash).toEqual({
      from: "string-hash",
      to: "number-hash",
    });
  });

  it("default value change produces alter op", () => {
    const prev = makeSnapshot({
      title: { kind: "data", hasDefault: true, default: "old", typeHash: "abc" },
    });
    const next = makeSnapshot({
      title: { kind: "data", hasDefault: true, default: "new", typeHash: "abc" },
    });
    const ops = diffSnapshots(prev, next);

    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("alter");
    expect((ops[0] as any).changes.default).toEqual({
      from: "old",
      to: "new",
    });
  });

  it("adding collection with debugName preserves it", () => {
    const next = makeSnapshot({
      logs: { kind: "collection", debugName: "app-logs" },
    });
    const ops = diffSnapshots(emptySnapshot, next);

    expect(ops).toEqual([
      { op: "add", key: "logs", kind: "collection", debugName: "app-logs" },
    ]);
  });

  it("adding data field without default", () => {
    const next = makeSnapshot({
      optional: { kind: "data", hasDefault: false, typeHash: "abc" },
    });
    const ops = diffSnapshots(emptySnapshot, next);

    expect(ops).toEqual([
      { op: "add", key: "optional", kind: "data", hasDefault: false },
    ]);
  });

  it("object defaults with different key ordering should not produce alter op", () => {
    const prev = makeSnapshot({
      config: {
        kind: "data",
        hasDefault: true,
        default: { alpha: 1, beta: 2, gamma: 3 },
        typeHash: "abc",
      },
    });
    const next = makeSnapshot({
      config: {
        kind: "data",
        hasDefault: true,
        default: { gamma: 3, alpha: 1, beta: 2 },
        typeHash: "abc",
      },
    });
    const ops = diffSnapshots(prev, next);
    expect(ops).toHaveLength(0);
  });

  it("nested object defaults with different key ordering should not produce alter op", () => {
    const prev = makeSnapshot({
      config: {
        kind: "data",
        hasDefault: true,
        default: { a: { x: 1, y: 2 }, b: "hello" },
        typeHash: "abc",
      },
    });
    const next = makeSnapshot({
      config: {
        kind: "data",
        hasDefault: true,
        default: { b: "hello", a: { y: 2, x: 1 } },
        typeHash: "abc",
      },
    });
    const ops = diffSnapshots(prev, next);
    expect(ops).toHaveLength(0);
  });

  it("actually different object defaults should still produce alter op", () => {
    const prev = makeSnapshot({
      config: {
        kind: "data",
        hasDefault: true,
        default: { a: 1, b: 2 },
        typeHash: "abc",
      },
    });
    const next = makeSnapshot({
      config: {
        kind: "data",
        hasDefault: true,
        default: { a: 1, b: 3 },
        typeHash: "abc",
      },
    });
    const ops = diffSnapshots(prev, next);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.op).toBe("alter");
  });

  it("array defaults with same elements should not produce alter op", () => {
    const prev = makeSnapshot({
      tags: {
        kind: "data",
        hasDefault: true,
        default: [1, 2, 3],
        typeHash: "abc",
      },
    });
    const next = makeSnapshot({
      tags: {
        kind: "data",
        hasDefault: true,
        default: [1, 2, 3],
        typeHash: "abc",
      },
    });
    const ops = diffSnapshots(prev, next);
    expect(ops).toHaveLength(0);
  });

  it("undefined vs missing default should not produce alter op", () => {
    const prev = makeSnapshot({
      x: { kind: "data", hasDefault: false, typeHash: "abc" },
    });
    const next = makeSnapshot({
      x: { kind: "data", hasDefault: false, default: undefined, typeHash: "abc" },
    });
    const ops = diffSnapshots(prev, next);
    expect(ops).toHaveLength(0);
  });

  it("multiple field changes in a single diff", () => {
    const prev = makeSnapshot({
      keep: { kind: "data", hasDefault: true, default: "x", typeHash: "111" },
      remove_me: { kind: "data", hasDefault: true, default: "", typeHash: "222" },
      alter_me: { kind: "data", hasDefault: true, default: "old", typeHash: "333" },
    });
    const next = makeSnapshot({
      keep: { kind: "data", hasDefault: true, default: "x", typeHash: "111" },
      add_me: { kind: "collection" },
      alter_me: { kind: "data", hasDefault: true, default: "new", typeHash: "333" },
    });
    const ops = diffSnapshots(prev, next);

    expect(ops.find((o) => o.op === "add" && o.key === "add_me")).toBeTruthy();
    expect(ops.find((o) => o.op === "remove" && o.key === "remove_me")).toBeTruthy();
    expect(ops.find((o) => o.op === "alter" && o.key === "alter_me")).toBeTruthy();
    expect(ops.find((o) => o.key === "keep")).toBeFalsy();
  });
});
