---
title: Error Handling in Streams
description: Learn how to handle errors in streams, ensuring robust recovery, retries, and graceful error management for reliable stream processing.
sidebar:
  label: Error Handling
  order: 3
---

## Recovering from Failure

When working with streams that may encounter errors, it's crucial to know how to handle these errors gracefully. The `Stream.orElse` function is a powerful tool for recovering from failures and switching to an alternative stream in case of an error.

**Example**

```ts twoslash
import { Stream, Effect } from "effect"

const s1 = Stream.make(1, 2, 3).pipe(
  Stream.concat(Stream.fail("Oh! Error!")),
  Stream.concat(Stream.make(4, 5))
)

const s2 = Stream.make("a", "b", "c")

const stream = Stream.orElse(s1, () => s2)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
Output:
{
  _id: "Chunk",
  values: [ 1, 2, 3, "a", "b", "c" ]
}
*/
```

In this example, `s1` encounters an error, but instead of terminating the stream, we gracefully switch to `s2` using `Stream.orElse`. This ensures that we can continue processing data even if one stream fails.

There's also a variant called `Stream.orElseEither` that uses the [Either](/docs/data-types/either/) data type to distinguish elements from the two streams based on success or failure:

```ts twoslash
import { Stream, Effect } from "effect"

const s1 = Stream.make(1, 2, 3).pipe(
  Stream.concat(Stream.fail("Oh! Error!")),
  Stream.concat(Stream.make(4, 5))
)

const s2 = Stream.make("a", "b", "c")

const stream = Stream.orElseEither(s1, () => s2)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
Output:
{
  _id: "Chunk",
  values: [
    {
      _id: "Either",
      _tag: "Left",
      left: 1
    }, {
      _id: "Either",
      _tag: "Left",
      left: 2
    }, {
      _id: "Either",
      _tag: "Left",
      left: 3
    }, {
      _id: "Either",
      _tag: "Right",
      right: "a"
    }, {
      _id: "Either",
      _tag: "Right",
      right: "b"
    }, {
      _id: "Either",
      _tag: "Right",
      right: "c"
    }
  ]
}
*/
```

The `Stream.catchAll` function provides advanced error handling capabilities compared to `Stream.orElse`. With `Stream.catchAll`, you can make decisions based on both the type and value of the encountered failure.

```ts twoslash
import { Stream, Effect } from "effect"

const s1 = Stream.make(1, 2, 3).pipe(
  Stream.concat(Stream.fail("Uh Oh!" as const)),
  Stream.concat(Stream.make(4, 5)),
  Stream.concat(Stream.fail("Ouch" as const))
)

const s2 = Stream.make("a", "b", "c")

const s3 = Stream.make(true, false, false)

const stream = Stream.catchAll(
  s1,
  (error): Stream.Stream<string | boolean> => {
    switch (error) {
      case "Uh Oh!":
        return s2
      case "Ouch":
        return s3
    }
  }
)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
Output:
{
  _id: "Chunk",
  values: [ 1, 2, 3, "a", "b", "c" ]
}
*/
```

In this example, we have a stream, `s1`, which may encounter two different types of errors. Instead of a straightforward switch to an alternative stream, as done with `Stream.orElse`, we employ `Stream.catchAll` to precisely determine how to handle each type of error. This level of control over error recovery enables you to choose different streams or actions based on the specific error conditions.

## Recovering from Defects

When working with streams, it's essential to be prepared for various failure scenarios, including defects that might occur during stream processing. To address this, the `Stream.catchAllCause` function provides a robust solution. It enables you to gracefully handle and recover from any type of failure that may arise.

**Example**

```ts twoslash
import { Stream, Effect } from "effect"

const s1 = Stream.make(1, 2, 3).pipe(
  Stream.concat(Stream.dieMessage("Boom!")),
  Stream.concat(Stream.make(4, 5))
)

const s2 = Stream.make("a", "b", "c")

const stream = Stream.catchAllCause(s1, () => s2)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
Output:
{
  _id: "Chunk",
  values: [ 1, 2, 3, "a", "b", "c" ]
}
*/
```

In this example, `s1` may encounter a defect, but instead of crashing the application, we use `Stream.catchAllCause` to gracefully switch to an alternative stream, `s2`. This ensures that your application remains robust and continues processing data even in the face of unexpected issues.

## Recovery from Some Errors

In stream processing, there may be situations where you need to recover from specific types of failures. The `Stream.catchSome` and `Stream.catchSomeCause` functions come to the rescue, allowing you to handle and mitigate errors selectively.

If you want to recover from a particular error, you can use `Stream.catchSome`:

```ts twoslash
import { Stream, Effect, Option } from "effect"

const s1 = Stream.make(1, 2, 3).pipe(
  Stream.concat(Stream.fail("Oh! Error!")),
  Stream.concat(Stream.make(4, 5))
)

const s2 = Stream.make("a", "b", "c")

const stream = Stream.catchSome(s1, (error) => {
  if (error === "Oh! Error!") {
    return Option.some(s2)
  }
  return Option.none()
})

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
Output:
{
  _id: "Chunk",
  values: [ 1, 2, 3, "a", "b", "c" ]
}
*/
```

To recover from a specific cause, you can use the `Stream.catchSomeCause` function:

```ts twoslash
import { Stream, Effect, Option, Cause } from "effect"

const s1 = Stream.make(1, 2, 3).pipe(
  Stream.concat(Stream.dieMessage("Oh! Error!")),
  Stream.concat(Stream.make(4, 5))
)

const s2 = Stream.make("a", "b", "c")

const stream = Stream.catchSomeCause(s1, (cause) => {
  if (Cause.isDie(cause)) {
    return Option.some(s2)
  }
  return Option.none()
})

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
Output:
{
  _id: "Chunk",
  values: [ 1, 2, 3, "a", "b", "c" ]
}
*/
```

## Recovering to Effect

In stream processing, it's crucial to handle errors gracefully and perform cleanup tasks when needed. The `Stream.onError` function allows us to do just that. If our stream encounters an error, we can specify a cleanup task to be executed.

```ts twoslash
import { Stream, Console, Effect } from "effect"

const stream = Stream.make(1, 2, 3).pipe(
  Stream.concat(Stream.dieMessage("Oh! Boom!")),
  Stream.concat(Stream.make(4, 5)),
  Stream.onError(() =>
    Console.log(
      "Stream application closed! We are doing some cleanup jobs."
    ).pipe(Effect.orDie)
  )
)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
Output:
Stream application closed! We are doing some cleanup jobs.
error: RuntimeException: Oh! Boom!
*/
```

## Retry a Failing Stream

Sometimes, streams may encounter failures that are temporary or recoverable. In such cases, the `Stream.retry` operator comes in handy. It allows you to specify a retry schedule, and the stream will be retried according to that schedule.

**Example**

```ts twoslash
import { Stream, Effect, Schedule } from "effect"
import * as NodeReadLine from "node:readline"

const stream = Stream.make(1, 2, 3).pipe(
  Stream.concat(
    Stream.fromEffect(
      Effect.gen(function* () {
        const s = yield* readLine("Enter a number: ")
        const n = parseInt(s)
        if (Number.isNaN(n)) {
          return yield* Effect.fail("NaN")
        }
        return n
      })
    ).pipe(Stream.retry(Schedule.exponential("1 second")))
  )
)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
Output:
Enter a number: a
Enter a number: b
Enter a number: c
Enter a number: 4
{
  _id: "Chunk",
  values: [ 1, 2, 3, 4 ]
}
*/

const readLine = (message: string): Effect.Effect<string> =>
  Effect.promise(
    () =>
      new Promise((resolve) => {
        const rl = NodeReadLine.createInterface({
          input: process.stdin,
          output: process.stdout
        })
        rl.question(message, (answer) => {
          rl.close()
          resolve(answer)
        })
      })
  )
```

In this example, the stream asks the user to input a number, but if an invalid value is entered (e.g., "a," "b," "c"), it fails with "NaN." However, we use `Stream.retry` with an exponential backoff schedule, which means it will retry after a delay of increasing duration. This allows us to handle temporary errors and eventually collect valid input.

## Refining Errors

When working with streams, there might be situations where you want to selectively keep certain errors and terminate the stream with the remaining errors. You can achieve this using the `Stream.refineOrDie` function.

**Example**

```ts twoslash
import { Stream, Option } from "effect"

const stream = Stream.fail(new Error())

const res = Stream.refineOrDie(stream, (error) => {
  if (error instanceof SyntaxError) {
    return Option.some(error)
  }
  return Option.none()
})
```

In this example, `stream` initially fails with a generic `Error`. However, we use `Stream.refineOrDie` to filter and keep only errors of type `SyntaxError`. Any other errors will be terminated, while `SyntaxErrors` will be retained in `refinedStream`.

## Timing Out

When working with streams, there are scenarios where you may want to handle timeouts, such as terminating a stream if it doesn't produce a value within a certain duration. In this section, we'll explore how to manage timeouts using various operators.

### timeout

The `Stream.timeout` operator allows you to set a timeout on a stream. If the stream does not produce a value within the specified duration, it terminates.

```ts twoslash
import { Stream, Effect } from "effect"

const stream = Stream.fromEffect(Effect.never).pipe(
  Stream.timeout("2 seconds")
)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
{
  _id: "Chunk",
  values: []
}
*/
```

### timeoutFail

The `Stream.timeoutFail` operator combines a timeout with a custom failure message. If the stream times out, it fails with the specified error message.

```ts twoslash
import { Stream, Effect } from "effect"

const stream = Stream.fromEffect(Effect.never).pipe(
  Stream.timeoutFail(() => "timeout", "2 seconds")
)

Effect.runPromiseExit(Stream.runCollect(stream)).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'timeout' }
}
*/
```

### timeoutFailCause

Similar to `Stream.timeoutFail`, `Stream.timeoutFailCause` combines a timeout with a custom failure cause. If the stream times out, it fails with the specified cause.

```ts twoslash
import { Stream, Effect, Cause } from "effect"

const stream = Stream.fromEffect(Effect.never).pipe(
  Stream.timeoutFailCause(() => Cause.die("timeout"), "2 seconds")
)

Effect.runPromiseExit(Stream.runCollect(stream)).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Die', defect: 'timeout' }
}
*/
```

### timeoutTo

The `Stream.timeoutTo` operator allows you to switch to another stream if the first stream does not produce a value within the specified duration.

```ts twoslash
import { Stream, Effect } from "effect"

const stream = Stream.fromEffect(Effect.never).pipe(
  Stream.timeoutTo("2 seconds", Stream.make(1, 2, 3))
)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
{
  _id: "Chunk",
  values: [ 1, 2, 3 ]
}
*/
```
