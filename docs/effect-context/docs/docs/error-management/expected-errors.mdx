---
title: Expected Errors
description: Learn how Effect manages expected errors with precise error tracking, short-circuiting, and powerful recovery techniques.
sidebar:
  order: 1
---

import { Aside } from "@astrojs/starlight/components"

Expected errors are tracked at the type level by the [Effect data type](/docs/getting-started/the-effect-type/) in the "Error channel":

```text showLineNumbers=false "Error"
         ┌─── Represents the success type
         │        ┌─── Represents the error type
         │        │      ┌─── Represents required dependencies
         ▼        ▼      ▼
Effect<Success, Error, Requirements>
```

This means that the `Effect` type captures not only what the program returns on success but also what type of error it might produce.

**Example** (Creating an Effect That Can Fail)

In this example, we define a program that might randomly fail with an `HttpError`.

```ts twoslash
import { Effect, Random, Data } from "effect"

// Define a custom error type using Data.TaggedError
class HttpError extends Data.TaggedError("HttpError")<{}> {}

//      ┌─── Effect<string, HttpError, never>
//      ▼
const program = Effect.gen(function* () {
  // Generate a random number between 0 and 1
  const n = yield* Random.next

  // Simulate an HTTP error
  if (n < 0.5) {
    return yield* Effect.fail(new HttpError())
  }

  return "some result"
})
```

The type of `program` tells us that it can either return a `string` or fail with an `HttpError`:

```ts "string" "HttpError" showLineNumbers=false
const program: Effect<string, HttpError, never>
```

In this case, we use a class to represent the `HttpError` type, which allows us to define both the error type and a constructor.

When using `Data.TaggedError`, a `_tag` field is automatically added to the class

```ts showLineNumbers=false
// This field serves as a discriminant for the error
console.log(new HttpError()._tag)
// Output: "HttpError"
```

This discriminant field will be useful when we discuss APIs like [Effect.catchTag](#catchtag), which help in handling specific error types.

<Aside type="tip" title="Why Tagged Errors Are Useful">
  Adding a discriminant field, such as `_tag`, can be beneficial for
  distinguishing between different types of errors during error handling.
  It also prevents TypeScript from unifying types, ensuring that each
  error is treated uniquely based on its discriminant value.

For more information on constructing tagged errors, see [Data.TaggedError](/docs/error-management/yieldable-errors/#datataggederror).

</Aside>

## Error Tracking

In Effect, if a program can fail with multiple types of errors, they are automatically tracked as a union of those error types.
This allows you to know exactly what errors can occur during execution, making error handling more precise and predictable.

The example below illustrates how errors are automatically tracked for you.

**Example** (Automatically Tracking Errors)

```ts twoslash
import { Effect, Random, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const program = Effect.gen(function* () {
  // Generate two random numbers between 0 and 1
  const n1 = yield* Random.next
  const n2 = yield* Random.next

  // Simulate an HTTP error
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  // Simulate a validation error
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }

  return "some result"
})
```

Effect automatically keeps track of the possible errors that can occur during the execution of the program as a union:

```ts "HttpError | ValidationError" showLineNumbers=false
const program: Effect<string, HttpError | ValidationError, never>
```

indicating that it can potentially fail with either a `HttpError` or a `ValidationError`.

## Short-Circuiting

When working with APIs like [Effect.gen](/docs/getting-started/using-generators/#understanding-effectgen), [Effect.map](/docs/getting-started/building-pipelines/#map), [Effect.flatMap](/docs/getting-started/building-pipelines/#flatmap), and [Effect.andThen](/docs/getting-started/building-pipelines/#andthen), it's important to understand how they handle errors.
These APIs are designed to **short-circuit the execution** upon encountering the **first error**.

What does this mean for you as a developer? Well, let's say you have a chain of operations or a collection of effects to be executed in sequence. If any error occurs during the execution of one of these effects, the remaining computations will be skipped, and the error will be propagated to the final result.

In simpler terms, the short-circuiting behavior ensures that if something goes wrong at any step of your program, it won't waste time executing unnecessary computations. Instead, it will immediately stop and return the error to let you know that something went wrong.

**Example** (Short-Circuiting Behavior)

```ts twoslash {14-15}
import { Effect, Console } from "effect"

// Define three effects representing different tasks.
const task1 = Console.log("Executing task1...")
const task2 = Effect.fail("Something went wrong!")
const task3 = Console.log("Executing task3...")

// Compose the three tasks to run them in sequence.
// If one of the tasks fails, the subsequent tasks won't be executed.
const program = Effect.gen(function* () {
  yield* task1
  // After task1, task2 is executed, but it fails with an error
  yield* task2
  // This computation won't be executed because the previous one fails
  yield* task3
})

Effect.runPromiseExit(program).then(console.log)
/*
Output:
Executing task1...
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'Something went wrong!' }
}
*/
```

This code snippet demonstrates the short-circuiting behavior when an error occurs.
Each operation depends on the successful execution of the previous one.
If any error occurs, the execution is short-circuited, and the error is propagated.
In this specific example, `task3` is never executed because an error occurs in `task2`.

## Catching All Errors

### either

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

By yielding an `Either`, we gain the ability to "pattern match" on this type to handle both failure and success cases within the generator function.

**Example** (Using `Effect.either` to Handle Errors)

```ts twoslash
import { Effect, Either, Random, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const program = Effect.gen(function* () {
  const n1 = yield* Random.next
  const n2 = yield* Random.next
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }
  return "some result"
})

//      ┌─── Effect<string, never, never>
//      ▼
const recovered = Effect.gen(function* () {
  //      ┌─── Either<string, HttpError | ValidationError>
  //      ▼
  const failureOrSuccess = yield* Effect.either(program)
  if (Either.isLeft(failureOrSuccess)) {
    // Failure case: you can extract the error from the `left` property
    const error = failureOrSuccess.left
    return `Recovering from ${error._tag}`
  } else {
    // Success case: you can extract the value from the `right` property
    return failureOrSuccess.right
  }
})
```

As you can see since all errors are handled, the error type of the resulting effect `recovered` is `never`:

```ts showLineNumbers=false
const recovered: Effect<string, never, never>
```

We can make the code less verbose by using the `Either.match` function, which directly accepts the two callback functions for handling errors and successful values:

**Example** (Simplifying with `Either.match`)

```ts twoslash collapse={3-19}
import { Effect, Either, Random, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const program = Effect.gen(function* () {
  const n1 = yield* Random.next
  const n2 = yield* Random.next
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }
  return "some result"
})

//      ┌─── Effect<string, never, never>
//      ▼
const recovered = Effect.gen(function* () {
  //      ┌─── Either<string, HttpError | ValidationError>
  //      ▼
  const failureOrSuccess = yield* Effect.either(program)
  return Either.match(failureOrSuccess, {
    onLeft: (error) => `Recovering from ${error._tag}`,
    onRight: (value) => value // Do nothing in case of success
  })
})
```

### option

Transforms an effect to encapsulate both failure and success using the [Option](/docs/data-types/option/) data type.

The `Effect.option` function wraps the success or failure of an effect within the
`Option` type, making both cases explicit. If the original effect succeeds,
its value is wrapped in `Option.some`. If it fails, the failure is mapped to
`Option.none`.

The resulting effect cannot fail directly, as the error type is set to `never`. However, fatal errors like defects are not encapsulated.

**Example** (Using `Effect.option` to Handle Errors)

```ts twoslash
import { Effect } from "effect"

const maybe1 = Effect.option(Effect.succeed(1))

Effect.runPromiseExit(maybe1).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Success',
  value: { _id: 'Option', _tag: 'Some', value: 1 }
}
*/

const maybe2 = Effect.option(Effect.fail("Uh oh!"))

Effect.runPromiseExit(maybe2).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Success',
  value: { _id: 'Option', _tag: 'None' }
}
*/

const maybe3 = Effect.option(Effect.die("Boom!"))

Effect.runPromiseExit(maybe3).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Die', defect: 'Boom!' }
}
*/
```

### catchAll

Handles all errors in an effect by providing a fallback effect.

The `Effect.catchAll` function catches any errors that may occur during the
execution of an effect and allows you to handle them by specifying a fallback
effect. This ensures that the program continues without failing by recovering
from errors using the provided fallback logic.

<Aside type="note" title="Recoverable Errors Only">
  `Effect.catchAll` only handles recoverable errors. It will not recover
  from unrecoverable defects. See [Effect.catchAllCause](#catchallcause)
  for handling all types of failures.
</Aside>

**Example** (Providing Recovery Logic for Recoverable Errors)

```ts twoslash
import { Effect, Random, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const program = Effect.gen(function* () {
  const n1 = yield* Random.next
  const n2 = yield* Random.next
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }
  return "some result"
})

//      ┌─── Effect<string, never, never>
//      ▼
const recovered = program.pipe(
  Effect.catchAll((error) =>
    Effect.succeed(`Recovering from ${error._tag}`)
  )
)
```

We can observe that the type in the error channel of our program has changed to `never`:

```ts showLineNumbers=false
const recovered: Effect<string, never, never>
```

indicating that all errors have been handled.

### catchAllCause

Handles both recoverable and unrecoverable errors by providing a recovery effect.

The `Effect.catchAllCause` function allows you to handle all errors, including
unrecoverable defects, by providing a recovery effect. The recovery logic is
based on the `Cause` of the error, which provides detailed information about
the failure.

**Example** (Recovering from All Errors)

```ts twoslash
import { Cause, Effect } from "effect"

// Define an effect that may fail with a recoverable or unrecoverable error
const program = Effect.fail("Something went wrong!")

// Recover from all errors by examining the cause
const recovered = program.pipe(
  Effect.catchAllCause((cause) =>
    Cause.isFailType(cause)
      ? Effect.succeed("Recovered from a regular error")
      : Effect.succeed("Recovered from a defect")
  )
)

Effect.runPromise(recovered).then(console.log)
// Output: "Recovered from a regular error"
```

<Aside type="tip" title="When to Recover from Defects">
  Defects are unexpected errors that typically shouldn't be recovered
  from, as they often indicate serious issues. However, in some cases,
  such as dynamically loaded plugins, controlled recovery might be needed.
</Aside>

## Catching Some Errors

### either

The [`Effect.either`](#either) function, which was previously shown as a way to catch all errors, can also be used to catch specific errors.

By yielding an `Either`, we gain the ability to "pattern match" on this type to handle both failure and success cases within the generator function.

**Example** (Handling Specific Errors with `Effect.either`)

```ts twoslash
import { Effect, Random, Either, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const program = Effect.gen(function* () {
  const n1 = yield* Random.next
  const n2 = yield* Random.next
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }
  return "some result"
})

//      ┌─── Effect<string, ValidationError, never>
//      ▼
const recovered = Effect.gen(function* () {
  const failureOrSuccess = yield* Effect.either(program)
  if (Either.isLeft(failureOrSuccess)) {
    const error = failureOrSuccess.left
    // Only handle HttpError errors
    if (error._tag === "HttpError") {
      return "Recovering from HttpError"
    } else {
      // Rethrow ValidationError
      return yield* Effect.fail(error)
    }
  } else {
    return failureOrSuccess.right
  }
})
```

We can observe that the type in the error channel of our program has changed to only show `ValidationError`:

```ts "ValidationError" showLineNumbers=false
const recovered: Effect<string, ValidationError, never>
```

indicating that `HttpError` has been handled.

If we also want to handle `ValidationError`, we can easily add another case to our code:

```ts twoslash collapse={3-17} {28-30}
import { Effect, Random, Either, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

const program = Effect.gen(function* () {
  const n1 = yield* Random.next
  const n2 = yield* Random.next
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }
  return "some result"
})

//      ┌─── Effect<string, never, never>
//      ▼
const recovered = Effect.gen(function* () {
  const failureOrSuccess = yield* Effect.either(program)
  if (Either.isLeft(failureOrSuccess)) {
    const error = failureOrSuccess.left
    // Handle both HttpError and ValidationError
    if (error._tag === "HttpError") {
      return "Recovering from HttpError"
    } else {
      return "Recovering from ValidationError"
    }
  } else {
    return failureOrSuccess.right
  }
})
```

We can observe that the type in the error channel has changed to `never`:

```ts showLineNumbers=false
const recovered: Effect<string, never, never>
```

indicating that all errors have been handled.

### catchSome

Catches and recovers from specific types of errors, allowing you to attempt recovery only for certain errors.

`Effect.catchSome` lets you selectively catch and handle errors of certain
types by providing a recovery effect for specific errors. If the error
matches a condition, recovery is attempted; if not, it doesn't affect the
program. This function doesn't alter the error type, meaning the error type
remains the same as in the original effect.

**Example** (Handling Specific Errors with `Effect.catchSome`)

```ts twoslash
import { Effect, Random, Option, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const program = Effect.gen(function* () {
  const n1 = yield* Random.next
  const n2 = yield* Random.next
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }
  return "some result"
})

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const recovered = program.pipe(
  Effect.catchSome((error) => {
    // Only handle HttpError errors
    if (error._tag === "HttpError") {
      return Option.some(Effect.succeed("Recovering from HttpError"))
    } else {
      return Option.none()
    }
  })
)
```

In the code above, `Effect.catchSome` takes a function that examines the error and decides whether to attempt recovery or not. If the error matches a specific condition, recovery can be attempted by returning `Option.some(effect)`. If no recovery is possible, you can simply return `Option.none()`.

It's important to note that while `Effect.catchSome` lets you catch specific errors, it doesn't alter the error type itself.
Therefore, the resulting effect will still have the same error type as the original effect:

```ts "HttpError | ValidationError" showLineNumbers=false
const recovered: Effect<string, HttpError | ValidationError, never>
```

### catchIf

Recovers from specific errors based on a predicate.

`Effect.catchIf` works similarly to [`Effect.catchSome`](#catchsome), but it allows you to
recover from errors by providing a predicate function. If the predicate
matches the error, the recovery effect is applied. This function doesn't
alter the error type, so the resulting effect still carries the original
error type unless a user-defined type guard is used to narrow the type.

**Example** (Catching Specific Errors with a Predicate)

```ts twoslash
import { Data, Effect, Random } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const program = Effect.gen(function* () {
  const n1 = yield* Random.next
  const n2 = yield* Random.next
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }
  return "some result"
})

//      ┌─── Effect<string, ValidationError, never>
//      ▼
const recovered = program.pipe(
  Effect.catchIf(
    // Only handle HttpError errors
    (error) => error._tag === "HttpError",
    () => Effect.succeed("Recovering from HttpError")
  )
)
```

It's important to note that for TypeScript versions < 5.5, while `Effect.catchIf` lets you catch specific errors, it **doesn't alter the error type** itself.
Therefore, the resulting effect will still have the same error type as the original effect:

```ts "HttpError | ValidationError" showLineNumbers=false
const recovered: Effect<string, HttpError | ValidationError, never>
```

In TypeScript versions >= 5.5, improved type narrowing causes the resulting error type to be inferred as `ValidationError`.

#### Workaround For TypeScript versions < 5.5

If you provide a [user-defined type guard](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates) instead of a predicate, the resulting error type will be pruned, returning an `Effect<string, ValidationError, never>`:

```ts twoslash collapse={3-19} {25-26}
import { Data, Effect, Random } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const program = Effect.gen(function* () {
  const n1 = yield* Random.next
  const n2 = yield* Random.next
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }
  return "some result"
})

//      ┌─── Effect<string, ValidationError, never>
//      ▼
const recovered = program.pipe(
  Effect.catchIf(
    // User-defined type guard
    (error): error is HttpError => error._tag === "HttpError",
    () => Effect.succeed("Recovering from HttpError")
  )
)
```

### catchTag

Catches and handles specific errors by their `_tag` field, which is used as a discriminator.

`Effect.catchTag` is useful when your errors are tagged with a `_tag` field
that identifies the error type. You can use this function to handle specific
error types by matching the `_tag` value. This allows for precise error
handling, ensuring that only specific errors are caught and handled.

The error type must have a `_tag` field to use `Effect.catchTag`. This field
is used to identify and match errors.

**Example** (Handling Errors by Tag)

```ts twoslash
import { Effect, Random, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const program = Effect.gen(function* () {
  const n1 = yield* Random.next
  const n2 = yield* Random.next
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }
  return "some result"
})

//      ┌─── Effect<string, ValidationError, never>
//      ▼
const recovered = program.pipe(
  // Only handle HttpError errors
  Effect.catchTag("HttpError", (_HttpError) =>
    Effect.succeed("Recovering from HttpError")
  )
)
```

In the example above, the `Effect.catchTag` function allows us to handle `HttpError` specifically.
If a `HttpError` occurs during the execution of the program, the provided error handler function will be invoked,
and the program will proceed with the recovery logic specified within the handler.

We can observe that the type in the error channel of our program has changed to only show `ValidationError`:

```ts showLineNumbers=false
const recovered: Effect<string, ValidationError, never>
```

indicating that `HttpError` has been handled.

If we also wanted to handle `ValidationError`, we can simply add another `catchTag`:

**Example** (Handling Multiple Error Types with `catchTag`)

```ts twoslash collapse={3-19} {28-30}
import { Effect, Random, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const program = Effect.gen(function* () {
  const n1 = yield* Random.next
  const n2 = yield* Random.next
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }
  return "some result"
})

//      ┌─── Effect<string, never, never>
//      ▼
const recovered = program.pipe(
  // Handle both HttpError and ValidationError
  Effect.catchTag("HttpError", (_HttpError) =>
    Effect.succeed("Recovering from HttpError")
  ),
  Effect.catchTag("ValidationError", (_ValidationError) =>
    Effect.succeed("Recovering from ValidationError")
  )
)
```

We can observe that the type in the error channel of our program has changed to `never`:

```ts showLineNumbers=false
const recovered: Effect<string, never, never>
```

indicating that all errors have been handled.

<Aside type="caution" title="Error Type Requirement">
  The error type must have a readonly `_tag` field to use `catchTag`. This
  field is used to identify and match errors.
</Aside>

### catchTags

Handles multiple errors in a single block of code using their `_tag` field.

`Effect.catchTags` is a convenient way to handle multiple error types at
once. Instead of using [`Effect.catchTag`](#catchtag) multiple times, you can pass an
object where each key is an error type's `_tag`, and the value is the handler
for that specific error. This allows you to catch and recover from multiple
error types in a single call.

**Example** (Handling Multiple Tagged Error Types at Once)

```ts twoslash
import { Effect, Random, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

//      ┌─── Effect<string, HttpError | ValidationError, never>
//      ▼
const program = Effect.gen(function* () {
  const n1 = yield* Random.next
  const n2 = yield* Random.next
  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError())
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError())
  }
  return "some result"
})

//      ┌─── Effect<string, never, never>
//      ▼
const recovered = program.pipe(
  Effect.catchTags({
    HttpError: (_HttpError) =>
      Effect.succeed(`Recovering from HttpError`),
    ValidationError: (_ValidationError) =>
      Effect.succeed(`Recovering from ValidationError`)
  })
)
```

This function takes an object where each property represents a specific error `_tag` (`"HttpError"` and `"ValidationError"` in this case),
and the corresponding value is the error handler function to be executed when that particular error occurs.

<Aside type="caution" title="Error Type Requirement">
  The error type must have a readonly `_tag` field to use `catchTag`. This
  field is used to identify and match errors.
</Aside>

## Effect.fn

The `Effect.fn` function allows you to create traced functions that return an effect. It provides two key features:

- **Stack traces with location details** if an error occurs.
- **Automatic span creation** for [tracing](/docs/observability/tracing/) when a span name is provided.

If a span name is passed as the first argument, the function's execution is tracked using that name.
If no name is provided, stack tracing still works, but spans are not created.

A function can be defined using either:

- A generator function, allowing the use of `yield*` for effect composition.
- A regular function that returns an `Effect`.

**Example** (Creating a Traced Function with a Span Name)

```ts twoslash
import { Effect } from "effect"

const myfunc = Effect.fn("myspan")(function* <N extends number>(n: N) {
  yield* Effect.annotateCurrentSpan("n", n) // Attach metadata to the span
  console.log(`got: ${n}`)
  yield* Effect.fail(new Error("Boom!")) // Simulate failure
})

Effect.runFork(myfunc(100).pipe(Effect.catchAllCause(Effect.logError)))
/*
Output:
got: 100
timestamp=... level=ERROR fiber=#0 cause="Error: Boom!
    at <anonymous> (/.../index.ts:6:22) <= Raise location
    at myspan (/.../index.ts:3:23)  <= Definition location
    at myspan (/.../index.ts:9:16)" <= Call location
*/
```

### Exporting Spans for Tracing

`Effect.fn` automatically creates [spans](/docs/observability/tracing/). The spans capture information about the function execution, including metadata and error details.

**Example** (Exporting Spans to the Console)

```ts twoslash
import { Effect } from "effect"
import { NodeSdk } from "@effect/opentelemetry"
import {
  ConsoleSpanExporter,
  BatchSpanProcessor
} from "@opentelemetry/sdk-trace-base"

const myfunc = Effect.fn("myspan")(function* <N extends number>(n: N) {
  yield* Effect.annotateCurrentSpan("n", n)
  console.log(`got: ${n}`)
  yield* Effect.fail(new Error("Boom!"))
})

const program = myfunc(100)

const NodeSdkLive = NodeSdk.layer(() => ({
  resource: { serviceName: "example" },
  // Export span data to the console
  spanProcessor: new BatchSpanProcessor(new ConsoleSpanExporter())
}))

Effect.runFork(program.pipe(Effect.provide(NodeSdkLive)))
/*
Output:
got: 100
{
  resource: {
    attributes: {
      'service.name': 'example',
      'telemetry.sdk.language': 'nodejs',
      'telemetry.sdk.name': '@effect/opentelemetry',
      'telemetry.sdk.version': '1.30.1'
    }
  },
  instrumentationScope: { name: 'example', version: undefined, schemaUrl: undefined },
  traceId: '22801570119e57a6e2aacda3dec9665b',
  parentId: undefined,
  traceState: undefined,
  name: 'myspan',
  id: '7af530c1e01bc0cb',
  kind: 0,
  timestamp: 1741182277518402.2,
  duration: 4300.416,
  attributes: {
    n: 100,
    'code.stacktrace': 'at <anonymous> (/.../index.ts:8:23)\n' +
      'at <anonymous> (/.../index.ts:14:17)'
  },
  status: { code: 2, message: 'Boom!' },
  events: [
    {
      name: 'exception',
      attributes: {
        'exception.type': 'Error',
        'exception.message': 'Boom!',
        'exception.stacktrace': 'Error: Boom!\n' +
          '    at <anonymous> (/.../index.ts:11:22)\n' +
          '    at myspan (/.../index.ts:8:23)\n' +
          '    at myspan (/.../index.ts:14:17)'
      },
      time: [ 1741182277, 522702583 ],
      droppedAttributesCount: 0
    }
  ],
  links: []
}
*/
```

### Using Effect.fn as a pipe Function

`Effect.fn` also acts as a pipe function, allowing you to create a pipeline after
the function definition using the effect returned by the generator function as
the starting value of the pipeline.

**Example** (Creating a Traced Function with a Delay)

```ts twoslash
import { Effect } from "effect"

const myfunc = Effect.fn(
  function* (n: number) {
    console.log(`got: ${n}`)
    yield* Effect.fail(new Error("Boom!"))
  },
  // You can access both the created effect and the original arguments
  (effect, n) => Effect.delay(effect, `${n / 100} seconds`)
)

Effect.runFork(myfunc(100).pipe(Effect.catchAllCause(Effect.logError)))
/*
Output:
got: 100
timestamp=... level=ERROR fiber=#0 cause="Error: Boom! (<= after 1 second)
*/
```
