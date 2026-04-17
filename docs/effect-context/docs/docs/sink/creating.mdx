---
title: Creating Sinks
description: Discover how to create and use various sinks for processing streams, including counting, summing, collecting, folding, and handling success or failure.
sidebar:
  order: 1
---

In stream processing, sinks are used to consume and handle elements from a stream. Here, we'll explore various sink constructors that allow you to create sinks for specific tasks.

## Common Constructors

### head

The `Sink.head` sink retrieves only the first element from a stream, wrapping it in `Some`. If the stream has no elements, it returns `None`.

**Example** (Retrieving the First Element)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const nonEmptyStream = Stream.make(1, 2, 3, 4)

Effect.runPromise(Stream.run(nonEmptyStream, Sink.head())).then(
  console.log
)
/*
Output:
{ _id: 'Option', _tag: 'Some', value: 1 }
*/

const emptyStream = Stream.empty

Effect.runPromise(Stream.run(emptyStream, Sink.head())).then(console.log)
/*
Output:
{ _id: 'Option', _tag: 'None' }
*/
```

### last

The `Sink.last` sink retrieves only the last element from a stream, wrapping it in `Some`. If the stream has no elements, it returns `None`.

**Example** (Retrieving the Last Element)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const nonEmptyStream = Stream.make(1, 2, 3, 4)

Effect.runPromise(Stream.run(nonEmptyStream, Sink.last())).then(
  console.log
)
/*
Output:
{ _id: 'Option', _tag: 'Some', value: 4 }
*/

const emptyStream = Stream.empty

Effect.runPromise(Stream.run(emptyStream, Sink.last())).then(console.log)
/*
Output:
{ _id: 'Option', _tag: 'None' }
*/
```

### count

The `Sink.count` sink consumes all elements of the stream and counts the number of elements fed to it.

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4)

Effect.runPromise(Stream.run(stream, Sink.count)).then(console.log)
// Output: 4
```

### sum

The `Sink.sum` sink consumes all elements of the stream and sums incoming numeric values.

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4)

Effect.runPromise(Stream.run(stream, Sink.sum)).then(console.log)
// Output: 10
```

### take

The `Sink.take` sink takes the specified number of values from the stream and results in a [Chunk](/docs/data-types/chunk/) data type.

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4)

Effect.runPromise(Stream.run(stream, Sink.take(3))).then(console.log)
/*
Output:
{ _id: 'Chunk', values: [ 1, 2, 3 ] }
*/
```

### drain

The `Sink.drain` sink ignores its inputs, effectively discarding them.

```ts twoslash
import { Stream, Console, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4).pipe(Stream.tap(Console.log))

Effect.runPromise(Stream.run(stream, Sink.drain)).then(console.log)
/*
Output:
1
2
3
4
undefined
*/
```

### timed

The `Sink.timed` sink executes the stream and measures its execution time, providing the [Duration](/docs/data-types/duration/).

```ts twoslash
import { Stream, Schedule, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4).pipe(
  Stream.schedule(Schedule.spaced("100 millis"))
)

Effect.runPromise(Stream.run(stream, Sink.timed)).then(console.log)
/*
Output:
{ _id: 'Duration', _tag: 'Millis', millis: 408 }
*/
```

### forEach

The `Sink.forEach` sink executes the provided effectful function for every element fed to it.

```ts twoslash
import { Stream, Console, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4)

Effect.runPromise(Stream.run(stream, Sink.forEach(Console.log))).then(
  console.log
)
/*
Output:
1
2
3
4
undefined
*/
```

## Creating Sinks from Success and Failure

Just as you can define streams to hold or manipulate data, you can also create sinks with specific success or failure outcomes using the `Sink.fail` and `Sink.succeed` functions.

### Succeeding Sink

This example creates a sink that doesn’t consume any elements from its upstream source but instead immediately succeeds with a specified numeric value:

**Example** (Sink that Always Succeeds with a Value)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4)

Effect.runPromise(Stream.run(stream, Sink.succeed(0))).then(console.log)
// Output: 0
```

### Failing Sink

In this example, the sink also doesn’t consume any elements from its upstream source. Instead, it fails with a specified error message of type `string`:

**Example** (Sink that Always Fails with an Error Message)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4)

Effect.runPromiseExit(Stream.run(stream, Sink.fail("fail!"))).then(
  console.log
)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'fail!' }
}
*/
```

## Collecting

### Collecting All Elements

To gather all elements from a data stream into a [Chunk](/docs/data-types/chunk/), use the `Sink.collectAll` sink.

The final output is a chunk containing all elements from the stream, in the order they were emitted.

**Example** (Collecting All Stream Elements)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4)

Effect.runPromise(Stream.run(stream, Sink.collectAll())).then(console.log)
/*
Output:
{ _id: 'Chunk', values: [ 1, 2, 3, 4 ] }
*/
```

### Collecting a Specified Number

To collect a fixed number of elements from a stream into a [Chunk](/docs/data-types/chunk/), use `Sink.collectAllN`. This sink stops collecting once it reaches the specified limit.

**Example** (Collecting a Limited Number of Elements)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4, 5)

Effect.runPromise(
  Stream.run(
    stream,
    // Collect the first 3 elements into a Chunk
    Sink.collectAllN(3)
  )
).then(console.log)
/*
Output:
{ _id: 'Chunk', values: [ 1, 2, 3 ] }
*/
```

### Collecting While Meeting a Condition

To gather elements from a stream while they satisfy a specific condition, use `Sink.collectAllWhile`. This sink collects elements until the provided predicate returns `false`.

**Example** (Collecting Elements Until a Condition Fails)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 0, 4, 0, 6, 7)

Effect.runPromise(
  Stream.run(
    stream,
    // Collect elements while they are not equal to 0
    Sink.collectAllWhile((n) => n !== 0)
  )
).then(console.log)
/*
Output:
{ _id: 'Chunk', values: [ 1, 2 ] }
*/
```

### Collecting into a HashSet

To accumulate stream elements into a `HashSet`, use `Sink.collectAllToSet()`. This ensures that each element appears only once in the final set.

**Example** (Collecting Unique Elements into a HashSet)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 2, 3, 4, 4)

Effect.runPromise(Stream.run(stream, Sink.collectAllToSet())).then(
  console.log
)
/*
Output:
{ _id: 'HashSet', values: [ 1, 2, 3, 4 ] }
*/
```

### Collecting into HashSets of a Specific Size

For controlled collection into a `HashSet` with a specified maximum size, use `Sink.collectAllToSetN`. This sink gathers unique elements up to the given limit.

**Example** (Collecting Unique Elements with a Set Size Limit)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 2, 3, 4, 4)

Effect.runPromise(
  Stream.run(
    stream,
    // Collect unique elements, limiting the set size to 3
    Sink.collectAllToSetN(3)
  )
).then(console.log)
/*
Output:
{ _id: 'HashSet', values: [ 1, 2, 3 ] }
*/
```

### Collecting into a HashMap

For more complex collection scenarios, `Sink.collectAllToMap` lets you gather elements into a `HashMap<K, A>` with a specified keying and merging strategy.
This sink requires both a key function to define each element's grouping and a merge function to combine values sharing the same key.

**Example** (Grouping and Merging Stream Elements in a HashMap)

In this example, we use `(n) => n % 3` to determine map keys and `(a, b) => a + b` to merge elements with the same key:

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 3, 2, 3, 1, 5, 1)

Effect.runPromise(
  Stream.run(
    stream,
    Sink.collectAllToMap(
      (n) => n % 3, // Key function to group by element value
      (a, b) => a + b // Merge function to sum values with the same key
    )
  )
).then(console.log)
/*
Output:
{ _id: 'HashMap', values: [ [ 0, 6 ], [ 1, 3 ], [ 2, 7 ] ] }
*/
```

### Collecting into a HashMap with Limited Keys

To accumulate elements into a `HashMap` with a maximum number of keys, use `Sink.collectAllToMapN`. This sink collects elements until it reaches the specified key limit, requiring a key function to define the grouping of each element and a merge function to combine values with the same key.

**Example** (Limiting Collected Keys in a HashMap)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 3, 2, 3, 1, 5, 1)

Effect.runPromise(
  Stream.run(
    stream,
    Sink.collectAllToMapN(
      3, // Maximum of 3 keys
      (n) => n, // Key function to group by element value
      (a, b) => a + b // Merge function to sum values with the same key
    )
  )
).then(console.log)
/*
Output:
{ _id: 'HashMap', values: [ [ 1, 2 ], [ 2, 2 ], [ 3, 6 ] ] }
*/
```

## Folding

### Folding Left

If you want to reduce a stream into a single cumulative value by applying an operation to each element in sequence, you can use the `Sink.foldLeft` function.

**Example** (Summing Elements in a Stream Using Fold Left)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4)

Effect.runPromise(
  Stream.run(
    stream,
    // Use foldLeft to sequentially add each element, starting with 0
    Sink.foldLeft(0, (a, b) => a + b)
  )
).then(console.log)
// Output: 10
```

### Folding with Termination

Sometimes, you may want to fold elements in a stream but stop the process once a specific condition is met. This is known as "short-circuiting." You can accomplish this with the `Sink.fold` function, which lets you define a termination condition.

**Example** (Folding with a Condition to Stop Early)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.iterate(0, (n) => n + 1)

Effect.runPromise(
  Stream.run(
    stream,
    Sink.fold(
      0, // Initial value
      (sum) => sum <= 10, // Termination condition
      (a, b) => a + b // Folding operation
    )
  )
).then(console.log)
// Output: 15
```

### Folding Until a Limit

To accumulate elements until a specific count is reached, use `Sink.foldUntil`. This sink folds elements up to the specified limit and then stops.

**Example** (Accumulating a Set Number of Elements)

```ts twoslash
import { Stream, Sink, Effect } from "effect"

const stream = Stream.make(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)

Effect.runPromise(
  Stream.run(
    stream,
    // Fold elements, stopping after accumulating 3 values
    Sink.foldUntil(0, 3, (a, b) => a + b)
  )
).then(console.log)
// Output: 6
```

### Folding with Weighted Elements

In some scenarios, you may want to fold elements based on a defined "weight" or "cost," accumulating elements until a specified maximum cost is reached. You can accomplish this with `Sink.foldWeighted`.

**Example** (Accumulating Elements Based on Weight)

In the example below, each element has a weight of `1`, and the folding resets when the accumulated weight hits `3`.

```ts twoslash
import { Stream, Sink, Chunk, Effect } from "effect"

const stream = Stream.make(3, 2, 4, 1, 5, 6, 2, 1, 3, 5, 6).pipe(
  Stream.transduce(
    Sink.foldWeighted({
      initial: Chunk.empty<number>(), // Initial empty Chunk
      maxCost: 3, // Maximum accumulated cost
      cost: () => 1, // Each element has a weight of 1
      body: (acc, el) => Chunk.append(acc, el) // Append element to the Chunk
    })
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
    { _id: 'Chunk', values: [ 3, 2, 4, [length]: 3 ] },
    { _id: 'Chunk', values: [ 1, 5, 6, [length]: 3 ] },
    { _id: 'Chunk', values: [ 2, 1, 3, [length]: 3 ] },
    { _id: 'Chunk', values: [ 5, 6, [length]: 2 ] },
    [length]: 4
  ]
}
*/
```
