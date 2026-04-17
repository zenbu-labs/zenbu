---
title: Matching
description: Learn to handle success and failure cases in Effect programs with tools for pattern matching, value ignoring, side effects, and precise failure analysis.
sidebar:
  order: 4
---

import { Aside } from "@astrojs/starlight/components"

In the Effect module, similar to other modules like [Option](/docs/data-types/option/#pattern-matching) and [Exit](/docs/data-types/exit/#pattern-matching), we have a `Effect.match` function that allows us to handle different cases simultaneously.
Additionally, Effect provides various functions to manage both success and failure scenarios in effectful programs.

## match

`Effect.match` lets you define custom handlers for both success and failure
scenarios. You provide separate functions to handle each case, allowing you
to process the result if the effect succeeds, or handle the error if the
effect fails.

This is useful for structuring your code to respond differently to success or failure without triggering side effects.

**Example** (Handling Both Success and Failure Cases)

```ts twoslash
import { Effect } from "effect"

const success: Effect.Effect<number, Error> = Effect.succeed(42)

const program1 = Effect.match(success, {
  onFailure: (error) => `failure: ${error.message}`,
  onSuccess: (value) => `success: ${value}`
})

// Run and log the result of the successful effect
Effect.runPromise(program1).then(console.log)
// Output: "success: 42"

const failure: Effect.Effect<number, Error> = Effect.fail(
  new Error("Uh oh!")
)

const program2 = Effect.match(failure, {
  onFailure: (error) => `failure: ${error.message}`,
  onSuccess: (value) => `success: ${value}`
})

// Run and log the result of the failed effect
Effect.runPromise(program2).then(console.log)
// Output: "failure: Uh oh!"
```

## ignore

`Effect.ignore` allows you to run an effect without caring about its result,
whether it succeeds or fails.

This is useful when you only care about the side effects of the effect and do not need to handle or process its outcome.

**Example** (Using `Effect.ignore` to Discard Values)

```ts twoslash
import { Effect } from "effect"

//      ┌─── Effect<number, string, never>
//      ▼
const task = Effect.fail("Uh oh!").pipe(Effect.as(5))

//      ┌─── Effect<void, never, never>
//      ▼
const program = Effect.ignore(task)
```

## matchEffect

The `Effect.matchEffect` function is similar to [Effect.match](#match), but it
enables you to perform side effects in the handlers for both success and
failure outcomes.

This is useful when you need to execute additional actions,
like logging or notifying users, based on whether an effect succeeds or
fails.

**Example** (Handling Success and Failure with Side Effects)

```ts twoslash
import { Effect } from "effect"

const success: Effect.Effect<number, Error> = Effect.succeed(42)
const failure: Effect.Effect<number, Error> = Effect.fail(
  new Error("Uh oh!")
)

const program1 = Effect.matchEffect(success, {
  onFailure: (error) =>
    Effect.succeed(`failure: ${error.message}`).pipe(
      Effect.tap(Effect.log)
    ),
  onSuccess: (value) =>
    Effect.succeed(`success: ${value}`).pipe(Effect.tap(Effect.log))
})

console.log(Effect.runSync(program1))
/*
Output:
timestamp=... level=INFO fiber=#0 message="success: 42"
success: 42
*/

const program2 = Effect.matchEffect(failure, {
  onFailure: (error) =>
    Effect.succeed(`failure: ${error.message}`).pipe(
      Effect.tap(Effect.log)
    ),
  onSuccess: (value) =>
    Effect.succeed(`success: ${value}`).pipe(Effect.tap(Effect.log))
})

console.log(Effect.runSync(program2))
/*
Output:
timestamp=... level=INFO fiber=#1 message="failure: Uh oh!"
failure: Uh oh!
*/
```

## matchCause

The `Effect.matchCause` function allows you to handle failures with access to
the full [cause](/docs/data-types/cause/) of the failure within a fiber.

This is useful for differentiating between different types of errors, such as regular failures,
defects, or interruptions. You can provide specific handling logic for each
failure type based on the cause.

**Example** (Handling Different Failure Causes)

```ts twoslash
import { Effect } from "effect"

const task: Effect.Effect<number, Error> = Effect.die("Uh oh!")

const program = Effect.matchCause(task, {
  onFailure: (cause) => {
    switch (cause._tag) {
      case "Fail":
        // Handle standard failure
        return `Fail: ${cause.error.message}`
      case "Die":
        // Handle defects (unexpected errors)
        return `Die: ${cause.defect}`
      case "Interrupt":
        // Handle interruption
        return `${cause.fiberId} interrupted!`
    }
    // Fallback for other causes
    return "failed due to other causes"
  },
  onSuccess: (value) =>
    // task completes successfully
    `succeeded with ${value} value`
})

Effect.runPromise(program).then(console.log)
// Output: "Die: Uh oh!"
```

## matchCauseEffect

The `Effect.matchCauseEffect` function works similarly to [Effect.matchCause](#matchcause),
but it also allows you to perform additional side effects based on the
failure cause.

This function provides access to the complete [cause](/docs/data-types/cause/) of the
failure, making it possible to differentiate between various failure types,
and allows you to respond accordingly while performing side effects (like
logging or other operations).

**Example** (Handling Different Failure Causes with Side Effects)

```ts twoslash
import { Effect, Console } from "effect"

const task: Effect.Effect<number, Error> = Effect.die("Uh oh!")

const program = Effect.matchCauseEffect(task, {
  onFailure: (cause) => {
    switch (cause._tag) {
      case "Fail":
        // Handle standard failure with a logged message
        return Console.log(`Fail: ${cause.error.message}`)
      case "Die":
        // Handle defects (unexpected errors) by logging the defect
        return Console.log(`Die: ${cause.defect}`)
      case "Interrupt":
        // Handle interruption and log the fiberId that was interrupted
        return Console.log(`${cause.fiberId} interrupted!`)
    }
    // Fallback for other causes
    return Console.log("failed due to other causes")
  },
  onSuccess: (value) =>
    // Log success if the task completes successfully
    Console.log(`succeeded with ${value} value`)
})

Effect.runPromise(program)
// Output: "Die: Uh oh!"
```
