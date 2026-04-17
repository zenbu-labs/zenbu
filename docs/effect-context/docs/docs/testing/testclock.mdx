---
title: TestClock
description: Control time during testing with Effect's TestClock, simulating time passage, delays, and recurring effects without waiting for real time.
sidebar:
  order: 0
---

import { Aside } from "@astrojs/starlight/components"

In most cases, we want our unit tests to run as quickly as possible. Waiting for real time to pass can slow down our tests significantly. Effect provides a handy tool called `TestClock` that allows us to **control time during testing**. This means we can efficiently and predictably test code that involves time without having to wait for the actual time to pass.

## How TestClock Works

Imagine `TestClock` as a wall clock that only moves forward when we adjust it manually using the `TestClock.adjust` and `TestClock.setTime` functions. The clock time does not progress on its own.

When we adjust the clock time, any effects scheduled to run at or before that time will execute. This allows us to simulate time passage in tests without waiting for real time.

**Example** (Simulating a Timeout with TestClock)

```ts twoslash
import { Effect, TestClock, Fiber, Option, TestContext } from "effect"
import * as assert from "node:assert"

const test = Effect.gen(function* () {
  // Create a fiber that sleeps for 5 minutes and then times out
  // after 1 minute
  const fiber = yield* Effect.sleep("5 minutes").pipe(
    Effect.timeoutTo({
      duration: "1 minute",
      onSuccess: Option.some,
      onTimeout: () => Option.none<void>()
    }),
    Effect.fork
  )

  // Adjust the TestClock by 1 minute to simulate the passage of time
  yield* TestClock.adjust("1 minute")

  // Get the result of the fiber
  const result = yield* Fiber.join(fiber)

  // Check if the result is None, indicating a timeout
  assert.ok(Option.isNone(result))
}).pipe(Effect.provide(TestContext.TestContext))

Effect.runPromise(test)
```

A key point is forking the fiber where `Effect.sleep` is invoked. Calls to `Effect.sleep` and related methods wait until the clock time matches or exceeds the scheduled time for their execution. By forking the fiber, we retain control over the clock time adjustments.

<Aside type="tip" title="Best Practices">
  A recommended pattern when using the `TestClock` is to fork the effect
  being tested, adjust the clock time as needed, and then verify that the
  expected outcomes have occurred.
</Aside>

## Testing Recurring Effects

Here's an example demonstrating how to test an effect that runs at fixed intervals using the `TestClock`:

**Example** (Testing an Effect with Fixed Intervals)

In this example, we test an effect that runs at regular intervals. An unbounded queue is used to manage the effects, and we verify the following:

1. No effect occurs before the specified recurrence period.
2. An effect occurs after the recurrence period.
3. The effect executes exactly once.

```ts twoslash
import { Effect, Queue, TestClock, Option, TestContext } from "effect"
import * as assert from "node:assert"

const test = Effect.gen(function* () {
  const q = yield* Queue.unbounded()

  yield* Queue.offer(q, undefined).pipe(
    // Delay the effect for 60 minutes and repeat it forever
    Effect.delay("60 minutes"),
    Effect.forever,
    Effect.fork
  )

  // Check if no effect is performed before the recurrence period
  const a = yield* Queue.poll(q).pipe(Effect.andThen(Option.isNone))

  // Adjust the TestClock by 60 minutes to simulate the passage of time
  yield* TestClock.adjust("60 minutes")

  // Check if an effect is performed after the recurrence period
  const b = yield* Queue.take(q).pipe(Effect.as(true))

  // Check if the effect is performed exactly once
  const c = yield* Queue.poll(q).pipe(Effect.andThen(Option.isNone))

  // Adjust the TestClock by another 60 minutes
  yield* TestClock.adjust("60 minutes")

  // Check if another effect is performed
  const d = yield* Queue.take(q).pipe(Effect.as(true))
  const e = yield* Queue.poll(q).pipe(Effect.andThen(Option.isNone))

  // Ensure that all conditions are met
  assert.ok(a && b && c && d && e)
}).pipe(Effect.provide(TestContext.TestContext))

Effect.runPromise(test)
```

It's important to note that after each recurrence, the next occurrence is scheduled to happen at the appropriate time. Adjusting the clock by 60 minutes places exactly one value in the queue; adjusting by another 60 minutes adds another value.

## Testing Clock

This example demonstrates how to test the behavior of the `Clock` using the `TestClock`:

**Example** (Simulating Time Passage with TestClock)

```ts twoslash
import { Effect, Clock, TestClock, TestContext } from "effect"
import * as assert from "node:assert"

const test = Effect.gen(function* () {
  // Get the current time using the Clock
  const startTime = yield* Clock.currentTimeMillis

  // Adjust the TestClock by 1 minute to simulate the passage of time
  yield* TestClock.adjust("1 minute")

  // Get the current time again
  const endTime = yield* Clock.currentTimeMillis

  // Check if the time difference is at least
  // 60,000 milliseconds (1 minute)
  assert.ok(endTime - startTime >= 60_000)
}).pipe(Effect.provide(TestContext.TestContext))

Effect.runPromise(test)
```

## Testing Deferred

The `TestClock` also impacts asynchronous code scheduled to run after a specific time.

**Example** (Simulating Delayed Execution with Deferred and TestClock)

```ts twoslash
import { Effect, Deferred, TestClock, TestContext } from "effect"
import * as assert from "node:assert"

const test = Effect.gen(function* () {
  // Create a deferred value
  const deferred = yield* Deferred.make<number, void>()

  // Run two effects concurrently: sleep for 10 seconds and succeed
  // the deferred with a value of 1
  yield* Effect.all(
    [Effect.sleep("10 seconds"), Deferred.succeed(deferred, 1)],
    { concurrency: "unbounded" }
  ).pipe(Effect.fork)

  // Adjust the TestClock by 10 seconds
  yield* TestClock.adjust("10 seconds")

  // Await the value from the deferred
  const readRef = yield* Deferred.await(deferred)

  // Verify the deferred value is correctly set
  assert.ok(readRef === 1)
}).pipe(Effect.provide(TestContext.TestContext))

Effect.runPromise(test)
```
