import { describe, it, expect, afterEach } from "vitest";
import { nanoid } from "nanoid";
import fs from "node:fs";
import path from "node:path";
import { setup, getConnectedState } from "./helpers";
import { VERSION } from "../src/v2/shared";

let cleanup: () => void;
afterEach(() => cleanup?.());

describe("root.set", () => {
  it("sets a top-level field", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.title.set("hello");
    expect(ctx.client.title.read()).toBe("hello");

    const rootJson = JSON.parse(
      fs.readFileSync(path.join(ctx.dbPath, "root.json"), "utf-8"),
    );
    expect(rootJson.title).toBe("hello");
  });

  it("sets a nested path", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.replica.postMessage({
      kind: "write",
      op: { type: "root.set", path: ["meta", "version"], value: 42 },
    });

    const root = ctx.client.readRoot() as any;
    expect(root.meta.version).toBe(42);
  });

  it("overwrites existing field (last-writer-wins)", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.title.set("first");
    await ctx.client.title.set("second");
    expect(ctx.client.title.read()).toBe("second");
  });
});

describe("collection.create", () => {
  it("schema init creates empty collection", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const root = ctx.client.readRoot() 
    const collectionId = root.messages.collectionId;
    expect(collectionId).toBeDefined();

    await ctx.client.messages.read();
    const state = getConnectedState(ctx.replica);
    const col = state.collections.find((c) => c.id === collectionId);
    expect(col).toBeDefined();
    expect(col!.totalCount).toBe(0);
  });

  it("creates an empty collection", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const collectionId = nanoid();
    await ctx.replica.postMessage({
      kind: "write",
      op: { type: "collection.create", collectionId },
    });

    await ctx.replica.postMessage({
      kind: "read",
      op: { type: "collection.read", collectionId },
    });

    const state = getConnectedState(ctx.replica);
    const col = state.collections.find((c) => c.id === collectionId);
    expect(col).toBeDefined();
    expect(col!.totalCount).toBe(0);
  });
});

describe("collection.concat", () => {
  it("appends items and reads them back", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.messages.concat([
      { text: "hello", author: "alice" },
      { text: "world", author: "bob" },
    ]);

    await ctx.client.messages.read();
    const state = getConnectedState(ctx.replica);
    const root = ctx.client.readRoot() as any;
    const col = state.collections.find(
      (c) => c.id === root.messages.collectionId,
    );
    expect(col!.totalCount).toBe(2);

    const items =
      col!.pages.flatMap((p) =>
        p.data.kind === "hot" ? p.data.items : [],
      );
    expect(items).toEqual([
      { text: "hello", author: "alice" },
      { text: "world", author: "bob" },
    ]);
  });

  it("creates a new page when maxPageSize exceeded", async () => {
    const ctx = await setup({ maxPageSize: 50 });
    cleanup = ctx.cleanup;

    await ctx.client.messages.concat([
      { text: "fill-page-one", author: "bot" },
      { text: "fill-page-two", author: "bot" },
    ]);
    await ctx.client.messages.concat([
      { text: "overflow", author: "bot" },
    ]);

    await ctx.client.messages.read();
    const state = getConnectedState(ctx.replica);
    const root = ctx.client.readRoot() as any;
    const col = state.collections.find(
      (c) => c.id === root.messages.collectionId,
    );
    expect(col!.pages.length).toBeGreaterThanOrEqual(2);
  });
});

describe("collection.delete", () => {
  it("deletes a collection", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const root = ctx.client.readRoot() as any;
    const collectionId = root.messages.collectionId;
    const collectionDir = path.join(ctx.dbPath, "collections", collectionId);
    expect(fs.existsSync(collectionDir)).toBe(true);

    await ctx.client.messages.delete();
    expect(fs.existsSync(collectionDir)).toBe(false);
  });

  it("rejects delete when references exist and checkReferences is on", async () => {
    const ctx = await setup({ checkReferences: true });
    cleanup = ctx.cleanup;

    const root = ctx.client.readRoot() as any;
    const collectionDir = path.join(
      ctx.dbPath,
      "collections",
      root.messages.collectionId,
    );

    await ctx.client.messages.delete();
    // collection should still exist because root still references it
    expect(fs.existsSync(collectionDir)).toBe(true);
  });
});

describe("blob", () => {
  it("schema init creates blob, read returns data", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const root = ctx.client.readRoot() as any;
    expect(root.data.blobId).toBeDefined();

    await ctx.client.data.read();
    const state = getConnectedState(ctx.replica);
    const blob = state.blobs.find((b) => b.id === root.data.blobId);
    expect(blob).toBeDefined();
    expect(blob!.data.kind).toBe("hot");
  });

  it("sets blob data and reads it back", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const payload = new TextEncoder().encode("hello blob");
    await ctx.client.data.set(payload);

    await ctx.client.data.read();
    const state = getConnectedState(ctx.replica);
    const root = ctx.client.readRoot() as any;
    const blob = state.blobs.find((b) => b.id === root.data.blobId);
    expect(blob!.data.kind).toBe("hot");
    if (blob!.data.kind === "hot") {
      expect(new TextDecoder().decode(blob!.data.value)).toBe("hello blob");
    }
  });

  it("deletes a blob", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const root = ctx.client.readRoot() as any;
    const blobDir = path.join(ctx.dbPath, "blobs", root.data.blobId);
    expect(fs.existsSync(blobDir)).toBe(true);

    await ctx.client.data.delete();
    expect(fs.existsSync(blobDir)).toBe(false);
  });

  it("rejects blob delete when references exist and checkReferences is on", async () => {
    const ctx = await setup({ checkReferences: true });
    cleanup = ctx.cleanup;

    const root = ctx.client.readRoot() as any;
    const blobDir = path.join(ctx.dbPath, "blobs", root.data.blobId);

    await ctx.client.data.delete();
    expect(fs.existsSync(blobDir)).toBe(true);
  });
});

describe("connect / disconnect", () => {
  it("connect returns root state", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const state = getConnectedState(ctx.replica);
    expect(state.sessionId).toBeDefined();
    const root = state.root as any;
    expect(root.title).toBe("untitled");
    expect(root.messages.collectionId).toBeDefined();
  });

  it("disconnect cleans up session", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.replica.postMessage({ kind: "disconnect" });
    expect(() => getConnectedState(ctx.replica)).toThrow();
  });
});
