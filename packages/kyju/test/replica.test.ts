import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  setupMultiClient,
  getConnectedState,
  getState,
  delay,
} from "./helpers";

function getCollectionId(ctx: { replicas: any[] }) {
  return (getConnectedState(ctx.replicas[0]).root as any).messages.collectionId as string;
}

let cleanup: () => void;
afterEach(() => cleanup?.());

describe("replica", () => {
  it("root.set replicates to other clients", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    await ctx.clients[0].title.set("from client A");

    expect(ctx.clients[0].title.read()).toBe("from client A");
    expect(ctx.clients[1].title.read()).toBe("from client A");
  });

  it("concurrent root.set — last writer wins, both replicas converge", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    await ctx.clients[0].title.set("A");
    await ctx.clients[1].title.set("B");

    const a = ctx.clients[0].title.read();
    const b = ctx.clients[1].title.read();
    expect(a).toBe(b);
    expect(a).toBe("B");
  });

  it("collection.concat — concurrent appends have correct totalCount", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    const collectionId = getCollectionId(ctx);
    await ctx.replicas[0].postMessage({ kind: "subscribe-collection", collectionId });
    await ctx.replicas[1].postMessage({ kind: "subscribe-collection", collectionId });

    await Promise.all([
      ctx.clients[0].messages.concat([
        { text: "a1", author: "alice" },
        { text: "a2", author: "alice" },
      ]),
      ctx.clients[1].messages.concat([
        { text: "b1", author: "bob" },
      ]),
    ]);

    const stateA = getConnectedState(ctx.replicas[0]);
    const stateB = getConnectedState(ctx.replicas[1]);
    const rootA = stateA.root as any;
    const rootB = stateB.root as any;

    const colA = stateA.collections.find(
      (c) => c.id === rootA.messages.collectionId,
    );
    const colB = stateB.collections.find(
      (c) => c.id === rootB.messages.collectionId,
    );

    // 2 from A + 1 from B = 3
    expect(colA!.totalCount).toBe(3);
    expect(colB!.totalCount).toBe(3);

    const indexPath = path.join(
      ctx.dbPath,
      "collections",
      collectionId,
      "index.json",
    );
    const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    expect(index.totalCount).toBe(3);
  });

  it("reconnect gives replicas fresh state", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    await ctx.clients[0].title.set("before reconnect");
    expect(ctx.clients[1].title.read()).toBe("before reconnect");

    const oldSessionA = getConnectedState(ctx.replicas[0]).sessionId;
    const oldSessionB = getConnectedState(ctx.replicas[1]).sessionId;

    await ctx.db.reconnectClients();

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const a = getState(ctx.replicas[0]);
      const b = getState(ctx.replicas[1]);
      if (
        a.kind === "connected" &&
        b.kind === "connected" &&
        a.sessionId !== oldSessionA &&
        b.sessionId !== oldSessionB
      ) {
        break;
      }
      await delay(10);
    }

    const stateA = getConnectedState(ctx.replicas[0]);
    const stateB = getConnectedState(ctx.replicas[1]);

    expect(stateA.sessionId).not.toBe(oldSessionA);
    expect(stateB.sessionId).not.toBe(oldSessionB);

    expect((stateA.root as any).title).toBe("before reconnect");
    expect((stateB.root as any).title).toBe("before reconnect");

    expect(stateA.collections).toEqual([]);
    expect(stateB.collections).toEqual([]);
  });
});

describe("collection subscription", () => {
  it("subscribe returns page data in ack", async () => {
    const ctx = await setupMultiClient(1);
    cleanup = ctx.cleanup;

    const collectionId = getCollectionId(ctx);
    await ctx.replicas[0].postMessage({ kind: "subscribe-collection", collectionId });

    const state = getConnectedState(ctx.replicas[0]);
    const col = state.collections.find((c) => c.id === collectionId);
    expect(col).toBeDefined();
    expect(col!.totalCount).toBe(0);
  });

  it("unsubscribe removes collection from replica state", async () => {
    const ctx = await setupMultiClient(1);
    cleanup = ctx.cleanup;

    const collectionId = getCollectionId(ctx);
    await ctx.replicas[0].postMessage({ kind: "subscribe-collection", collectionId });
    expect(getConnectedState(ctx.replicas[0]).collections.length).toBe(1);

    await ctx.replicas[0].postMessage({ kind: "unsubscribe-collection", collectionId });
    expect(getConnectedState(ctx.replicas[0]).collections.length).toBe(0);
  });

  it("after unsubscribe, collection.concat does NOT arrive at that replica", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    const collectionId = getCollectionId(ctx);

    await ctx.replicas[0].postMessage({ kind: "subscribe-collection", collectionId });
    await ctx.replicas[1].postMessage({ kind: "subscribe-collection", collectionId });
    await ctx.replicas[1].postMessage({ kind: "unsubscribe-collection", collectionId });

    await ctx.clients[0].messages.concat([{ text: "after unsub", author: "alice" }]);

    const stateB = getConnectedState(ctx.replicas[1]);
    const colB = stateB.collections.find((c) => c.id === collectionId);
    expect(colB).toBeUndefined();
  });

  it("subscribed replica receives concat, unsubscribed does not", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    const collectionId = getCollectionId(ctx);

    await ctx.replicas[0].postMessage({ kind: "subscribe-collection", collectionId });

    await ctx.clients[1].messages.concat([{ text: "from B", author: "bob" }]);

    const stateA = getConnectedState(ctx.replicas[0]);
    const colA = stateA.collections.find((c) => c.id === collectionId);
    expect(colA).toBeDefined();
    expect(colA!.totalCount).toBe(1);

    const stateB = getConnectedState(ctx.replicas[1]);
    const colB = stateB.collections.find((c) => c.id === collectionId);
    expect(colB).toBeUndefined();
  });

  it("concurrent subscribe + concat — no data missed", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    const collectionId = getCollectionId(ctx);

    await ctx.replicas[0].postMessage({ kind: "subscribe-collection", collectionId });
    await ctx.replicas[1].postMessage({ kind: "subscribe-collection", collectionId });

    await Promise.all([
      ctx.clients[0].messages.concat([{ text: "a1", author: "alice" }]),
      ctx.clients[1].messages.concat([{ text: "b1", author: "bob" }]),
    ]);

    const stateA = getConnectedState(ctx.replicas[0]);
    const colA = stateA.collections.find((c) => c.id === collectionId);
    const stateB = getConnectedState(ctx.replicas[1]);
    const colB = stateB.collections.find((c) => c.id === collectionId);

    // 1 from A + 1 from B = 2
    expect(colA!.totalCount).toBe(2);
    expect(colB!.totalCount).toBe(2);
  });

  it("disconnect cleans up subscriptions — reconnected replica does not receive old broadcasts", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    const collectionId = getCollectionId(ctx);
    await ctx.replicas[0].postMessage({ kind: "subscribe-collection", collectionId });

    await ctx.replicas[0].postMessage({ kind: "disconnect" });
    await ctx.replicas[0].postMessage({ kind: "connect", version: 0 });

    await ctx.clients[1].messages.concat([{ text: "after reconnect", author: "bob" }]);

    const stateA = getConnectedState(ctx.replicas[0]);
    expect(stateA.collections.length).toBe(0);
  });

  it("collection.read merges pages into existing collection without losing subscribed pages", async () => {
    const ctx = await setupMultiClient(1);
    cleanup = ctx.cleanup;

    const collectionId = getCollectionId(ctx);

    await ctx.clients[0].messages.concat([
      { text: "m1", author: "alice" },
      { text: "m2", author: "alice" },
    ]);

    await ctx.replicas[0].postMessage({ kind: "subscribe-collection", collectionId });

    const stateBefore = getConnectedState(ctx.replicas[0]);
    const colBefore = stateBefore.collections.find((c) => c.id === collectionId);
    expect(colBefore).toBeDefined();
    const pageCountBefore = colBefore!.pages.length;
    expect(colBefore!.totalCount).toBe(2);

    await ctx.replicas[0].postMessage({
      kind: "read",
      op: { type: "collection.read", collectionId, range: { start: 0, end: 0 } },
    });

    const stateAfter = getConnectedState(ctx.replicas[0]);
    const colAfter = stateAfter.collections.find((c) => c.id === collectionId);
    expect(colAfter).toBeDefined();
    expect(colAfter!.pages.length).toBeGreaterThanOrEqual(pageCountBefore);
    expect(colAfter!.totalCount).toBe(2);

    const hotPages = colAfter!.pages.filter((p) => p.data.kind === "hot");
    const totalItems = hotPages.reduce(
      (sum, p) => sum + (p.data.kind === "hot" ? p.data.items.length : 0),
      0,
    );
    expect(totalItems).toBe(2);
  });

  it("collection.read does not lose streaming data from subscribed pages", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    const collectionId = getCollectionId(ctx);

    await ctx.clients[0].messages.concat([
      { text: "initial", author: "alice" },
    ]);

    await ctx.replicas[0].postMessage({ kind: "subscribe-collection", collectionId });
    await ctx.replicas[1].postMessage({ kind: "subscribe-collection", collectionId });

    const stateBeforeRead = getConnectedState(ctx.replicas[0]);
    const colBeforeRead = stateBeforeRead.collections.find((c) => c.id === collectionId);
    expect(colBeforeRead!.totalCount).toBe(1);

    await ctx.replicas[0].postMessage({
      kind: "read",
      op: { type: "collection.read", collectionId, range: { start: 0, end: 0 } },
    });

    const stateAfterRead = getConnectedState(ctx.replicas[0]);
    const colAfterRead = stateAfterRead.collections.find((c) => c.id === collectionId);
    expect(colAfterRead).toBeDefined();
    expect(colAfterRead!.totalCount).toBe(1);

    const hotItems = colAfterRead!.pages
      .filter((p) => p.data.kind === "hot")
      .flatMap((p) => (p.data.kind === "hot" ? p.data.items : []));
    expect(hotItems.length).toBe(1);
    expect((hotItems[0] as any).text).toBe("initial");
  });

  it("collection.concat callback fires on replicated write", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    const collectionId = getCollectionId(ctx);
    await ctx.replicas[0].postMessage({ kind: "subscribe-collection", collectionId });

    const received: any[] = [];
    const cb = (data: any) => received.push(data);
    ctx.replicas[0].onCollectionConcat(collectionId, cb);

    await ctx.clients[1].messages.concat([{ text: "live", author: "bob" }]);

    expect(received.length).toBe(1);
    expect(received[0].newItems).toEqual([{ text: "live", author: "bob" }]);
    expect(received[0].collectionId).toBe(collectionId);

    ctx.replicas[0].offCollectionConcat(collectionId, cb);
  });
});
