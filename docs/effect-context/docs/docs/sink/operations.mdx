---
title: Sink Operations
description: Explore operations to transform, filter, and adapt sinks, enabling custom input-output handling and element filtering in stream processing.
sidebar:
  label: Operations
  order: 2
---

In previous sections, we learned how to create and use sinks. Now, let's explore some operations that let you transform or filter sink behavior.

## Adapting Sink Input

At times, you may have a sink that works with one type of input, but your current stream uses a different type. The `Sink.mapInput` function helps you adapt your sink to a new input type by transforming the input values. While `Sink.map` changes the sink's output, `Sink.mapInput` changes the input it accepts.

**Example** (Converting String Input to Numeric for Summing)

Suppose you have a `Sink.sum` that calculates the sum of numbers. If your stream contains strings rather than numbers, `Sink.mapInput` can convert those strings into numbers, allowing `Sink.sum` to work with your stream:

```ts twoslash
import { Stream, Sink, Effect } from "effect"

// A stream of numeric strings
const stream = Stream.make("1", "2", "3", "4", "5")

// Define a sink for summing numeric values
const numericSum = Sink.sum

// Use mapInput to adapt the sink, converting strings to numbers
const stringSum = numericSum.pipe(
  Sink.mapInput((s: string) => Number.parseFloat(s))
)

Effect.runPromise(Stream.run(stream, stringSum)).then(console.log)
// Output: 15
```

## Transforming Both Input and Output

When you need to transform both the input and output of a sink, `Sink.dimap` provides a flexible solution. It extends `mapInput` by allowing you to transform the input type, perform the operation, and then transform the output to a new type. This can be useful for complete conversions between input and output types.

**Example** (Converting Input to Integer, Summing, and Converting Output to String)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

// A stream of numeric strings
const stream = Stream.make("1", "2", "3", "4", "5")

// Convert string inputs to numbers, sum them,
// then convert the result to a string
const sumSink = Sink.dimap(Sink.sum, {
  // Transform input: string to number
  onInput: (s: string) => Number.parseFloat(s),
  // Transform output: number to string
  onDone: (n) => String(n)
})

Effect.runPromise(Stream.run(stream, sumSink)).then(console.log)
// Output: "15"
```

## Filtering Input

Sinks can also filter incoming elements based on specific conditions with `Sink.filterInput`. This operation allows the sink to process only elements that meet certain criteria.

**Example** (Filtering Negative Numbers in Chunks of Three)

In the example below, elements are collected in chunks of three, but only positive numbers are included:

```ts twoslash
import { Stream, Sink, Effect } from "effect"

// Define a stream with positive, negative, and zero values
const stream = Stream.fromIterable([
  1, -2, 0, 1, 3, -3, 4, 2, 0, 1, -3, 1, 1, 6
]).pipe(
  Stream.transduce(
    // Collect chunks of 3, filtering out non-positive numbers
    Sink.collectAllN<number>(3).pipe(Sink.filterInput((n) => n > 0))
  )
)

Effect.runPromise(Stream.runCollect(stream)).then((chunk) =>
  console.log("%o", chunk)
)
/*
Output:
{
  _id: 'Chunk',
  values: [
    { _id: 'Chunk', values: [ 1, 1, 3, [length]: 3 ] },
    { _id: 'Chunk', values: [ 4, 2, 1, [length]: 3 ] },
    { _id: 'Chunk', values: [ 1, 1, 6, [length]: 3 ] },
    { _id: 'Chunk', values: [ [length]: 0 ] },
    [length]: 4
  ]
}
*/
```
