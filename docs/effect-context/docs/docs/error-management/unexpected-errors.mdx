---
title: Unexpected Errors
description: Understand how Effect handles unexpected errors with tools to manage defects, terminate execution, and selectively recover from critical failures.
sidebar:
  order: 2
---

import { Aside } from "@astrojs/starlight/components"

There are situations where you may encounter unexpected errors, and you need to decide how to handle them. Effect provides functions to help you deal with such scenarios, allowing you to take appropriate actions when errors occur during the execution of your effects.

## Creating Unrecoverable Errors

In the same way it is possible to leverage combinators such as [Effect.fail](/docs/getting-started/creating-effects/#fail) to create values of type `Effect<never, E, never>` the Effect library provides tools to create defects.

Creating defects is a common necessity when dealing with errors from which it is not possible to recover from a business logic perspective, such as attempting to establish a connection that is refused after multiple retries.

In those cases terminating the execution of the effect and moving into reporting, through an output such as stdout or some external monitoring service, might be the best solution.

The following functions and combinators allow for termination of the effect and are often used to convert values of type `Effect<A, E, R>` into values of type `Effect<A, never, R>` allowing the programmer an escape hatch from having to handle and recover from errors for which there is no sensible way to recover.

### die

Creates an effect that terminates a fiber with a specified error.

Use `Effect.die` when encountering unexpected conditions in your code that should
not be handled as regular errors but instead represent unrecoverable defects.

The `Effect.die` function is used to signal a defect, which represents a critical
and unexpected error in the code. When invoked, it produces an effect that
does not handle the error and instead terminates the fiber.

The error channel of the resulting effect is of type `never`, indicating that
it cannot recover from this failure.

**Example** (Terminating on Division by Zero with a Specified Error)

```ts twoslash
import { Effect } from "effect"

const divide = (a: number, b: number) =>
  b === 0
    ? Effect.die(new Error("Cannot divide by zero"))
    : Effect.succeed(a / b)

//      ┌─── Effect<number, never, never>
//      ▼
const program = divide(1, 0)

Effect.runPromise(program).catch(console.error)
/*
Output:
(FiberFailure) Error: Cannot divide by zero
  ...stack trace...
*/
```

### dieMessage

Creates an effect that terminates a fiber with a `RuntimeException` containing the specified message.

Use `Effect.dieMessage` when you want to terminate a fiber due to an unrecoverable
defect and include a clear explanation in the message.

The `Effect.dieMessage` function is used to signal a defect, representing a critical
and unexpected error in the code. When invoked, it produces an effect that
terminates the fiber with a `RuntimeException` carrying the given message.

The resulting effect has an error channel of type `never`, indicating it does
not handle or recover from the error.

**Example** (Terminating on Division by Zero with a Specified Message)

```ts twoslash
import { Effect } from "effect"

const divide = (a: number, b: number) =>
  b === 0
    ? Effect.dieMessage("Cannot divide by zero")
    : Effect.succeed(a / b)

//      ┌─── Effect<number, never, never>
//      ▼
const program = divide(1, 0)

Effect.runPromise(program).catch(console.error)
/*
Output:
(FiberFailure) RuntimeException: Cannot divide by zero
  ...stack trace...
*/
```

## Converting Failures to Defects

### orDie

Converts an effect's failure into a fiber termination, removing the error from the effect's type.

Use `Effect.orDie` when failures should be treated as unrecoverable defects and no error handling is required.

The `Effect.orDie` function is used when you encounter errors that you do not want to handle or recover from.
It removes the error type from the effect and ensures that any failure will terminate the fiber.
This is useful for propagating failures as defects, signaling that they should not be handled within the effect.

**Example** (Propagating an Error as a Defect)

```ts twoslash
import { Effect } from "effect"

const divide = (a: number, b: number) =>
  b === 0
    ? Effect.fail(new Error("Cannot divide by zero"))
    : Effect.succeed(a / b)

//      ┌─── Effect<number, never, never>
//      ▼
const program = Effect.orDie(divide(1, 0))

Effect.runPromise(program).catch(console.error)
/*
Output:
(FiberFailure) Error: Cannot divide by zero
  ...stack trace...
*/
```

### orDieWith

Converts an effect's failure into a fiber termination with a custom error.

Use `Effect.orDieWith` when failures should terminate the fiber as defects, and you want to customize
the error for clarity or debugging purposes.

The `Effect.orDieWith` function behaves like [Effect.orDie](#ordie), but it allows you to provide a mapping
function to transform the error before terminating the fiber. This is useful for cases where
you want to include a more detailed or user-friendly error when the failure is propagated
as a defect.

**Example** (Customizing Defect)

```ts twoslash
import { Effect } from "effect"

const divide = (a: number, b: number) =>
  b === 0
    ? Effect.fail(new Error("Cannot divide by zero"))
    : Effect.succeed(a / b)

//      ┌─── Effect<number, never, never>
//      ▼
const program = Effect.orDieWith(
  divide(1, 0),
  (error) => new Error(`defect: ${error.message}`)
)

Effect.runPromise(program).catch(console.error)
/*
Output:
(FiberFailure) Error: defect: Cannot divide by zero
  ...stack trace...
*/
```

## Catching All Defects

There is no sensible way to recover from defects. The functions we're
about to discuss should be used only at the boundary between Effect and
an external system, to transmit information on a defect for diagnostic
or explanatory purposes.

### exit

The `Effect.exit` function transforms an `Effect<A, E, R>` into an effect that encapsulates both potential failure and success within an [Exit](/docs/data-types/exit/) data type:

```ts showLineNumbers=false
Effect<A, E, R> -> Effect<Exit<A, E>, never, R>
```

This means if you have an effect with the following type:

```ts showLineNumbers=false
Effect<string, HttpError, never>
```

and you call `Effect.exit` on it, the type becomes:

```ts showLineNumbers=false
Effect<Exit<string, HttpError>, never, never>
```

The resulting effect cannot fail because the potential failure is now represented within the `Exit`'s `Failure` type.
The error type of the returned effect is specified as `never`, confirming that the effect is structured to not fail.

By yielding an `Exit`, we gain the ability to "pattern match" on this type to handle both failure and success cases within the generator function.

**Example** (Catching Defects with `Effect.exit`)

```ts twoslash
import { Effect, Cause, Console, Exit } from "effect"

// Simulating a runtime error
const task = Effect.dieMessage("Boom!")

const program = Effect.gen(function* () {
  const exit = yield* Effect.exit(task)
  if (Exit.isFailure(exit)) {
    const cause = exit.cause
    if (
      Cause.isDieType(cause) &&
      Cause.isRuntimeException(cause.defect)
    ) {
      yield* Console.log(
        `RuntimeException defect caught: ${cause.defect.message}`
      )
    } else {
      yield* Console.log("Unknown failure caught.")
    }
  }
})

// We get an Exit.Success because we caught all failures
Effect.runPromiseExit(program).then(console.log)
/*
Output:
RuntimeException defect caught: Boom!
{
  _id: "Exit",
  _tag: "Success",
  value: undefined
}
*/
```

### catchAllDefect

Recovers from all defects using a provided recovery function.

`Effect.catchAllDefect` allows you to handle defects, which are unexpected errors
that usually cause the program to terminate. This function lets you recover
from these defects by providing a function that handles the error.

However, it does not handle expected errors (like those from [Effect.fail](/docs/getting-started/creating-effects/#fail)) or
execution interruptions (like those from [Effect.interrupt](/docs/concurrency/basic-concurrency/#interrupt)).

**Example** (Handling All Defects)

```ts twoslash
import { Effect, Cause, Console } from "effect"

// Simulating a runtime error
const task = Effect.dieMessage("Boom!")

const program = Effect.catchAllDefect(task, (defect) => {
  if (Cause.isRuntimeException(defect)) {
    return Console.log(
      `RuntimeException defect caught: ${defect.message}`
    )
  }
  return Console.log("Unknown defect caught.")
})

// We get an Exit.Success because we caught all defects
Effect.runPromiseExit(program).then(console.log)
/*
Output:
RuntimeException defect caught: Boom!
{
  _id: "Exit",
  _tag: "Success",
  value: undefined
}
*/
```

<Aside type="tip" title="When to Recover from Defects">
  Defects are unexpected errors that typically shouldn't be recovered
  from, as they often indicate serious issues. However, in some cases,
  such as dynamically loaded plugins, controlled recovery might be needed.
</Aside>

## Catching Some Defects

### catchSomeDefect

Recovers from specific defects using a provided partial function.

`Effect.catchSomeDefect` allows you to handle specific defects, which are
unexpected errors that can cause the program to stop. It uses a partial
function to catch only certain defects and ignores others.

However, it does not handle expected errors (like those from [Effect.fail](/docs/getting-started/creating-effects/#fail)) or
execution interruptions (like those from [Effect.interrupt](/docs/concurrency/basic-concurrency/#interrupt)).

The function provided to `Effect.catchSomeDefect` acts as a filter and a handler for defects:

- It receives the defect as an input.
- If the defect matches a specific condition (e.g., a certain error type), the function returns
  an `Option.some` containing the recovery logic.
- If the defect does not match, the function returns `Option.none`, allowing the defect to propagate.

**Example** (Handling Specific Defects)

```ts twoslash
import { Effect, Cause, Option, Console } from "effect"

// Simulating a runtime error
const task = Effect.dieMessage("Boom!")

const program = Effect.catchSomeDefect(task, (defect) => {
  if (Cause.isIllegalArgumentException(defect)) {
    return Option.some(
      Console.log(
        `Caught an IllegalArgumentException defect: ${defect.message}`
      )
    )
  }
  return Option.none()
})

// Since we are only catching IllegalArgumentException
// we will get an Exit.Failure because we simulated a runtime error.
Effect.runPromiseExit(program).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Die',
    defect: { _tag: 'RuntimeException' }
  }
}
*/
```

<Aside type="tip" title="When to Recover from Defects">
  Defects are unexpected errors that typically shouldn't be recovered
  from, as they often indicate serious issues. However, in some cases,
  such as dynamically loaded plugins, controlled recovery might be needed.
</Aside>
