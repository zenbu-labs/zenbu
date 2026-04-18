import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import type { FirstPromptLatch } from "../src/agent.ts";

/**
 * Exercises the durability semantics the Agent relies on: the preamble should
 * fire exactly once per "truly first" prompt, with the latch as the source of
 * truth. If the latch is persistent (e.g. backed by a DB field), tearing down
 * and recreating the hosting object must NOT cause the preamble to re-fire.
 *
 * This mirrors Agent#_computePreamble in packages/agent/src/agent.ts — if the
 * Agent's gating logic diverges from this, either the test or the Agent is
 * wrong.
 */
const computePreamble = (opts: {
  preamble?: () => Effect.Effect<string[], unknown>;
  latch?: FirstPromptLatch;
  inMemory: { fired: boolean };
}) =>
  Effect.gen(function* () {
    if (!opts.preamble) return [] as string[];
    let alreadyFired: boolean;
    if (opts.latch) {
      alreadyFired = yield* opts.latch
        .hasFired()
        .pipe(Effect.catchAll(() => Effect.succeed(false)));
    } else {
      alreadyFired = opts.inMemory.fired;
    }
    if (alreadyFired) return [] as string[];
    const blocks = yield* opts
      .preamble()
      .pipe(Effect.catchAll(() => Effect.succeed([] as string[])));
    if (opts.latch) {
      yield* opts.latch.markFired().pipe(Effect.catchAll(() => Effect.void));
    } else {
      opts.inMemory.fired = true;
    }
    return blocks;
  });

function makePersistentLatch(store: { fired: boolean }): FirstPromptLatch {
  return {
    hasFired: () => Effect.sync(() => store.fired),
    markFired: () => Effect.sync(() => { store.fired = true; }),
  };
}

describe("first-prompt latch", () => {
  it("fires preamble on first call, skips on second", async () => {
    let calls = 0;
    const inMemory = { fired: false };
    const preamble = () =>
      Effect.sync(() => {
        calls++;
        return ["PREAMBLE"];
      });

    const a = await Effect.runPromise(computePreamble({ preamble, inMemory }));
    expect(a).toEqual(["PREAMBLE"]);
    expect(calls).toBe(1);

    const b = await Effect.runPromise(computePreamble({ preamble, inMemory }));
    expect(b).toEqual([]);
    expect(calls).toBe(1);
  });

  it("persistent latch survives process-restart simulation", async () => {
    // Shared "DB row": survives tearing down and rebuilding the hosting state.
    const store = { fired: false };

    // "Process 1": fresh in-memory state, shared persistent latch.
    const process1InMem = { fired: false };
    const latch1 = makePersistentLatch(store);
    let preambleCalls = 0;
    const preamble = () =>
      Effect.sync(() => {
        preambleCalls++;
        return ["PREAMBLE"];
      });

    const first = await Effect.runPromise(
      computePreamble({ preamble, latch: latch1, inMemory: process1InMem }),
    );
    expect(first).toEqual(["PREAMBLE"]);
    expect(store.fired).toBe(true);

    // Tear down process 1. Simulate restart: new in-memory state, same store.
    const process2InMem = { fired: false };
    const latch2 = makePersistentLatch(store);
    const second = await Effect.runPromise(
      computePreamble({ preamble, latch: latch2, inMemory: process2InMem }),
    );
    expect(second).toEqual([]);
    expect(preambleCalls).toBe(1);
  });

  it("different latches (new agent) fire independently", async () => {
    let calls = 0;
    const preamble = () =>
      Effect.sync(() => {
        calls++;
        return ["PREAMBLE"];
      });
    const latchA = makePersistentLatch({ fired: false });
    const latchB = makePersistentLatch({ fired: false });

    await Effect.runPromise(
      computePreamble({
        preamble,
        latch: latchA,
        inMemory: { fired: false },
      }),
    );
    await Effect.runPromise(
      computePreamble({
        preamble,
        latch: latchB,
        inMemory: { fired: false },
      }),
    );
    expect(calls).toBe(2);
  });

  it("latch fires even when preamble fails — prevents infinite retry", async () => {
    const store = { fired: false };
    const latch = makePersistentLatch(store);
    let calls = 0;
    const preamble = () =>
      Effect.fail(new Error("scan failed")).pipe(
        Effect.tap(() => Effect.sync(() => { calls++; })),
      );

    const result = await Effect.runPromise(
      computePreamble({
        preamble: preamble as unknown as () => Effect.Effect<string[], unknown>,
        latch,
        inMemory: { fired: false },
      }),
    );
    expect(result).toEqual([]);
    expect(store.fired).toBe(true);
  });
});
