import { describe, it, expect, afterEach } from "vitest";
import { Effect } from "effect";
import { createEffectClient } from "../src/v2/client/client";
import type { EffectClientProxy } from "../src/v2/client/client";
import { setup, setupMultiClient, delay, type TestSchema } from "./helpers";

let cleanup: () => void;
afterEach(() => cleanup?.());

function makeEffectClient(ctx: { replica: any }) {
  return createEffectClient<TestSchema>(ctx.replica) as EffectClientProxy<TestSchema>;
}

describe("effect client", () => {
  it("readRoot returns full root snapshot", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;
    const client = makeEffectClient(ctx);

    const root = client.readRoot();
    expect(root.title).toBe("untitled");
  });

  it("field.read returns current value", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;
    const client = makeEffectClient(ctx);

    expect(client.title.read()).toBe("untitled");
  });

  it("field.set returns an Effect that updates state", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;
    const client = makeEffectClient(ctx);

    const effect = client.title.set("new title");
    expect(Effect.isEffect(effect)).toBe(true);

    await Effect.runPromise(effect);
    expect(client.title.read()).toBe("new title");
  });

  it("collection.concat returns an Effect", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;
    const client = makeEffectClient(ctx);

    const effect = client.messages.concat([{ text: "hi", author: "me" }]);
    expect(Effect.isEffect(effect)).toBe(true);

    await Effect.runPromise(effect);
    await delay(20);
  });

  it("update via proxy mutation returns an Effect", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;
    const client = makeEffectClient(ctx);

    const effect = client.update((root) => {
      root.title = "mutated" as any;
    });
    expect(Effect.isEffect(effect)).toBe(true);

    await Effect.runPromise(effect);
    expect(client.title.read()).toBe("mutated");
  });

  it("update via return value returns an Effect", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;
    const client = makeEffectClient(ctx);

    const current = client.readRoot();
    const effect = client.update(() => ({
      ...current,
      title: "replaced" as any,
    }));

    await Effect.runPromise(effect);
    expect(client.title.read()).toBe("replaced");
  });

  it("effects can be composed with yield*", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;
    const client = makeEffectClient(ctx);

    const composed = Effect.gen(function* () {
      yield* client.title.set("step1");
      yield* client.title.set("step2");
    });

    await Effect.runPromise(composed);
    expect(client.title.read()).toBe("step2");
  });

  it("subscribe still works synchronously", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;
    const client = makeEffectClient(ctx);

    const values: string[] = [];
    const unsub = client.title.subscribe((val) => values.push(val as string));

    await Effect.runPromise(client.title.set("changed"));
    await delay(20);

    expect(values).toContain("changed");
    unsub();
  });

  it("blob create returns an Effect", async () => {
    const ctx = await setup();
    cleanup = ctx.cleanup;
    const client = makeEffectClient(ctx);

    const data = new Uint8Array([1, 2, 3]);
    const effect = client.data.set(data);
    expect(Effect.isEffect(effect)).toBe(true);
    await Effect.runPromise(effect);
  });
});
