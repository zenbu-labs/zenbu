---
title: Sandboxing
description: Master error handling in Effect with sandboxing, enabling detailed inspection and recovery from failures, defects, and interruptions.
sidebar:
  order: 7
---

Errors are an inevitable part of programming, and they can arise from various sources like failures, defects, fiber interruptions, or combinations of these. This guide explains how to use the `Effect.sandbox` function to isolate and understand the causes of errors in your Effect-based code.

## sandbox / unsandbox

The `Effect.sandbox` function allows you to encapsulate all the potential causes of an error in an effect. It exposes the full cause of an effect, whether it's due to a failure, defect, fiber interruption, or a combination of these factors.

In simple terms, it takes an effect `Effect<A, E, R>` and transforms it into an effect `Effect<A, Cause<E>, R>` where the error channel now contains a detailed cause of the error.

**Syntax**

```ts showLineNumbers=false
Effect<A, E, R> -> Effect<A, Cause<E>, R>
```

By using the `Effect.sandbox` function, you gain access to the underlying causes of exceptional effects. These causes are represented as a type of `Cause<E>` and are available in the error channel of the `Effect` data type.

Once you have exposed the causes, you can utilize standard error-handling operators like [Effect.catchAll](/docs/error-management/expected-errors/#catchall) and [Effect.catchTags](/docs/error-management/expected-errors/#catchtags) to handle errors more effectively. These operators allow you to respond to specific error conditions.

If needed, we can undo the sandboxing operation with `Effect.unsandbox`.

**Example** (Handling Different Error Causes)

```ts twoslash
import { Effect, Console } from "effect"

//      ┌─── Effect<string, Error, never>
//      ▼
const task = Effect.fail(new Error("Oh uh!")).pipe(
  Effect.as("primary result")
)

//      ┌─── Effect<string, Cause<Error>, never>
//      ▼
const sandboxed = Effect.sandbox(task)

const program = Effect.catchTags(sandboxed, {
  Die: (cause) =>
    Console.log(`Caught a defect: ${cause.defect}`).pipe(
      Effect.as("fallback result on defect")
    ),
  Interrupt: (cause) =>
    Console.log(`Caught a defect: ${cause.fiberId}`).pipe(
      Effect.as("fallback result on fiber interruption")
    ),
  Fail: (cause) =>
    Console.log(`Caught a defect: ${cause.error}`).pipe(
      Effect.as("fallback result on failure")
    )
})

// Restore the original error handling with unsandbox
const main = Effect.unsandbox(program)

Effect.runPromise(main).then(console.log)
/*
Output:
Caught a defect: Oh uh!
fallback result on failure
*/
```
