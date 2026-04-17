---
title: Leftovers
description: Learn how to handle unconsumed elements in streams, collecting or ignoring leftovers for efficient data processing.
sidebar:
  order: 4
---

In this section, we'll look at handling elements left unconsumed by sinks. Sinks may process only a portion of the elements from an upstream source, leaving some elements as "leftovers." Here's how to collect or ignore these remaining elements.

## Collecting Leftovers

If a sink doesn't consume all elements from the upstream source, the remaining elements are called leftovers. To capture these leftovers, use `Sink.collectLeftover`, which returns a tuple containing the result of the sink operation and any unconsumed elements.

**Example** (Collecting Leftover Elements)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4, 5)

// Take the first 3 elements and collect any leftovers
const sink1 = Sink.take<number>(3).pipe(Sink.collectLeftover)

Effect.runPromise(Stream.run(stream, sink1)).then(console.log)
/*
Output:
[
  { _id: 'Chunk', values: [ 1, 2, 3 ] },
  { _id: 'Chunk', values: [ 4, 5 ] }
]
*/

// Take only the first element and collect the rest as leftovers
const sink2 = Sink.head<number>().pipe(Sink.collectLeftover)

Effect.runPromise(Stream.run(stream, sink2)).then(console.log)
/*
Output:
[
  { _id: 'Option', _tag: 'Some', value: 1 },
  { _id: 'Chunk', values: [ 2, 3, 4, 5 ] }
]
*/
```

## Ignoring Leftovers

If leftover elements are not needed, you can ignore them using `Sink.ignoreLeftover`. This approach discards any unconsumed elements, so the sink operation focuses only on the elements it needs.

**Example** (Ignoring Leftover Elements)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4, 5)

// Take the first 3 elements and ignore any remaining elements
const sink = Sink.take<number>(3).pipe(
  Sink.ignoreLeftover,
  Sink.collectLeftover
)

Effect.runPromise(Stream.run(stream, sink)).then(console.log)
/*
Output:
[ { _id: 'Chunk', values: [ 1, 2, 3 ] }, { _id: 'Chunk', values: [] } ]
*/
```
