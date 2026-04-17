---
title: Timing Out
description: Set time limits on operations with Effect, ensuring tasks complete within specified durations and customizing behavior for timeouts.
sidebar:
  order: 6
---

import { Aside } from "@astrojs/starlight/components"

In programming, it's common to deal with tasks that may take some time to complete. Often, we want to enforce a limit on how long we're willing to wait for these tasks. The `Effect.timeout` function helps by placing a time constraint on an operation, ensuring it doesn't run indefinitely.

## Basic Usage

### timeout

The `Effect.timeout` function employs a [Duration](/docs/data-types/duration/) parameter to establish a time limit on an operation. If the operation exceeds this limit, a `TimeoutException` is triggered, indicating a timeout has occurred.

**Example** (Setting a Timeout)

Here, the task completes within the timeout duration, so the result is returned successfully.

```ts twoslash
import { Effect } from "effect"

const task = Effect.gen(function* () {
  console.log("Start processing...")
  yield* Effect.sleep("2 seconds") // Simulates a delay in processing
  console.log("Processing complete.")
  return "Result"
})

// Sets a 3-second timeout for the task
const timedEffect = task.pipe(Effect.timeout("3 seconds"))

// Output will show that the task completes successfully
// as it falls within the timeout duration
Effect.runPromiseExit(timedEffect).then(console.log)
/*
Output:
Start processing...
Processing complete.
{ _id: 'Exit', _tag: 'Success', value: 'Result' }
*/
```

If the operation exceeds the specified duration, a `TimeoutException` is raised:

```ts twoslash
import { Effect } from "effect"

const task = Effect.gen(function* () {
  console.log("Start processing...")
  yield* Effect.sleep("2 seconds") // Simulates a delay in processing
  console.log("Processing complete.")
  return "Result"
})

// Output will show a TimeoutException as the task takes longer
// than the specified timeout duration
const timedEffect = task.pipe(Effect.timeout("1 second"))

Effect.runPromiseExit(timedEffect).then(console.log)
/*
Output:
Start processing...
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Fail',
    failure: { _tag: 'TimeoutException' }
  }
}
*/
```

### timeoutOption

If you want to handle timeouts more gracefully, consider using `Effect.timeoutOption`. This function treats timeouts as regular results, wrapping the outcome in an [Option](/docs/data-types/option/).

**Example** (Handling Timeout as an Option)

In this example, the first task completes successfully, while the second times out. The result of the timed-out task is represented as `None` in the `Option` type.

```ts twoslash
import { Effect } from "effect"

const task = Effect.gen(function* () {
  console.log("Start processing...")
  yield* Effect.sleep("2 seconds") // Simulates a delay in processing
  console.log("Processing complete.")
  return "Result"
})

const timedOutEffect = Effect.all([
  task.pipe(Effect.timeoutOption("3 seconds")),
  task.pipe(Effect.timeoutOption("1 second"))
])

Effect.runPromise(timedOutEffect).then(console.log)
/*
Output:
Start processing...
Processing complete.
Start processing...
[
  { _id: 'Option', _tag: 'Some', value: 'Result' },
  { _id: 'Option', _tag: 'None' }
]
*/
```

## Handling Timeouts

When an operation does not finish within the specified duration, the behavior of the `Effect.timeout` depends on whether the operation is "uninterruptible".

<Aside type="note" title="Uninterruptible Effects">
  An uninterruptible effect is one that, once started, cannot be stopped
  mid-execution by the timeout mechanism directly. This could be because
  the operations within the effect need to run to completion to avoid
  leaving the system in an inconsistent state.
</Aside>

1. **Interruptible Operation**: If the operation can be interrupted, it is terminated immediately once the timeout threshold is reached, resulting in a `TimeoutException`.

   ```ts twoslash
   import { Effect } from "effect"

   const task = Effect.gen(function* () {
     console.log("Start processing...")
     yield* Effect.sleep("2 seconds") // Simulates a delay in processing
     console.log("Processing complete.")
     return "Result"
   })

   const timedEffect = task.pipe(Effect.timeout("1 second"))

   Effect.runPromiseExit(timedEffect).then(console.log)
   /*
    Output:
    Start processing...
    {
      _id: 'Exit',
      _tag: 'Failure',
      cause: {
        _id: 'Cause',
        _tag: 'Fail',
        failure: { _tag: 'TimeoutException' }
      }
    }
    */
   ```

2. **Uninterruptible Operation**: If the operation is uninterruptible, it continues until completion before the `TimeoutException` is assessed.

   ```ts twoslash
   import { Effect } from "effect"

   const task = Effect.gen(function* () {
     console.log("Start processing...")
     yield* Effect.sleep("2 seconds") // Simulates a delay in processing
     console.log("Processing complete.")
     return "Result"
   })

   const timedEffect = task.pipe(
     Effect.uninterruptible,
     Effect.timeout("1 second")
   )

   // Outputs a TimeoutException after the task completes,
   // because the task is uninterruptible
   Effect.runPromiseExit(timedEffect).then(console.log)
   /*
    Output:
    Start processing...
    Processing complete.
    {
      _id: 'Exit',
      _tag: 'Failure',
      cause: {
        _id: 'Cause',
        _tag: 'Fail',
        failure: { _tag: 'TimeoutException' }
      }
    }
    */
   ```

## Disconnection on Timeout

The `Effect.disconnect` function provides a way to handle timeouts in uninterruptible effects more flexibly. It allows an uninterruptible effect to complete in the background, while the main control flow proceeds as if a timeout had occurred.

Here's the distinction:

**Without** `Effect.disconnect`:

- An uninterruptible effect will ignore the timeout and continue executing until it completes, after which the timeout error is assessed.
- This can lead to delays in recognizing a timeout condition because the system must wait for the effect to complete.

**With** `Effect.disconnect`:

- The uninterruptible effect is allowed to continue in the background, independent of the main control flow.
- The main control flow recognizes the timeout immediately and proceeds with the timeout error or alternative logic, without having to wait for the effect to complete.
- This method is particularly useful when the operations of the effect do not need to block the continuation of the program, despite being marked as uninterruptible.

**Example** (Running Uninterruptible Tasks with Timeout and Background Completion)

Consider a scenario where a long-running data processing task is initiated, and you want to ensure the system remains responsive, even if the data processing takes too long:

```ts twoslash
import { Effect } from "effect"

const longRunningTask = Effect.gen(function* () {
  console.log("Start heavy processing...")
  yield* Effect.sleep("5 seconds") // Simulate a long process
  console.log("Heavy processing done.")
  return "Data processed"
})

const timedEffect = longRunningTask.pipe(
  Effect.uninterruptible,
  // Allows the task to finish in the background if it times out
  Effect.disconnect,
  Effect.timeout("1 second")
)

Effect.runPromiseExit(timedEffect).then(console.log)
/*
Output:
Start heavy processing...
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Fail',
    failure: { _tag: 'TimeoutException' }
  }
}
Heavy processing done.
*/
```

In this example, the system detects the timeout after one second, but the long-running task continues and completes in the background, without blocking the program's flow.

## Customizing Timeout Behavior

In addition to the basic `Effect.timeout` function, there are variations available that allow you to customize the behavior when a timeout occurs.

### timeoutFail

The `Effect.timeoutFail` function allows you to produce a specific error when a timeout happens.

**Example** (Custom Timeout Error)

```ts twoslash
import { Effect, Data } from "effect"

const task = Effect.gen(function* () {
  console.log("Start processing...")
  yield* Effect.sleep("2 seconds") // Simulates a delay in processing
  console.log("Processing complete.")
  return "Result"
})

class MyTimeoutError extends Data.TaggedError("MyTimeoutError")<{}> {}

const program = task.pipe(
  Effect.timeoutFail({
    duration: "1 second",
    onTimeout: () => new MyTimeoutError() // Custom timeout error
  })
)

Effect.runPromiseExit(program).then(console.log)
/*
Output:
Start processing...
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Fail',
    failure: MyTimeoutError { _tag: 'MyTimeoutError' }
  }
}
*/
```

### timeoutFailCause

`Effect.timeoutFailCause` lets you define a specific defect to throw when a timeout occurs. This is helpful for treating timeouts as exceptional cases in your code.

**Example** (Custom Defect on Timeout)

```ts twoslash
import { Effect, Cause } from "effect"

const task = Effect.gen(function* () {
  console.log("Start processing...")
  yield* Effect.sleep("2 seconds") // Simulates a delay in processing
  console.log("Processing complete.")
  return "Result"
})

const program = task.pipe(
  Effect.timeoutFailCause({
    duration: "1 second",
    onTimeout: () => Cause.die("Timed out!") // Custom defect for timeout
  })
)

Effect.runPromiseExit(program).then(console.log)
/*
Output:
Start processing...
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Die', defect: 'Timed out!' }
}
*/
```

### timeoutTo

`Effect.timeoutTo` provides more flexibility compared to `Effect.timeout`, allowing you to define different outcomes for both successful and timed-out operations. This can be useful when you want to customize the result based on whether the operation completes in time or not.

**Example** (Handling Success and Timeout with [Either](/docs/data-types/either/))

```ts twoslash
import { Effect, Either } from "effect"

const task = Effect.gen(function* () {
  console.log("Start processing...")
  yield* Effect.sleep("2 seconds") // Simulates a delay in processing
  console.log("Processing complete.")
  return "Result"
})

const program = task.pipe(
  Effect.timeoutTo({
    duration: "1 second",
    onSuccess: (result): Either.Either<string, string> =>
      Either.right(result),
    onTimeout: (): Either.Either<string, string> =>
      Either.left("Timed out!")
  })
)

Effect.runPromise(program).then(console.log)
/*
Output:
Start processing...
{
  _id: "Either",
  _tag: "Left",
  left: "Timed out!"
}
*/
```
