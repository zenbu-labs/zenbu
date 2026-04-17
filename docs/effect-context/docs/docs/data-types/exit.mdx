---
title: Exit
description: Represent the result of an Effect workflow with Exit, capturing success values or failure causes.
sidebar:
  order: 8
---

An `Exit<A, E>` describes the result of running an `Effect` workflow.

There are two possible states for an `Exit<A, E>`:

- `Exit.Success`: Contains a success value of type `A`.
- `Exit.Failure`: Contains a failure [Cause](/docs/data-types/cause/) of type `E`.

## Creating Exits

The Exit module provides two primary functions for constructing exit values: `Exit.succeed` and `Exit.failCause`.
These functions represent the outcomes of an effectful computation in terms of success or failure.

### succeed

`Exit.succeed` creates an `Exit` value that represents a successful outcome.
You use this function when you want to indicate that a computation completed successfully and to provide the resulting value.

**Example** (Creating a Successful Exit)

```ts twoslash
import { Exit } from "effect"

// Create an Exit representing a successful outcome with the value 42
//
//      ┌─── Exit<number, never>
//      ▼
const successExit = Exit.succeed(42)

console.log(successExit)
// Output: { _id: 'Exit', _tag: 'Success', value: 42 }
```

### failCause

`Exit.failCause` creates an `Exit` value that represents a failure.
The failure is described using a [Cause](/docs/data-types/cause/) object, which can encapsulate expected errors, defects, interruptions, or even composite errors.

**Example** (Creating a Failed Exit)

```ts twoslash
import { Exit, Cause } from "effect"

// Create an Exit representing a failure with an error message
//
//      ┌─── Exit<never, string>
//      ▼
const failureExit = Exit.failCause(Cause.fail("Something went wrong"))

console.log(failureExit)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'Something went wrong' }
}
*/
```

## Pattern Matching

You can handle different outcomes of an `Exit` using the `Exit.match` function.
This function lets you provide two separate callbacks to handle both success and failure cases of an `Effect` execution.

**Example** (Matching Success and Failure States)

```ts twoslash
import { Effect, Exit, Cause } from "effect"

//      ┌─── Exit<number, never>
//      ▼
const simulatedSuccess = Effect.runSyncExit(Effect.succeed(1))

console.log(
  Exit.match(simulatedSuccess, {
    onFailure: (cause) =>
      `Exited with failure state: ${Cause.pretty(cause)}`,
    onSuccess: (value) => `Exited with success value: ${value}`
  })
)
// Output: "Exited with success value: 1"

//      ┌─── Exit<never, string>
//      ▼
const simulatedFailure = Effect.runSyncExit(
  Effect.failCause(Cause.fail("error"))
)

console.log(
  Exit.match(simulatedFailure, {
    onFailure: (cause) =>
      `Exited with failure state: ${Cause.pretty(cause)}`,
    onSuccess: (value) => `Exited with success value: ${value}`
  })
)
// Output: "Exited with failure state: Error: error"
```

## Exit vs Either

Conceptually, `Exit<A, E>` can be thought of as `Either<A, Cause<E>>`. However, the [Cause](/docs/data-types/cause/) type represents more than just expected errors of type `E`. It includes:

- Interruption causes
- Defects (unexpected errors)
- The combination of multiple causes

This allows `Cause` to capture richer and more complex error states compared to a simple `Either`.

## Exit vs Effect

`Exit` is actually a subtype of `Effect`. This means that `Exit` values can also be considered as `Effect` values.

- An `Exit`, in essence, is a "constant computation".
- `Effect.succeed` is essentially the same as `Exit.succeed`.
- `Effect.failCause` is the same as `Exit.failCause`.
