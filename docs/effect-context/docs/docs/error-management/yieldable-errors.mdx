---
title: Yieldable Errors
description: Explore yieldable errors in Effect programming for seamless error handling in generator functions using custom and tagged error constructors.
sidebar:
  order: 11
---

Yieldable Errors are special types of errors that can be yielded directly within a generator function using [Effect.gen](/docs/getting-started/using-generators/).
These errors allow you to handle them intuitively, without needing to explicitly invoke [Effect.fail](/docs/getting-started/creating-effects/#fail). This simplifies how you manage custom errors in your code.

## Data.Error

The `Data.Error` constructor provides a way to define a base class for yieldable errors.

**Example** (Creating and Yielding a Custom Error)

```ts twoslash
import { Effect, Data } from "effect"

// Define a custom error class extending Data.Error
class MyError extends Data.Error<{ message: string }> {}

export const program = Effect.gen(function* () {
  // Yield a custom error (equivalent to failing with MyError)
  yield* new MyError({ message: "Oh no!" })
})

Effect.runPromiseExit(program).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: { message: 'Oh no!' } }
}
*/
```

## Data.TaggedError

The `Data.TaggedError` constructor lets you define custom yieldable errors with unique tags. Each error has a `_tag` property, allowing you to easily distinguish between different error types. This makes it convenient to handle specific tagged errors using functions like [Effect.catchTag](/docs/error-management/expected-errors/#catchtag) or [Effect.catchTags](/docs/error-management/expected-errors/#catchtags).

**Example** (Handling Multiple Tagged Errors)

```ts twoslash
import { Effect, Data, Random } from "effect"

// An error with _tag: "Foo"
class FooError extends Data.TaggedError("Foo")<{
  message: string
}> {}

// An error with _tag: "Bar"
class BarError extends Data.TaggedError("Bar")<{
  randomNumber: number
}> {}

const program = Effect.gen(function* () {
  const n = yield* Random.next
  return n > 0.5
    ? "yay!"
    : n < 0.2
    ? yield* new FooError({ message: "Oh no!" })
    : yield* new BarError({ randomNumber: n })
}).pipe(
  // Handle different tagged errors using catchTags
  Effect.catchTags({
    Foo: (error) => Effect.succeed(`Foo error: ${error.message}`),
    Bar: (error) => Effect.succeed(`Bar error: ${error.randomNumber}`)
  })
)

Effect.runPromise(program).then(console.log, console.error)
/*
Example Output (n < 0.2):
Foo error: Oh no!
*/
```
