import { describe, it, expect, afterEach } from "vitest";
import { setup, setupMultiClient, getConnectedState, delay } from "./helpers";

let cleanup: () => void;
afterEach(() => cleanup?.());

describe("client", () => {
  it("readRoot returns full root snapshot", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const root = ctx.client.readRoot();
    expect(root.title).toBe("untitled");
    expect(root.messages.collectionId).toBeDefined();
    expect(root.data.blobId).toBeDefined();
  });

  it("field.read returns current value", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    expect(ctx.client.title.read()).toBe("untitled");
  });

  it("field.set updates and persists", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.title.set("new title");
    expect(ctx.client.title.read()).toBe("new title");
  });

  it("field.subscribe fires on changes", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const values: string[] = [];
    const unsub = ctx.client.title.subscribe((v) => values.push(v));

    await ctx.client.title.set("one");
    await ctx.client.title.set("two");

    // give the subscription stream a tick to deliver
    await delay(10);
    unsub();

    expect(values).toContain("one");
    expect(values).toContain("two");
  });

  it("collection.concat appends items", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.messages.concat([
      { text: "msg1", author: "alice" },
    ]);

    await ctx.client.messages.read();
    const state = getConnectedState(ctx.replica);
    const root = ctx.client.readRoot() as any;
    const col = state.collections.find(
      (c) => c.id === root.messages.collectionId,
    );
    expect(col!.totalCount).toBe(1);
  });

  it("update via proxy mutation records set ops", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.update((root) => {
      root.title = "mutated" as any;
    });

    expect(ctx.client.title.read()).toBe("mutated");
  });

  it("update via proxy mutation works with arrays (push)", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.update((root) => {
      (root as any).tags = ["a", "b"];
    });

    expect((ctx.client.readRoot() as any).tags).toEqual(["a", "b"]);

    await ctx.client.update((root) => {
      (root as any).tags.push("c");
    });

    expect((ctx.client.readRoot() as any).tags).toEqual(["a", "b", "c"]);
  });

  it("update via proxy mutation works with array element mutation", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.update((root) => {
      (root as any).items = [
        { id: "1", active: true },
        { id: "2", active: false },
      ];
    });

    await ctx.client.update((root) => {
      const items = (root as any).items;
      items.forEach((item: any) => (item.active = false));
      items[1].active = true;
    });

    const items = (ctx.client.readRoot() as any).items;
    expect(Array.isArray(items)).toBe(true);
    expect(items[0].active).toBe(false);
    expect(items[1].active).toBe(true);
  });

  it("update via proxy mutation works with splice", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.update((root) => {
      (root as any).list = ["a", "b", "c"];
    });

    await ctx.client.update((root) => {
      (root as any).list.splice(1, 1);
    });

    const list = (ctx.client.readRoot() as any).list;
    expect(Array.isArray(list)).toBe(true);
    expect(list).toEqual(["a", "c"]);
  });

  it("update via proxy mutation preserves array shape for nested object edits", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.update((root) => {
      (root as any).configOptions = [
        { id: "model", currentValue: "medium" },
        { id: "thought_level", currentValue: "high" },
      ];
    });

    await ctx.client.update((root) => {
      const opt = (root as any).configOptions.find(
        (o: any) => o.id === "thought_level",
      );
      if (opt) opt.currentValue = "xhigh";
    });

    const configOptions = (ctx.client.readRoot() as any).configOptions;
    expect(Array.isArray(configOptions)).toBe(true);
    expect(configOptions[1].currentValue).toBe("xhigh");
    expect(configOptions).toEqual([
      { id: "model", currentValue: "medium" },
      { id: "thought_level", currentValue: "xhigh" },
    ]);
  });

  it("update via return value replaces root", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const current = ctx.client.readRoot();
    await ctx.client.update(() => ({
      ...current,
      title: "replaced" as any,
    }));

    expect(ctx.client.title.read()).toBe("replaced");
  });

  it("blob create / set / read round-trip", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const payload = new TextEncoder().encode("binary data");
    await ctx.client.data.set(payload);

    await ctx.client.data.read();
    const state = getConnectedState(ctx.replica);
    const root = ctx.client.readRoot() as any;
    const blob = state.blobs.find((b) => b.id === root.data.blobId);
    expect(blob!.data.kind).toBe("hot");
    if (blob!.data.kind === "hot") {
      expect(new TextDecoder().decode(blob!.data.value)).toBe("binary data");
    }
  });
});

describe("client getBlobData", () => {
  it("returns data for a hot blob immediately", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const payload = new TextEncoder().encode("hot blob");
    const blobId = await ctx.client.createBlob(payload, true);

    const data = await ctx.client.getBlobData(blobId);
    expect(data).not.toBeNull();
    expect(new TextDecoder().decode(data!)).toBe("hot blob");
  });

  it("auto-warms a cold blob from disk", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    // Create blob as cold (not hot in memory)
    const payload = new TextEncoder().encode("cold blob");
    const blobId = await ctx.client.createBlob(payload, false);

    // Verify it's cold in the replica state
    const state = getConnectedState(ctx.replica);
    const blob = state.blobs.find((b) => b.id === blobId);
    expect(blob).toBeDefined();
    expect(blob!.data.kind).toBe("cold");

    // getBlobData should auto-warm it
    const data = await ctx.client.getBlobData(blobId);
    expect(data).not.toBeNull();
    expect(new TextDecoder().decode(data!)).toBe("cold blob");

    // Verify it's now hot in state
    const newState = getConnectedState(ctx.replica);
    const warmed = newState.blobs.find((b) => b.id === blobId);
    expect(warmed!.data.kind).toBe("hot");
  });

  it("auto-warms a blob after reconnect (simulating page reload)", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    // Create a hot blob
    const payload = new TextEncoder().encode("survives reconnect");
    const blobId = await ctx.client.createBlob(payload, true);

    // Verify it's hot
    let data = await ctx.client.getBlobData(blobId);
    expect(data).not.toBeNull();

    // Simulate reconnect — replica loses all blob state
    await ctx.replica.postMessage({ kind: "disconnect" });
    await ctx.replica.postMessage({ kind: "connect", version: 0 });

    // After reconnect, blobs array is empty
    const stateAfterReconnect = getConnectedState(ctx.replica);
    expect(stateAfterReconnect.blobs).toEqual([]);

    // getBlobData should still return the data by warming from disk
    data = await ctx.client.getBlobData(blobId);
    expect(data).not.toBeNull();
    expect(new TextDecoder().decode(data!)).toBe("survives reconnect");
  });

  it("returns null for a non-existent blob", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const data = await ctx.client.getBlobData("does-not-exist");
    expect(data).toBeNull();
  });
});

describe("client subscribeData", () => {
  it("returns initial page data on subscribe", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    await ctx.client.messages.concat([{ text: "welcome", author: "system" }]);

    const received: any[] = [];
    const unsub = ctx.client.messages.subscribeData((data) => {
      received.push(data);
    });

    await delay(50);

    expect(received.length).toBeGreaterThanOrEqual(1);
    const initial = received[0];
    expect(initial.collection).toBeDefined();
    expect(initial.newItems).toEqual([{ text: "welcome", author: "system" }]);

    unsub();
  });

  it("receives live updates from another replica", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    const received: any[] = [];
    const unsub = ctx.clients[0].messages.subscribeData((data) => {
      received.push(data);
    });

    await delay(20);
    const initialCount = received.length;

    await ctx.clients[1].messages.concat([{ text: "live-msg", author: "bob" }]);
    await delay(20);

    expect(received.length).toBeGreaterThan(initialCount);
    const update = received[received.length - 1];
    expect(update.newItems).toEqual([{ text: "live-msg", author: "bob" }]);

    unsub();
  });

  it("local concat triggers subscribeData callback on the same client", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const received: any[] = [];
    const unsub = ctx.client.messages.subscribeData((data) => {
      received.push(data);
    });

    await delay(20);
    const initialCount = received.length;

    await ctx.client.messages.concat([{ text: "own-msg", author: "me" }]);

    expect(received.length).toBeGreaterThan(initialCount);
    const update = received[received.length - 1];
    expect(update.newItems).toEqual([{ text: "own-msg", author: "me" }]);

    unsub();
  });

  it("multiple subscribers share one server subscription", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const received1: any[] = [];
    const received2: any[] = [];
    const unsub1 = ctx.client.messages.subscribeData((data) => {
      received1.push(data);
    });
    const unsub2 = ctx.client.messages.subscribeData((data) => {
      received2.push(data);
    });

    await delay(50);

    expect(received1.length).toBeGreaterThanOrEqual(1);
    expect(received2.length).toBeGreaterThanOrEqual(1);

    const state = getConnectedState(ctx.replica);
    const collectionId = (ctx.client.readRoot() as any).messages.collectionId;
    const col = state.collections.find((c) => c.id === collectionId);
    expect(col).toBeDefined();

    unsub1();

    expect(col).toBeDefined();

    unsub2();
  });

  it("last unsubscribe triggers server unsubscribe and cleans up collection from state", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const unsub = ctx.client.messages.subscribeData(() => {});
    await delay(20);

    const collectionId = (ctx.client.readRoot() as any).messages.collectionId;
    let state = getConnectedState(ctx.replica);
    expect(state.collections.some((c) => c.id === collectionId)).toBe(true);

    unsub();
    await delay(20);

    state = getConnectedState(ctx.replica);
    expect(state.collections.some((c) => c.id === collectionId)).toBe(false);
  });

  it("subscribeData callback fires for own concat", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;

    const received: { newItems: any[] }[] = [];
    const unsub = ctx.client.messages.subscribeData((data) => {
      received.push({ newItems: data.newItems });
    });

    await delay(20);
    const beforeCount = received.length;

    await ctx.client.messages.concat([{ text: "own-write", author: "self" }]);
    await delay(50);

    const afterWrites = received.slice(beforeCount);
    const matchingCallbacks = afterWrites.filter(
      (r) => r.newItems.some((item) => item.text === "own-write"),
    );
    expect(matchingCallbacks.length).toBeGreaterThanOrEqual(1);

    unsub();
  });

  it("concurrent concat from another replica triggers callback with correct newItems", async () => {
    const ctx = await setupMultiClient(2);
    cleanup = ctx.cleanup;

    const received: any[] = [];
    const unsub = ctx.clients[0].messages.subscribeData((data) => {
      received.push(data);
    });

    await delay(20);

    await Promise.all([
      ctx.clients[1].messages.concat([{ text: "c1", author: "alice" }]),
      ctx.clients[1].messages.concat([{ text: "c2", author: "bob" }]),
    ]);
    await delay(20);

    const concatUpdates = received.filter(
      (r) => r.newItems.length === 1 && (r.newItems[0].text === "c1" || r.newItems[0].text === "c2"),
    );
    expect(concatUpdates.length).toBe(2);

    unsub();
  });

  it("subscribeData returns all pages after reconnect (not just last page)", async () => {
    // Use a tiny maxPageSize to force multiple pages
    const ctx = await setup({ maxPageSize: 50 });
    cleanup = ctx.cleanup;

    // Write enough data to create multiple pages
    await ctx.client.messages.concat([
      { text: "page-one-msg-a", author: "alice" },
      { text: "page-one-msg-b", author: "bob" },
    ]);
    await ctx.client.messages.concat([
      { text: "page-two-msg", author: "charlie" },
    ]);

    // Verify we have multiple pages via a read
    await ctx.client.messages.read();
    const stateBefore = getConnectedState(ctx.replica);
    const collectionId = (ctx.client.readRoot() as any).messages.collectionId;
    const colBefore = stateBefore.collections.find((c) => c.id === collectionId);
    expect(colBefore!.pages.length).toBeGreaterThanOrEqual(2);

    // Simulate app reload: disconnect and reconnect
    await ctx.replica.postMessage({ kind: "disconnect" });
    await ctx.replica.postMessage({ kind: "connect", version: 0 });

    // Subscribe after reconnect — should get ALL pages
    const received: any[] = [];
    const unsub = ctx.client.messages.subscribeData((data) => {
      received.push(data);
    });

    await delay(50);

    // Collect all items from the initial subscribe callback
    const allItems = received.flatMap((r) => r.newItems);
    const texts = allItems.map((item: any) => item.text);

    expect(texts).toContain("page-one-msg-a");
    expect(texts).toContain("page-one-msg-b");
    expect(texts).toContain("page-two-msg");

    unsub();
  });
});
