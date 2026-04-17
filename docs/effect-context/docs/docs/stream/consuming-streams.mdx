---
title: Consuming Streams
description: Learn techniques for consuming streams, including collecting elements, processing with callbacks, and using folds and sinks.
sidebar:
  order: 2
---

When working with streams, it's essential to understand how to consume the data they produce.
In this guide, we'll walk through several common methods for consuming streams.

## Using runCollect

To gather all the elements from a stream into a single `Chunk`, you can use the `Stream.runCollect` function.

```ts twoslash
import { Stream, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4, 5)

const collectedData = Stream.runCollect(stream)

Effect.runPromise(collectedData).then(console.log)
/*
Output:
{
  _id: "Chunk",
  values: [ 1, 2, 3, 4, 5 ]
}
*/
```

## Using runForEach

Another way to consume elements of a stream is by using `Stream.runForEach`. It takes a callback function that receives each element of the stream. Here's an example:

```ts twoslash
import { Stream, Effect, Console } from "effect"

const effect = Stream.make(1, 2, 3).pipe(
  Stream.runForEach((n) => Console.log(n))
)

Effect.runPromise(effect).then(console.log)
/*
Output:
1
2
3
undefined
*/
```

In this example, we use `Stream.runForEach` to log each element to the console.

## Using a Fold Operation

The `Stream.fold` function is another way to consume a stream by performing a fold operation over the stream of values and returning an effect containing the result. Here are a couple of examples:

```ts twoslash
import { Stream, Effect } from "effect"

const foldedStream = Stream.make(1, 2, 3, 4, 5).pipe(
  Stream.runFold(0, (a, b) => a + b)
)

Effect.runPromise(foldedStream).then(console.log)
// Output: 15

const foldedWhileStream = Stream.make(1, 2, 3, 4, 5).pipe(
  Stream.runFoldWhile(
    0,
    (n) => n <= 3,
    (a, b) => a + b
  )
)

Effect.runPromise(foldedWhileStream).then(console.log)
// Output: 6
```

In the first example (`foldedStream`), we use `Stream.runFold` to calculate the sum of all elements. In the second example (`foldedWhileStream`), we use `Stream.runFoldWhile` to calculate the sum but only until a certain condition is met.

## Using a Sink

To consume a stream using a Sink, you can pass the `Sink` to the `Stream.run` function. Here's an example:

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const effect = Stream.make(1, 2, 3).pipe(Stream.run(Sink.sum))

Effect.runPromise(effect).then(console.log)
// Output: 6
```

In this example, we use a `Sink` to calculate the sum of the elements in the stream.
