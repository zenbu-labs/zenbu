---
title: Error Channel Operations
description: Explore operations on the error channel in Effect, including error mapping, filtering, inspecting, merging, and flipping channels.
sidebar:
  order: 9
---

import { Aside } from "@astrojs/starlight/components"

In Effect you can perform various operations on the error channel of effects. These operations allow you to transform, inspect, and handle errors in different ways. Let's explore some of these operations.

## Map Operations

### mapError

The `Effect.mapError` function is used when you need to transform or modify an error produced by an effect, without affecting the success value. This can be helpful when you want to add extra information to the error or change its type.

**Example** (Mapping an Error)

Here, the error type changes from `string` to `Error`.

```ts twoslash
import { Effect } from "effect"

//      ┌─── Effect<number, string, never>
//      ▼
const simulatedTask = Effect.fail("Oh no!").pipe(Effect.as(1))

//      ┌─── Effect<number, Error, never>
//      ▼
const mapped = Effect.mapError(
  simulatedTask,
  (message) => new Error(message)
)
```

<Aside type="note">
  It's important to note that using the `Effect.mapError` function does
  not change the overall success or failure of the effect. It only
  transforms the values in the error channel while preserving the effect's
  original success or failure status.
</Aside>

### mapBoth

The `Effect.mapBoth` function allows you to apply transformations to both channels: the error channel and the success channel of an effect. It takes two map functions as arguments: one for the error channel and the other for the success channel.

**Example** (Mapping Both Success and Error)

```ts twoslash
import { Effect } from "effect"

//      ┌─── Effect<number, string, never>
//      ▼
const simulatedTask = Effect.fail("Oh no!").pipe(Effect.as(1))

//      ┌─── Effect<boolean, Error, never>
//      ▼
const modified = Effect.mapBoth(simulatedTask, {
  onFailure: (message) => new Error(message),
  onSuccess: (n) => n > 0
})
```

<Aside type="note">
  It's important to note that using the `Effect.mapBoth` function does not
  change the overall success or failure of the effect. It only transforms
  the values in the error and success channels while preserving the
  effect's original success or failure status.
</Aside>

## Filtering the Success Channel

The Effect library provides several operators to filter values on the success channel based on a given predicate.

These operators offer different strategies for handling cases where the predicate fails:

| API                                  | Description                                                                                                                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filterOrFail`                       | This operator filters the values on the success channel based on a predicate. If the predicate fails for any value, the original effect fails with an error.                                                                                      |
| `filterOrDie` / `filterOrDieMessage` | These operators also filter the values on the success channel based on a predicate. If the predicate fails for any value, the original effect terminates abruptly. The `filterOrDieMessage` variant allows you to provide a custom error message. |
| `filterOrElse`                       | This operator filters the values on the success channel based on a predicate. If the predicate fails for any value, an alternative effect is executed instead.                                                                                    |

**Example** (Filtering Success Values)

```ts twoslash
import { Effect, Random, Cause } from "effect"

// Fail with a custom error if predicate is false
const task1 = Effect.filterOrFail(
  Random.nextRange(-1, 1),
  (n) => n >= 0,
  () => "random number is negative"
)

// Die with a custom exception if predicate is false
const task2 = Effect.filterOrDie(
  Random.nextRange(-1, 1),
  (n) => n >= 0,
  () => new Cause.IllegalArgumentException("random number is negative")
)

// Die with a custom error message if predicate is false
const task3 = Effect.filterOrDieMessage(
  Random.nextRange(-1, 1),
  (n) => n >= 0,
  "random number is negative"
)

// Run an alternative effect if predicate is false
const task4 = Effect.filterOrElse(
  Random.nextRange(-1, 1),
  (n) => n >= 0,
  () => task3
)
```

It's important to note that depending on the specific filtering operator used, the effect can either fail, terminate abruptly, or execute an alternative effect when the predicate fails. Choose the appropriate operator based on your desired error handling strategy and program logic.

The filtering APIs can also be combined with [user-defined type guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates) to improve type safety and code clarity. This ensures that only valid types pass through.

**Example** (Using a Type Guard)

```ts twoslash {15}
import { Effect, pipe } from "effect"

// Define a user interface
interface User {
  readonly name: string
}

// Simulate an asynchronous authentication function
declare const auth: () => Promise<User | null>

const program = pipe(
  Effect.promise(() => auth()),
  // Use filterOrFail with a custom type guard to ensure user is not null
  Effect.filterOrFail(
    (user): user is User => user !== null, // Type guard
    () => new Error("Unauthorized")
  ),
  // 'user' now has the type `User` (not `User | null`)
  Effect.andThen((user) => user.name)
)
```

In the example above, a guard is used within the `filterOrFail` API to ensure that the `user` is of type `User` rather than `User | null`.

If you prefer, you can utilize a pre-made guard like [Predicate.isNotNull](https://effect-ts.github.io/effect/effect/Predicate.ts.html#isnotnull) for simplicity and consistency.

## Inspecting Errors

Similar to [tapping](/docs/getting-started/building-pipelines/#tap) for success values, Effect provides several operators for inspecting error values.
These operators allow developers to observe failures or underlying issues without modifying the outcome.

### tapError

Executes an effectful operation to inspect the failure of an effect without altering it.

**Example** (Inspecting Errors)

```ts twoslash
import { Effect, Console } from "effect"

// Simulate a task that fails with an error
const task: Effect.Effect<number, string> = Effect.fail("NetworkError")

// Use tapError to log the error message when the task fails
const tapping = Effect.tapError(task, (error) =>
  Console.log(`expected error: ${error}`)
)

Effect.runFork(tapping)
/*
Output:
expected error: NetworkError
*/
```

### tapErrorTag

This function allows you to inspect errors that match a specific tag, helping you handle different error types more precisely.

**Example** (Inspecting Tagged Errors)

```ts twoslash
import { Effect, Console, Data } from "effect"

class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly statusCode: number
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
}> {}

// Create a task that fails with a NetworkError
const task: Effect.Effect<number, NetworkError | ValidationError> =
  Effect.fail(new NetworkError({ statusCode: 504 }))

// Use tapErrorTag to inspect only NetworkError types
// and log the status code
const tapping = Effect.tapErrorTag(task, "NetworkError", (error) =>
  Console.log(`expected error: ${error.statusCode}`)
)

Effect.runFork(tapping)
/*
Output:
expected error: 504
*/
```

### tapErrorCause

This function inspects the complete cause of an error, including failures and defects.

**Example** (Inspecting Error Causes)

```ts twoslash
import { Effect, Console } from "effect"

// Create a task that fails with a NetworkError
const task1: Effect.Effect<number, string> = Effect.fail("NetworkError")

const tapping1 = Effect.tapErrorCause(task1, (cause) =>
  Console.log(`error cause: ${cause}`)
)

Effect.runFork(tapping1)
/*
Output:
error cause: Error: NetworkError
*/

// Simulate a severe failure in the system
const task2: Effect.Effect<number, string> = Effect.dieMessage(
  "Something went wrong"
)

const tapping2 = Effect.tapErrorCause(task2, (cause) =>
  Console.log(`error cause: ${cause}`)
)

Effect.runFork(tapping2)
/*
Output:
error cause: RuntimeException: Something went wrong
  ... stack trace ...
*/
```

### tapDefect

Specifically inspects non-recoverable failures or defects in an effect (i.e., one or more [Die](/docs/data-types/cause/#die) causes).

**Example** (Inspecting Defects)

```ts twoslash
import { Effect, Console } from "effect"

// Simulate a task that fails with a recoverable error
const task1: Effect.Effect<number, string> = Effect.fail("NetworkError")

// tapDefect won't log anything because NetworkError is not a defect
const tapping1 = Effect.tapDefect(task1, (cause) =>
  Console.log(`defect: ${cause}`)
)

Effect.runFork(tapping1)
/*
No Output
*/

// Simulate a severe failure in the system
const task2: Effect.Effect<number, string> = Effect.dieMessage(
  "Something went wrong"
)

// Log the defect using tapDefect
const tapping2 = Effect.tapDefect(task2, (cause) =>
  Console.log(`defect: ${cause}`)
)

Effect.runFork(tapping2)
/*
Output:
defect: RuntimeException: Something went wrong
  ... stack trace ...
*/
```

### tapBoth

Inspects both success and failure outcomes of an effect, performing different actions based on the result.

**Example** (Inspecting Both Success and Failure)

```ts twoslash
import { Effect, Random, Console } from "effect"

// Simulate a task that might fail
const task = Effect.filterOrFail(
  Random.nextRange(-1, 1),
  (n) => n >= 0,
  () => "random number is negative"
)

// Use tapBoth to log both success and failure outcomes
const tapping = Effect.tapBoth(task, {
  onFailure: (error) => Console.log(`failure: ${error}`),
  onSuccess: (randomNumber) =>
    Console.log(`random number: ${randomNumber}`)
})

Effect.runFork(tapping)
/*
Example Output:
failure: random number is negative
*/
```

## Exposing Errors in The Success Channel

The `Effect.either` function transforms an `Effect<A, E, R>` into an effect that encapsulates both potential failure and success within an [Either](/docs/data-types/either/) data type:

```ts showLineNumbers=false
Effect<A, E, R> -> Effect<Either<A, E>, never, R>
```

This means if you have an effect with the following type:

```ts showLineNumbers=false
Effect<string, HttpError, never>
```

and you call `Effect.either` on it, the type becomes:

```ts showLineNumbers=false
Effect<Either<string, HttpError>, never, never>
```

The resulting effect cannot fail because the potential failure is now represented within the `Either`'s `Left` type.
The error type of the returned `Effect` is specified as `never`, confirming that the effect is structured to not fail.

This function becomes especially useful when recovering from effects that may fail when using [Effect.gen](/docs/getting-started/using-generators/#understanding-effectgen):

**Example** (Using `Effect.either` to Handle Errors)

```ts twoslash
import { Effect, Either, Console } from "effect"

// Simulate a task that fails
//
//      ┌─── Either<number, string, never>
//      ▼
const program = Effect.fail("Oh uh!").pipe(Effect.as(2))

//      ┌─── Either<number, never, never>
//      ▼
const recovered = Effect.gen(function* () {
  //      ┌─── Either<number, string>
  //      ▼
  const failureOrSuccess = yield* Effect.either(program)
  if (Either.isLeft(failureOrSuccess)) {
    const error = failureOrSuccess.left
    yield* Console.log(`failure: ${error}`)
    return 0
  } else {
    const value = failureOrSuccess.right
    yield* Console.log(`success: ${value}`)
    return value
  }
})

Effect.runPromise(recovered).then(console.log)
/*
Output:
failure: Oh uh!
0
*/
```

## Exposing the Cause in The Success Channel

You can use the `Effect.cause` function to expose the cause of an effect, which is a more detailed representation of failures, including error messages and defects.

**Example** (Logging the Cause of Failure)

```ts twoslash
import { Effect, Console } from "effect"

//      ┌─── Effect<number, string, never>
//      ▼
const program = Effect.fail("Oh uh!").pipe(Effect.as(2))

//      ┌─── Effect<void, never, never>
//      ▼
const recovered = Effect.gen(function* () {
  const cause = yield* Effect.cause(program)
  yield* Console.log(cause)
})
```

## Merging the Error Channel into the Success Channel

The `Effect.merge` function allows you to combine the error channel with the success channel. This results in an effect that never fails; instead, both successes and errors are handled as values in the success channel.

**Example** (Combining Error and Success Channels)

```ts twoslash
import { Effect } from "effect"

//      ┌─── Effect<number, string, never>
//      ▼
const program = Effect.fail("Oh uh!").pipe(Effect.as(2))

//      ┌─── Effect<number | string, never, never>
//      ▼
const recovered = Effect.merge(program)
```

## Flipping Error and Success Channels

The `Effect.flip` function allows you to switch the error and success channels of an effect. This means that what was previously a success becomes the error, and vice versa.

**Example** (Swapping Error and Success Channels)

```ts twoslash
import { Effect } from "effect"

//      ┌─── Effect<number, string, never>
//      ▼
const program = Effect.fail("Oh uh!").pipe(Effect.as(2))

//      ┌─── Effect<string, number, never>
//      ▼
const flipped = Effect.flip(program)
```
