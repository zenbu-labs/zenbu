---
title: Caching Effects
description: Efficiently manage caching and memoization of effects with reusable tools.
sidebar:
  order: 0
---

This section covers several functions from the library that help manage caching and memoization in your application.

## cachedFunction

Memoizes a function with effects, caching results for the same inputs to avoid recomputation.

**Example** (Memoizing a Random Number Generator)

```ts twoslash
import { Effect, Random } from "effect"

const program = Effect.gen(function* () {
  const randomNumber = (n: number) => Random.nextIntBetween(1, n)
  console.log("non-memoized version:")
  console.log(yield* randomNumber(10)) // Generates a new random number
  console.log(yield* randomNumber(10)) // Generates a different number

  console.log("memoized version:")
  const memoized = yield* Effect.cachedFunction(randomNumber)
  console.log(yield* memoized(10)) // Generates and caches the result
  console.log(yield* memoized(10)) // Reuses the cached result
})

Effect.runFork(program)
/*
Example Output:
non-memoized version:
2
8
memoized version:
5
5
*/
```

## once

Ensures an effect is executed only once, even if invoked multiple times.

**Example** (Single Execution of an Effect)

```ts twoslash
import { Effect, Console } from "effect"

const program = Effect.gen(function* () {
  const task1 = Console.log("task1")

  // Repeats task1 three times
  yield* Effect.repeatN(task1, 2)

  // Ensures task2 is executed only once
  const task2 = yield* Effect.once(Console.log("task2"))

  // Attempts to repeat task2, but it will only execute once
  yield* Effect.repeatN(task2, 2)
})

Effect.runFork(program)
/*
Output:
task1
task1
task1
task2
*/
```

## cached

Returns an effect that computes a result lazily and caches it. Subsequent evaluations of this effect will return the cached result without re-executing the logic.

**Example** (Lazy Caching of an Expensive Task)

```ts twoslash
import { Effect, Console } from "effect"

let i = 1

// Simulating an expensive task with a delay
const expensiveTask = Effect.promise<string>(() => {
  console.log("expensive task...")
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`result ${i++}`)
    }, 100)
  })
})

const program = Effect.gen(function* () {
  // Without caching, the task is executed each time
  console.log("-- non-cached version:")
  yield* expensiveTask.pipe(Effect.andThen(Console.log))
  yield* expensiveTask.pipe(Effect.andThen(Console.log))

  // With caching, the result is reused after the first run
  console.log("-- cached version:")
  const cached = yield* Effect.cached(expensiveTask)
  yield* cached.pipe(Effect.andThen(Console.log))
  yield* cached.pipe(Effect.andThen(Console.log))
})

Effect.runFork(program)
/*
Output:
-- non-cached version:
expensive task...
result 1
expensive task...
result 2
-- cached version:
expensive task...
result 3
result 3
*/
```

## cachedWithTTL

Returns an effect that caches its result for a specified duration, known as the `timeToLive`. When the cache expires after the duration, the effect will be recomputed upon next evaluation.

**Example** (Caching with Time-to-Live)

```ts twoslash
import { Effect, Console } from "effect"

let i = 1

// Simulating an expensive task with a delay
const expensiveTask = Effect.promise<string>(() => {
  console.log("expensive task...")
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`result ${i++}`)
    }, 100)
  })
})

const program = Effect.gen(function* () {
  // Caches the result for 150 milliseconds
  const cached = yield* Effect.cachedWithTTL(expensiveTask, "150 millis")

  // First evaluation triggers the task
  yield* cached.pipe(Effect.andThen(Console.log))

  // Second evaluation returns the cached result
  yield* cached.pipe(Effect.andThen(Console.log))

  // Wait for 100 milliseconds, ensuring the cache expires
  yield* Effect.sleep("100 millis")

  // Recomputes the task after cache expiration
  yield* cached.pipe(Effect.andThen(Console.log))
})

Effect.runFork(program)
/*
Output:
expensive task...
result 1
result 1
expensive task...
result 2
*/
```

## cachedInvalidateWithTTL

Similar to `Effect.cachedWithTTL`, this function caches an effect's result for a specified duration. It also includes an additional effect for manually invalidating the cached value before it naturally expires.

**Example** (Invalidating Cache Manually)

```ts twoslash
import { Effect, Console } from "effect"

let i = 1

// Simulating an expensive task with a delay
const expensiveTask = Effect.promise<string>(() => {
  console.log("expensive task...")
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`result ${i++}`)
    }, 100)
  })
})

const program = Effect.gen(function* () {
  // Caches the result for 150 milliseconds
  const [cached, invalidate] = yield* Effect.cachedInvalidateWithTTL(
    expensiveTask,
    "150 millis"
  )

  // First evaluation triggers the task
  yield* cached.pipe(Effect.andThen(Console.log))

  // Second evaluation returns the cached result
  yield* cached.pipe(Effect.andThen(Console.log))

  // Invalidate the cache before it naturally expires
  yield* invalidate

  // Third evaluation triggers the task again
  // since the cache was invalidated
  yield* cached.pipe(Effect.andThen(Console.log))
})

Effect.runFork(program)
/*
Output:
expensive task...
result 1
result 1
expensive task...
result 2
*/
```
