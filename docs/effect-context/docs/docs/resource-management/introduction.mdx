---
title: Introduction
description: Common patterns for safe resource management
sidebar:
  order: 0
---

In long-running applications, managing resources efficiently is essential, particularly when building large-scale systems. If resources like socket connections, database connections, or file descriptors are not properly managed, it can lead to resource leaks, which degrade application performance and reliability. Effect provides constructs that help ensure resources are properly managed and released, even in cases where exceptions occur.

By ensuring that every time a resource is acquired, there is a corresponding mechanism to release it, Effect simplifies the process of resource management in your application.

## Finalization

In many programming languages, the `try` / `finally` construct ensures that cleanup code runs regardless of whether an operation succeeds or fails. Effect provides similar functionality through `Effect.ensuring`, `Effect.onExit`, and `Effect.onError`.

### ensuring

The `Effect.ensuring` function guarantees that a finalizer effect runs whether the main effect succeeds, fails, or is interrupted.

This is useful for performing cleanup actions such as closing file handles, logging messages, or releasing locks.

If you need access to the effect's result, consider using [onExit](#onexit).

**Example** (Running a Finalizer in All Outcomes)

```ts twoslash
import { Console, Effect } from "effect"

// Define a cleanup effect
const handler = Effect.ensuring(Console.log("Cleanup completed"))

// Define a successful effect
const success = Console.log("Task completed").pipe(
  Effect.as("some result"),
  handler
)

Effect.runFork(success)
/*
Output:
Task completed
Cleanup completed
*/

// Define a failing effect
const failure = Console.log("Task failed").pipe(
  Effect.andThen(Effect.fail("some error")),
  handler
)

Effect.runFork(failure)
/*
Output:
Task failed
Cleanup completed
*/

// Define an interrupted effect
const interruption = Console.log("Task interrupted").pipe(
  Effect.andThen(Effect.interrupt),
  handler
)

Effect.runFork(interruption)
/*
Output:
Task interrupted
Cleanup completed
*/
```

### onExit

`Effect.onExit` allows you to run a cleanup effect after the main effect completes, receiving an [Exit](/docs/data-types/exit/) value that describes the outcome.

- If the effect succeeds, the `Exit` holds the success value.
- If it fails, the `Exit` includes the error or failure cause.
- If it is interrupted, the `Exit` reflects that interruption.

The cleanup step itself is uninterruptible, which can help manage resources in complex or high-concurrency cases.

**Example** (Running a Cleanup Function with the Effect's Result)

```ts twoslash
import { Console, Effect, Exit } from "effect"

// Define a cleanup effect that logs the result
const handler = Effect.onExit((exit) =>
  Console.log(`Cleanup completed: ${Exit.getOrElse(exit, String)}`)
)

// Define a successful effect
const success = Console.log("Task completed").pipe(
  Effect.as("some result"),
  handler
)

Effect.runFork(success)
/*
Output:
Task completed
Cleanup completed: some result
*/

// Define a failing effect
const failure = Console.log("Task failed").pipe(
  Effect.andThen(Effect.fail("some error")),
  handler
)

Effect.runFork(failure)
/*
Output:
Task failed
Cleanup completed: Error: some error
*/

// Define an interrupted effect
const interruption = Console.log("Task interrupted").pipe(
  Effect.andThen(Effect.interrupt),
  handler
)

Effect.runFork(interruption)
/*
Output:
Task interrupted
Cleanup completed: All fibers interrupted without errors.
*/
```

### onError

This function lets you attach a cleanup effect that runs whenever the calling effect fails, passing the cause of the failure to the cleanup effect.

You can use it to perform actions such as logging, releasing resources, or applying additional recovery steps.

The cleanup effect will also run if the failure is caused by interruption, and it is uninterruptible, so it always finishes once it starts.

**Example** (Running Cleanup Only on Failure)

```ts twoslash
import { Console, Effect } from "effect"

// This handler logs the failure cause when the effect fails
const handler = Effect.onError((cause) =>
  Console.log(`Cleanup completed: ${cause}`)
)

// Define a successful effect
const success = Console.log("Task completed").pipe(
  Effect.as("some result"),
  handler
)

Effect.runFork(success)
/*
Output:
Task completed
*/

// Define a failing effect
const failure = Console.log("Task failed").pipe(
  Effect.andThen(Effect.fail("some error")),
  handler
)

Effect.runFork(failure)
/*
Output:
Task failed
Cleanup completed: Error: some error
*/

// Define a failing effect
const defect = Console.log("Task failed with defect").pipe(
  Effect.andThen(Effect.die("Boom!")),
  handler
)

Effect.runFork(defect)
/*
Output:
Task failed with defect
Cleanup completed: Error: Boom!
*/

// Define an interrupted effect
const interruption = Console.log("Task interrupted").pipe(
  Effect.andThen(Effect.interrupt),
  handler
)

Effect.runFork(interruption)
/*
Output:
Task interrupted
Cleanup completed: All fibers interrupted without errors.
*/
```

## acquireUseRelease

Many real-world operations involve working with resources that must be released when no longer needed, such as:

- Database connections
- File handles
- Network requests

Effect provides `Effect.acquireUseRelease`, which ensures that a resource is:

1. **Acquired** properly.
2. **Used** for its intended purpose.
3. **Released** even if an error occurs.

**Syntax**

```ts showLineNumbers=false
Effect.acquireUseRelease(acquire, use, release)
```

**Example** (Automatically Managing Resource Lifetime)

```ts twoslash
import { Effect, Console } from "effect"

// Define an interface for a resource
interface MyResource {
  readonly contents: string
  readonly close: () => Promise<void>
}

// Simulate resource acquisition
const getMyResource = (): Promise<MyResource> =>
  Promise.resolve({
    contents: "lorem ipsum",
    close: () =>
      new Promise((resolve) => {
        console.log("Resource released")
        resolve()
      })
  })

// Define how the resource is acquired
const acquire = Effect.tryPromise({
  try: () =>
    getMyResource().then((res) => {
      console.log("Resource acquired")
      return res
    }),
  catch: () => new Error("getMyResourceError")
})

// Define how the resource is released
const release = (res: MyResource) => Effect.promise(() => res.close())

const use = (res: MyResource) => Console.log(`content is ${res.contents}`)

//      ┌─── Effect<void, Error, never>
//      ▼
const program = Effect.acquireUseRelease(acquire, use, release)

Effect.runPromise(program)
/*
Output:
Resource acquired
content is lorem ipsum
Resource released
*/
```
