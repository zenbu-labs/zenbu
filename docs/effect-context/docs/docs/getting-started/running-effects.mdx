---
title: Running Effects
description: Learn how to execute effects in Effect with various functions for synchronous and asynchronous execution, including handling results and managing error outcomes.
sidebar:
  order: 8
---

import { Aside } from "@astrojs/starlight/components"

To execute an effect, you can use one of the many `run` functions provided by the `Effect` module.

<Aside type="tip" title="Running Effects at the Program's Edge">
  The recommended approach is to design your program with the majority of
  its logic as Effects. It's advisable to use the `run*` functions closer
  to the "edge" of your program. This approach allows for greater
  flexibility in executing your program and building sophisticated
  effects.
</Aside>

## runSync

Executes an effect synchronously, running it immediately and returning the result.

**Example** (Synchronous Logging)

```ts twoslash
import { Effect } from "effect"

const program = Effect.sync(() => {
  console.log("Hello, World!")
  return 1
})

const result = Effect.runSync(program)
// Output: Hello, World!

console.log(result)
// Output: 1
```

Use `Effect.runSync` to run an effect that does not fail and does not include any asynchronous operations. If the effect fails or involves asynchronous work, it will throw an error, and execution will stop where the failure or async operation occurs.

**Example** (Incorrect Usage with Failing or Async Effects)

```ts twoslash
import { Effect } from "effect"

try {
  // Attempt to run an effect that fails
  Effect.runSync(Effect.fail("my error"))
} catch (e) {
  console.error(e)
}
/*
Output:
(FiberFailure) Error: my error
*/

try {
  // Attempt to run an effect that involves async work
  Effect.runSync(Effect.promise(() => Promise.resolve(1)))
} catch (e) {
  console.error(e)
}
/*
Output:
(FiberFailure) AsyncFiberException: Fiber #0 cannot be resolved synchronously. This is caused by using runSync on an effect that performs async work
*/
```

## runSyncExit

Runs an effect synchronously and returns the result as an [Exit](/docs/data-types/exit/) type, which represents the outcome (success or failure) of the effect.

Use `Effect.runSyncExit` to find out whether an effect succeeded or failed,
including any defects, without dealing with asynchronous operations.

The `Exit` type represents the result of the effect:

- If the effect succeeds, the result is wrapped in a `Success`.
- If it fails, the failure information is provided as a `Failure` containing
  a [Cause](/docs/data-types/cause/) type.

**Example** (Handling Results as Exit)

```ts twoslash
import { Effect } from "effect"

console.log(Effect.runSyncExit(Effect.succeed(1)))
/*
Output:
{
  _id: "Exit",
  _tag: "Success",
  value: 1
}
*/

console.log(Effect.runSyncExit(Effect.fail("my error")))
/*
Output:
{
  _id: "Exit",
  _tag: "Failure",
  cause: {
    _id: "Cause",
    _tag: "Fail",
    failure: "my error"
  }
}
*/
```

If the effect contains asynchronous operations, `Effect.runSyncExit` will
return an `Failure` with a `Die` cause, indicating that the effect cannot be
resolved synchronously.

**Example** (Asynchronous Operation Resulting in Die)

```ts twoslash
import { Effect } from "effect"

console.log(Effect.runSyncExit(Effect.promise(() => Promise.resolve(1))))
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Die',
    defect: [Fiber #0 cannot be resolved synchronously. This is caused by using runSync on an effect that performs async work] {
      fiber: [FiberRuntime],
      _tag: 'AsyncFiberException',
      name: 'AsyncFiberException'
    }
  }
}
*/
```

## runPromise

Executes an effect and returns the result as a `Promise`.

Use `Effect.runPromise` when you need to execute an effect and work with the
result using `Promise` syntax, typically for compatibility with other
promise-based code.

**Example** (Running a Successful Effect as a Promise)

```ts twoslash
import { Effect } from "effect"

Effect.runPromise(Effect.succeed(1)).then(console.log)
// Output: 1
```

If the effect succeeds, the promise will resolve with the result. If the
effect fails, the promise will reject with an error.

**Example** (Handling a Failing Effect as a Rejected Promise)

```ts twoslash
import { Effect } from "effect"

Effect.runPromise(Effect.fail("my error")).catch(console.error)
/*
Output:
(FiberFailure) Error: my error
*/
```

## runPromiseExit

Runs an effect and returns a `Promise` that resolves to an [Exit](/docs/data-types/exit/), which
represents the outcome (success or failure) of the effect.

Use `Effect.runPromiseExit` when you need to determine if an effect succeeded
or failed, including any defects, and you want to work with a `Promise`.

The `Exit` type represents the result of the effect:

- If the effect succeeds, the result is wrapped in a `Success`.
- If it fails, the failure information is provided as a `Failure` containing
  a [Cause](/docs/data-types/cause/) type.

**Example** (Handling Results as Exit)

```ts twoslash
import { Effect } from "effect"

Effect.runPromiseExit(Effect.succeed(1)).then(console.log)
/*
Output:
{
  _id: "Exit",
  _tag: "Success",
  value: 1
}
*/

Effect.runPromiseExit(Effect.fail("my error")).then(console.log)
/*
Output:
{
  _id: "Exit",
  _tag: "Failure",
  cause: {
    _id: "Cause",
    _tag: "Fail",
    failure: "my error"
  }
}
*/
```

## runFork

The foundational function for running effects, returning a "fiber" that can be observed or interrupted.

`Effect.runFork` is used to run an effect in the background by creating a fiber. It is the base function
for all other run functions. It starts a fiber that can be observed or interrupted.

<Aside type="tip" title="The Default for Effect Execution">
  Unless you specifically need a `Promise` or synchronous operation,
  `Effect.runFork` is a good default choice.
</Aside>

**Example** (Running an Effect in the Background)

```ts twoslash
import { Effect, Console, Schedule, Fiber } from "effect"

//      ┌─── Effect<number, never, never>
//      ▼
const program = Effect.repeat(
  Console.log("running..."),
  Schedule.spaced("200 millis")
)

//      ┌─── RuntimeFiber<number, never>
//      ▼
const fiber = Effect.runFork(program)

setTimeout(() => {
  Effect.runFork(Fiber.interrupt(fiber))
}, 500)
```

In this example, the `program` continuously logs "running..." with each repetition spaced 200 milliseconds apart. You can learn more about repetitions and scheduling in our [Introduction to Scheduling](/docs/scheduling/introduction/) guide.

To stop the execution of the program, we use `Fiber.interrupt` on the fiber returned by `Effect.runFork`. This allows you to control the execution flow and terminate it when necessary.

For a deeper understanding of how fibers work and how to handle interruptions, check out our guides on [Fibers](/docs/concurrency/fibers/) and [Interruptions](/docs/concurrency/basic-concurrency/#interruptions).

## Synchronous vs. Asynchronous Effects

In the Effect library, there is no built-in way to determine in advance whether an effect will execute synchronously or asynchronously. While this idea was considered in earlier versions of Effect, it was ultimately not implemented for a few important reasons:

1. **Complexity:** Introducing this feature to track sync/async behavior in the type system would make Effect more complex to use and limit its composability.

2. **Safety Concerns:** We experimented with different approaches to track asynchronous Effects, but they all resulted in a worse developer experience without significantly improving safety. Even with fully synchronous types, we needed to support a `fromCallback` combinator to work with APIs using Continuation-Passing Style (CPS). However, at the type level, it's impossible to guarantee that such a function is always called immediately and not deferred.

### Best Practices for Running Effects

In most cases, effects are run at the outermost parts of your application. Typically, an application built around Effect will involve a single call to the main effect. Here’s how you should approach effect execution:

- Use `runPromise` or `runFork`: For most cases, asynchronous execution should be the default. These methods provide the best way to handle Effect-based workflows.

- Use `runSync` only when necessary: Synchronous execution should be considered an edge case, used only in scenarios where asynchronous execution is not feasible. For example, when you are sure the effect is purely synchronous and need immediate results.

## Cheatsheet

The table provides a summary of the available `run*` functions, along with their input and output types, allowing you to choose the appropriate function based on your needs.

| API              | Given          | Result                |
| ---------------- | -------------- | --------------------- |
| `runSync`        | `Effect<A, E>` | `A`                   |
| `runSyncExit`    | `Effect<A, E>` | `Exit<A, E>`          |
| `runPromise`     | `Effect<A, E>` | `Promise<A>`          |
| `runPromiseExit` | `Effect<A, E>` | `Promise<Exit<A, E>>` |
| `runFork`        | `Effect<A, E>` | `RuntimeFiber<A, E>`  |

You can find the complete list of `run*` functions [here](https://effect-ts.github.io/effect/effect/Effect.ts.html#running-effects).
