---
title: Cause
description: Comprehensive error analysis with Cause in Effect - track failures, defects, and interruptions with precise details.
sidebar:
  order: 2
---

The [`Effect<A, E, R>`](/docs/getting-started/the-effect-type/) type is polymorphic in error type `E`, allowing flexibility in handling any desired error type. However, there is often additional information about failures that the error type `E` alone does not capture.

To address this, Effect uses the `Cause<E>` data type to store various details such as:

- Unexpected errors or defects
- Stack and execution traces
- Reasons for fiber interruptions

Effect strictly preserves all failure-related information, storing a full picture of the error context in the `Cause` type. This comprehensive approach enables precise analysis and handling of failures, ensuring no data is lost.

Though `Cause` values aren't typically manipulated directly, they underlie errors within Effect workflows, providing access to both concurrent and sequential error details. This allows for thorough error analysis when needed.

## Creating Causes

You can intentionally create an effect with a specific cause using `Effect.failCause`.

**Example** (Defining Effects with Different Causes)

```ts twoslash
import { Effect, Cause } from "effect"

// Define an effect that dies with an unexpected error
//
//      ┌─── Effect<never, never, never>
//      ▼
const die = Effect.failCause(Cause.die("Boom!"))

// Define an effect that fails with an expected error
//
//      ┌─── Effect<never, string, never>
//      ▼
const fail = Effect.failCause(Cause.fail("Oh no!"))
```

Some causes do not influence the error type of the effect, leading to `never` in the error channel:

```text showLineNumbers=false
                ┌─── no error information
                ▼
Effect<never, never, never>
```

For instance, `Cause.die` does not specify an error type for the effect, while `Cause.fail` does, setting the error channel type accordingly.

## Cause Variations

There are several causes for various errors, in this section, we will describe each of these causes.

### Empty

The `Empty` cause signifies the absence of any errors.

### Fail

The `Fail<E>` cause represents a failure due to an expected error of type `E`.

### Die

The `Die` cause indicates a failure resulting from a defect, which is an unexpected or unintended error.

### Interrupt

The `Interrupt` cause represents a failure due to `Fiber` interruption and contains the `FiberId` of the interrupted `Fiber`.

### Sequential

The `Sequential` cause combines two causes that occurred one after the other.

For example, in an `Effect.ensuring` operation (analogous to `try-finally`), if both the `try` and `finally` sections fail, the two errors are represented in sequence by a `Sequential` cause.

**Example** (Capturing Sequential Failures with a `Sequential` Cause)

```ts twoslash
import { Effect, Cause } from "effect"

const program = Effect.failCause(Cause.fail("Oh no!")).pipe(
  Effect.ensuring(Effect.failCause(Cause.die("Boom!")))
)

Effect.runPromiseExit(program).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Sequential',
    left: { _id: 'Cause', _tag: 'Fail', failure: 'Oh no!' },
    right: { _id: 'Cause', _tag: 'Die', defect: 'Boom!' }
  }
}
*/
```

### Parallel

The `Parallel` cause combines two causes that occurred concurrently.

In Effect programs, two operations may run in parallel, potentially leading to multiple failures. When both computations fail simultaneously, a `Parallel` cause represents the concurrent errors within the effect workflow.

**Example** (Capturing Concurrent Failures with a `Parallel` Cause)

```ts twoslash
import { Effect, Cause } from "effect"

const program = Effect.all(
  [
    Effect.failCause(Cause.fail("Oh no!")),
    Effect.failCause(Cause.die("Boom!"))
  ],
  { concurrency: 2 }
)

Effect.runPromiseExit(program).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Parallel',
    left: { _id: 'Cause', _tag: 'Fail', failure: 'Oh no!' },
    right: { _id: 'Cause', _tag: 'Die', defect: 'Boom!' }
  }
}
*/
```

## Retrieving the Cause of an Effect

To retrieve the cause of a failed effect, use `Effect.cause`. This allows you to inspect or handle the exact reason behind the failure.

**Example** (Retrieving and Inspecting a Failure Cause)

```ts twoslash
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const cause = yield* Effect.cause(Effect.fail("Oh no!"))
  console.log(cause)
})

Effect.runPromise(program)
/*
Output:
{ _id: 'Cause', _tag: 'Fail', failure: 'Oh no!' }
*/
```

## Guards

To determine the specific type of a `Cause`, use the guards provided in the Cause module:

- `Cause.isEmpty`: Checks if the cause is empty, indicating no error.
- `Cause.isFailType`: Identifies causes that represent an expected failure.
- `Cause.isDie`: Identifies causes that represent an unexpected defect.
- `Cause.isInterruptType`: Identifies causes related to fiber interruptions.
- `Cause.isSequentialType`: Checks if the cause consists of sequential errors.
- `Cause.isParallelType`: Checks if the cause contains parallel errors.

**Example** (Using Guards to Identify Cause Types)

```ts twoslash
import { Cause } from "effect"

const cause = Cause.fail(new Error("my message"))

if (Cause.isFailType(cause)) {
  console.log(cause.error.message) // Output: my message
}
```

These guards allow you to accurately identify the type of a `Cause`, making it easier to handle various error cases in your code. Whether dealing with expected failures, unexpected defects, interruptions, or composite errors, these guards provide a clear method for assessing and managing error scenarios.

## Pattern Matching

The `Cause.match` function provides a straightforward way to handle each case of a `Cause`. By defining callbacks for each possible cause type, you can respond to specific error scenarios with custom behavior.

**Example** (Pattern Matching on Different Causes)

```ts twoslash
import { Cause } from "effect"

const cause = Cause.parallel(
  Cause.fail(new Error("my fail message")),
  Cause.die("my die message")
)

console.log(
  Cause.match(cause, {
    onEmpty: "(empty)",
    onFail: (error) => `(error: ${error.message})`,
    onDie: (defect) => `(defect: ${defect})`,
    onInterrupt: (fiberId) => `(fiberId: ${fiberId})`,
    onSequential: (left, right) =>
      `(onSequential (left: ${left}) (right: ${right}))`,
    onParallel: (left, right) =>
      `(onParallel (left: ${left}) (right: ${right})`
  })
)
/*
Output:
(onParallel (left: (error: my fail message)) (right: (defect: my die message))
*/
```

## Pretty Printing

Clear and readable error messages are key for effective debugging. The `Cause.pretty` function helps by formatting error messages in a structured way, making it easier to understand failure details.

**Example** (Using `Cause.pretty` for Readable Error Messages)

```ts twoslash
import { Cause, FiberId } from "effect"

console.log(Cause.pretty(Cause.empty))
/*
Output:
All fibers interrupted without errors.
*/

console.log(Cause.pretty(Cause.fail(new Error("my fail message"))))
/*
Output:
Error: my fail message
    ...stack trace...
*/

console.log(Cause.pretty(Cause.die("my die message")))
/*
Output:
Error: my die message
*/

console.log(Cause.pretty(Cause.interrupt(FiberId.make(1, 0))))
/*
Output:
All fibers interrupted without errors.
*/

console.log(
  Cause.pretty(Cause.sequential(Cause.fail("fail1"), Cause.fail("fail2")))
)
/*
Output:
Error: fail1
Error: fail2
*/
```

## Retrieval of Failures and Defects

To specifically collect failures or defects from a `Cause`, you can use `Cause.failures` and `Cause.defects`. These functions allow you to inspect only the errors or unexpected defects that occurred.

**Example** (Extracting Failures and Defects from a Cause)

```ts twoslash
import { Effect, Cause } from "effect"

const program = Effect.gen(function* () {
  const cause = yield* Effect.cause(
    Effect.all([
      Effect.fail("error 1"),
      Effect.die("defect"),
      Effect.fail("error 2")
    ])
  )
  console.log(Cause.failures(cause))
  console.log(Cause.defects(cause))
})

Effect.runPromise(program)
/*
Output:
{ _id: 'Chunk', values: [ 'error 1' ] }
{ _id: 'Chunk', values: [] }
*/
```
