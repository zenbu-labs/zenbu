---
title: Deferred
description: Master asynchronous coordination with Deferred, a one-time variable for managing effect synchronization and communication.
sidebar:
  order: 4
---

A `Deferred<Success, Error>` is a specialized subtype of `Effect` that acts like a one-time variable with some unique characteristics. It can only be completed once, making it a useful tool for managing asynchronous operations and synchronization between different parts of your program.

A deferred is essentially a synchronization primitive that represents a value that may not be available right away. When you create a deferred, it starts out empty. Later, it can be completed with either a success value `Success` or an error value `Error`:

```text showLineNumbers=false
           ┌─── Represents the success type
           │        ┌─── Represents the error type
           │        │
           ▼        ▼
Deferred<Success, Error>
```

Once completed, it cannot be changed again.

When a fiber calls `Deferred.await`, it will pause until the deferred is completed. While the fiber is waiting, it doesn't block the thread, it only blocks semantically. This means other fibers can still run, ensuring efficient concurrency.

A deferred is conceptually similar to JavaScript's `Promise`.
The key difference is that it supports both success and error types, giving more type safety.

## Creating a Deferred

A deferred can be created using the `Deferred.make` constructor. This returns an effect that represents the creation of the deferred. Since the creation of a deferred involves memory allocation, it must be done within an effect to ensure safe management of resources.

**Example** (Creating a Deferred)

```ts twoslash
import { Deferred } from "effect"

//      ┌─── Effect<Deferred<string, Error>>
//      ▼
const deferred = Deferred.make<string, Error>()
```

## Awaiting

To retrieve a value from a deferred, you can use `Deferred.await`. This operation suspends the calling fiber until the deferred is completed with a value or an error.

```ts twoslash
import { Effect, Deferred } from "effect"

//      ┌─── Effect<Deferred<string, Error>, never, never>
//      ▼
const deferred = Deferred.make<string, Error>()

//      ┌─── Effect<string, Error, never>
//      ▼
const value = deferred.pipe(Effect.andThen(Deferred.await))
```

## Completing

You can complete a deferred in several ways, depending on whether you want to succeed, fail, or interrupt the waiting fibers:

| API                     | Description                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Deferred.succeed`      | Completes the deferred successfully with a value.                                                               |
| `Deferred.done`         | Completes the deferred with an [Exit](/docs/data-types/exit/) value.                                            |
| `Deferred.complete`     | Completes the deferred with the result of an effect.                                                            |
| `Deferred.completeWith` | Completes the deferred with an effect. This effect will be executed by each waiting fiber, so use it carefully. |
| `Deferred.fail`         | Fails the deferred with an error.                                                                               |
| `Deferred.die`          | Defects the deferred with a user-defined error.                                                                 |
| `Deferred.failCause`    | Fails or defects the deferred with a [Cause](/docs/data-types/cause/).                                          |
| `Deferred.interrupt`    | Interrupts the deferred, forcefully stopping or interrupting the waiting fibers.                                |

**Example** (Completing a Deferred with Success)

```ts twoslash
import { Effect, Deferred } from "effect"

const program = Effect.gen(function* () {
  const deferred = yield* Deferred.make<number, string>()

  // Complete the Deferred successfully
  yield* Deferred.succeed(deferred, 1)

  // Awaiting the Deferred to get its value
  const value = yield* Deferred.await(deferred)

  console.log(value)
})

Effect.runFork(program)
// Output: 1
```

Completing a deferred produces an `Effect<boolean>`. This effect returns `true` if the deferred was successfully completed, and `false` if it had already been completed previously. This can be useful for tracking the state of the deferred.

**Example** (Checking Completion Status)

```ts twoslash
import { Effect, Deferred } from "effect"

const program = Effect.gen(function* () {
  const deferred = yield* Deferred.make<number, string>()

  // Attempt to fail the Deferred
  const firstAttempt = yield* Deferred.fail(deferred, "oh no!")

  // Attempt to succeed after it has already been completed
  const secondAttempt = yield* Deferred.succeed(deferred, 1)

  console.log([firstAttempt, secondAttempt])
})

Effect.runFork(program)
// Output: [ true, false ]
```

## Checking Completion Status

Sometimes, you might need to check if a deferred has been completed without suspending the fiber. This can be done using the `Deferred.poll` method. Here's how it works:

- `Deferred.poll` returns an `Option<Effect<A, E>>`:
  - If the `Deferred` is incomplete, it returns `None`.
  - If the `Deferred` is complete, it returns `Some`, which contains the result or error.

Additionally, you can use the `Deferred.isDone` function to check if a deferred has been completed. This method returns an `Effect<boolean>`, which evaluates to `true` if the `Deferred` is completed, allowing you to quickly check its state.

**Example** (Polling and Checking Completion Status)

```ts twoslash
import { Effect, Deferred } from "effect"

const program = Effect.gen(function* () {
  const deferred = yield* Deferred.make<number, string>()

  // Polling the Deferred to check if it's completed
  const done1 = yield* Deferred.poll(deferred)

  // Checking if the Deferred has been completed
  const done2 = yield* Deferred.isDone(deferred)

  console.log([done1, done2])
})

Effect.runFork(program)
/*
Output:
[ { _id: 'Option', _tag: 'None' }, false ]
*/
```

## Common Use Cases

`Deferred` becomes useful when you need to wait for something specific to happen in your program.
It's ideal for scenarios where you want one part of your code to signal another part when it's ready.

Here are a few common use cases:

| **Use Case**             | **Description**                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Coordinating Fibers**  | When you have multiple concurrent tasks and need to coordinate their actions, `Deferred` can help one fiber signal to another when it has completed its task.             |
| **Synchronization**      | Anytime you want to ensure that one piece of code doesn't proceed until another piece of code has finished its work, `Deferred` can provide the synchronization you need. |
| **Handing Over Work**    | You can use `Deferred` to hand over work from one fiber to another. For example, one fiber can prepare some data, and then a second fiber can continue processing it.     |
| **Suspending Execution** | When you want a fiber to pause its execution until some condition is met, a `Deferred` can be used to block it until the condition is satisfied.                          |

**Example** (Using Deferred to Coordinate Two Fibers)

In this example, a deferred is used to pass a value between two fibers.

By running both fibers concurrently and using the deferred as a synchronization point, we can ensure that `fiberB` only proceeds after `fiberA` has completed its task.

```ts twoslash
import { Effect, Deferred, Fiber } from "effect"

const program = Effect.gen(function* () {
  const deferred = yield* Deferred.make<string, string>()

  // Completes the Deferred with a value after a delay
  const taskA = Effect.gen(function* () {
    console.log("Starting task to complete the Deferred")
    yield* Effect.sleep("1 second")
    console.log("Completing the Deferred")
    return yield* Deferred.succeed(deferred, "hello world")
  })

  // Waits for the Deferred and prints the value
  const taskB = Effect.gen(function* () {
    console.log("Starting task to get the value from the Deferred")
    const value = yield* Deferred.await(deferred)
    console.log("Got the value from the Deferred")
    return value
  })

  // Run both fibers concurrently
  const fiberA = yield* Effect.fork(taskA)
  const fiberB = yield* Effect.fork(taskB)

  // Wait for both fibers to complete
  const both = yield* Fiber.join(Fiber.zip(fiberA, fiberB))

  console.log(both)
})

Effect.runFork(program)
/*
Starting task to complete the Deferred
Starting task to get the value from the Deferred
Completing the Deferred
Got the value from the Deferred
[ true, 'hello world' ]
*/
```
