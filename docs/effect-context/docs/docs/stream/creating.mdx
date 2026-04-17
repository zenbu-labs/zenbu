---
title: Creating Streams
description: Learn various methods for creating Effect streams, from basic constructors to handling asynchronous data sources, pagination, and schedules.
sidebar:
  order: 1
---

In this section, we'll explore various methods for creating Effect `Stream`s. These methods will help you generate streams tailored to your needs.

## Common Constructors

### make

You can create a pure stream by using the `Stream.make` constructor. This constructor accepts a variable list of values as its arguments.

```ts twoslash
import { Stream, Effect } from "effect"

const stream = Stream.make(1, 2, 3)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
// { _id: 'Chunk', values: [ 1, 2, 3 ] }
```

### empty

Sometimes, you may require a stream that doesn't produce any values. In such cases, you can use `Stream.empty`. This constructor creates a stream that remains empty.

```ts twoslash
import { Stream, Effect } from "effect"

const stream = Stream.empty

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
// { _id: 'Chunk', values: [] }
```

### void

If you need a stream that contains a single `void` value, you can use `Stream.void`. This constructor is handy when you want to represent a stream with a single event or signal.

```ts twoslash
import { Stream, Effect } from "effect"

const stream = Stream.void

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
// { _id: 'Chunk', values: [ undefined ] }
```

### range

To create a stream of integers within a specified range `[min, max]` (including both endpoints, `min` and `max`), you can use `Stream.range`. This is particularly useful for generating a stream of sequential numbers.

```ts twoslash
import { Stream, Effect } from "effect"

// Creating a stream of numbers from 1 to 5
const stream = Stream.range(1, 5)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
// { _id: 'Chunk', values: [ 1, 2, 3, 4, 5 ] }
```

### iterate

With `Stream.iterate`, you can generate a stream by applying a function iteratively to an initial value. The initial value becomes the first element produced by the stream, followed by subsequent values produced by `f(init)`, `f(f(init))`, and so on.

```ts twoslash
import { Stream, Effect } from "effect"

// Creating a stream of incrementing numbers
const stream = Stream.iterate(1, (n) => n + 1) // Produces 1, 2, 3, ...

Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(5)))).then(
  console.log
)
// { _id: 'Chunk', values: [ 1, 2, 3, 4, 5 ] }
```

### scoped

`Stream.scoped` is used to create a single-valued stream from a scoped resource. It can be handy when dealing with resources that require explicit acquisition, usage, and release.

```ts twoslash
import { Stream, Effect, Console } from "effect"

// Creating a single-valued stream from a scoped resource
const stream = Stream.scoped(
  Effect.acquireUseRelease(
    Console.log("acquire"),
    () => Console.log("use"),
    () => Console.log("release")
  )
)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
Output:
acquire
use
release
{ _id: 'Chunk', values: [ undefined ] }
*/
```

## From Success and Failure

Much like the `Effect` data type, you can generate a `Stream` using the `fail` and `succeed` functions:

```ts twoslash
import { Stream, Effect } from "effect"

// Creating a stream that can emit errors
const streamWithError: Stream.Stream<never, string> =
  Stream.fail("Uh oh!")

Effect.runPromise(Stream.runCollect(streamWithError))
// throws Error: Uh oh!

// Creating a stream that emits a numeric value
const streamWithNumber: Stream.Stream<number> = Stream.succeed(5)

Effect.runPromise(Stream.runCollect(streamWithNumber)).then(console.log)
// { _id: 'Chunk', values: [ 5 ] }
```

## From Chunks

You can construct a stream from a `Chunk` like this:

```ts twoslash
import { Stream, Chunk, Effect } from "effect"

// Creating a stream with values from a single Chunk
const stream = Stream.fromChunk(Chunk.make(1, 2, 3))

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
// { _id: 'Chunk', values: [ 1, 2, 3 ] }
```

Moreover, you can create a stream from multiple `Chunk`s as well:

```ts twoslash
import { Stream, Chunk, Effect } from "effect"

// Creating a stream with values from multiple Chunks
const stream = Stream.fromChunks(Chunk.make(1, 2, 3), Chunk.make(4, 5, 6))

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
// { _id: 'Chunk', values: [ 1, 2, 3, 4, 5, 6 ] }
```

## From Effect

You can generate a stream from an Effect workflow by employing the `Stream.fromEffect` constructor. For instance, consider the following stream, which generates a single random number:

```ts twoslash
import { Stream, Random, Effect } from "effect"

const stream = Stream.fromEffect(Random.nextInt)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
// Example Output: { _id: 'Chunk', values: [ 1042302242 ] }
```

This method allows you to seamlessly transform the output of an Effect into a stream, providing a straightforward way to work with asynchronous operations within your streams.

## From Asynchronous Callback

Imagine you have an asynchronous function that relies on callbacks. If you want to capture the results emitted by those callbacks as a stream, you can use the `Stream.async` function. This function is designed to adapt functions that invoke their callbacks multiple times and emit the results as a stream.

Let's break down how to use it in the following example:

```ts twoslash
import { Stream, Effect, Chunk, Option, StreamEmit } from "effect"

const events = [1, 2, 3, 4]

const stream = Stream.async(
  (emit: StreamEmit.Emit<never, never, number, void>) => {
    events.forEach((n) => {
      setTimeout(() => {
        if (n === 3) {
          // Terminate the stream
          emit(Effect.fail(Option.none()))
        } else {
          // Add the current item to the stream
          emit(Effect.succeed(Chunk.of(n)))
        }
      }, 100 * n)
    })
  }
)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
// { _id: 'Chunk', values: [ 1, 2 ] }
```

The `StreamEmit.Emit<R, E, A, void>` type represents an asynchronous callback that can be called multiple times. This callback takes a value of type `Effect<Chunk<A>, Option<E>, R>`. Here's what each of the possible outcomes means:

- When the value provided to the callback results in a `Chunk<A>` upon success, it signifies that the specified elements should be emitted as part of the stream.

- If the value passed to the callback results in a failure with `Some<E>`, it indicates the termination of the stream with the specified error.

- When the value passed to the callback results in a failure with `None`, it serves as a signal for the end of the stream, essentially terminating it.

To put it simply, this type allows you to specify how your asynchronous callback interacts with the stream, determining when to emit elements, when to terminate with an error, or when to signal the end of the stream.

## From Iterables

### fromIterable

You can create a pure stream from an `Iterable` of values using the `Stream.fromIterable` constructor. It's a straightforward way to convert a collection of values into a stream.

```ts twoslash
import { Stream, Effect } from "effect"

const numbers = [1, 2, 3]

const stream = Stream.fromIterable(numbers)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
// { _id: 'Chunk', values: [ 1, 2, 3 ] }
```

### fromIterableEffect

When you have an effect that produces a value of type `Iterable`, you can employ the `Stream.fromIterableEffect` constructor to generate a stream from that effect.

For instance, let's say you have a database operation that retrieves a list of users. Since this operation involves effects, you can utilize `Stream.fromIterableEffect` to convert the result into a `Stream`:

```ts twoslash
import { Stream, Effect, Context } from "effect"

class Database extends Context.Tag("Database")<
  Database,
  { readonly getUsers: Effect.Effect<Array<string>> }
>() {}

const getUsers = Database.pipe(Effect.andThen((_) => _.getUsers))

const stream = Stream.fromIterableEffect(getUsers)

Effect.runPromise(
  Stream.runCollect(
    stream.pipe(
      Stream.provideService(Database, {
        getUsers: Effect.succeed(["user1", "user2"])
      })
    )
  )
).then(console.log)
// { _id: 'Chunk', values: [ 'user1', 'user2' ] }
```

This enables you to work seamlessly with effects and convert their results into streams for further processing.

### fromAsyncIterable

Async iterables are another type of data source that can be converted into a stream. With the `Stream.fromAsyncIterable` constructor, you can work with asynchronous data sources and handle potential errors gracefully.

```ts twoslash
import { Stream, Effect } from "effect"

const myAsyncIterable = async function* () {
  yield 1
  yield 2
}

const stream = Stream.fromAsyncIterable(
  myAsyncIterable(),
  (e) => new Error(String(e)) // Error Handling
)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
// { _id: 'Chunk', values: [ 1, 2 ] }
```

In this code, we define an async iterable and then create a stream named `stream` from it. Additionally, we provide an error handler function to manage any potential errors that may occur during the conversion.

## From Repetition

### Repeating a Single Value

You can create a stream that endlessly repeats a specific value using the `Stream.repeatValue` constructor:

```ts twoslash
import { Stream, Effect } from "effect"

const stream = Stream.repeatValue(0)

Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(5)))).then(
  console.log
)
// { _id: 'Chunk', values: [ 0, 0, 0, 0, 0 ] }
```

### Repeating a Stream's Content

`Stream.repeat` allows you to create a stream that repeats a specified stream's content according to a schedule. This can be useful for generating recurring events or values.

```ts twoslash
import { Stream, Effect, Schedule } from "effect"

// Creating a stream that repeats a value indefinitely
const stream = Stream.repeat(Stream.succeed(1), Schedule.forever)

Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(5)))).then(
  console.log
)
// { _id: 'Chunk', values: [ 1, 1, 1, 1, 1 ] }
```

### Repeating an Effect's Result

Imagine you have an effectful API call, and you want to use the result of that call to create a stream. You can achieve this by creating a stream from the effect and repeating it indefinitely.

Here's an example of generating a stream of random numbers:

```ts twoslash
import { Stream, Effect, Random } from "effect"

const stream = Stream.repeatEffect(Random.nextInt)

Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(5)))).then(
  console.log
)
/*
Example Output:
{
  _id: 'Chunk',
  values: [ 1666935266, 604851965, 2194299958, 3393707011, 4090317618 ]
}
*/
```

### Repeating an Effect with Termination

You can repeatedly evaluate a given effect and terminate the stream based on specific conditions.

In this example, we're draining an `Iterator` to create a stream from it:

```ts twoslash
import { Stream, Effect, Option } from "effect"

const drainIterator = <A>(it: Iterator<A>): Stream.Stream<A> =>
  Stream.repeatEffectOption(
    Effect.sync(() => it.next()).pipe(
      Effect.andThen((res) => {
        if (res.done) {
          return Effect.fail(Option.none())
        }
        return Effect.succeed(res.value)
      })
    )
  )
```

### Generating Ticks

You can create a stream that emits `void` values at specified intervals using the `Stream.tick` constructor. This is useful for creating periodic events.

```ts twoslash
import { Stream, Effect } from "effect"

const stream = Stream.tick("100 millis")

Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(5)))).then(
  console.log
)
/*
Output:
{
  _id: 'Chunk',
  values: [ undefined, undefined, undefined, undefined, undefined ]
}
*/
```

## From Unfolding/Pagination

In functional programming, the concept of `unfold` can be thought of as the counterpart to `fold`.

With `fold`, we process a data structure and produce a return value. For example, we can take an `Array<number>` and calculate the sum of its elements.

On the other hand, `unfold` represents an operation where we start with an initial value and generate a recursive data structure, adding one element at a time using a specified state function. For example, we can create a sequence of natural numbers starting from `1` and using the `increment` function as the state function.

### Unfold

#### unfold

The Stream module includes an `unfold` function defined as follows:

```ts showLineNumbers=false
declare const unfold: <S, A>(
  initialState: S,
  step: (s: S) => Option.Option<readonly [A, S]>
) => Stream<A>
```

Here's how it works:

- **initialState**. This is the initial state value.
- **step**. The state function `step` takes the current state `s` as input. If the result of this function is `None`, the stream ends. If it's `Some<[A, S]>`, the next element in the stream is `A`, and the state `S` is updated for the next step process.

For example, let's create a stream of natural numbers using `Stream.unfold`:

```ts twoslash
import { Stream, Effect, Option } from "effect"

const stream = Stream.unfold(1, (n) => Option.some([n, n + 1]))

Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(5)))).then(
  console.log
)
// { _id: 'Chunk', values: [ 1, 2, 3, 4, 5 ] }
```

#### unfoldEffect

Sometimes, we may need to perform effectful state transformations during the unfolding operation. This is where `Stream.unfoldEffect` comes in handy. It allows us to work with effects while generating streams.

Here's an example of creating an infinite stream of random `1` and `-1` values using `Stream.unfoldEffect`:

```ts twoslash
import { Stream, Effect, Option, Random } from "effect"

const stream = Stream.unfoldEffect(1, (n) =>
  Random.nextBoolean.pipe(
    Effect.map((b) => (b ? Option.some([n, -n]) : Option.some([n, n])))
  )
)

Effect.runPromise(Stream.runCollect(stream.pipe(Stream.take(5)))).then(
  console.log
)
// Example Output: { _id: 'Chunk', values: [ 1, 1, 1, 1, -1 ] }
```

#### Additional Variants

There are also similar operations like `Stream.unfoldChunk` and `Stream.unfoldChunkEffect` tailored for working with `Chunk` data types.

### Pagination

#### paginate

`Stream.paginate` is similar to `Stream.unfold` but allows emitting values one step further.

For example, the following stream emits `0, 1, 2, 3` elements:

```ts twoslash
import { Stream, Effect, Option } from "effect"

const stream = Stream.paginate(0, (n) => [
  n,
  n < 3 ? Option.some(n + 1) : Option.none()
])

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
// { _id: 'Chunk', values: [ 0, 1, 2, 3 ] }
```

Here's how it works:

- We start with an initial value of `0`.
- The provided function takes the current value `n` and returns a tuple. The first element of the tuple is the value to emit (`n`), and the second element determines whether to continue (`Option.some(n + 1)`) or stop (`Option.none()`).

#### Additional Variants

There are also similar operations like `Stream.paginateChunk` and `Stream.paginateChunkEffect` tailored for working with `Chunk` data types.

### Unfolding vs. Pagination

You might wonder about the difference between the `unfold` and `paginate` combinators and when to use one over the other. Let's explore this by diving into an example.

Imagine we have a paginated API that provides a substantial amount of data in a paginated manner. When we make a request to this API, it returns a `ResultPage` object containing the results for the current page and a flag indicating whether it's the last page or if there's more data to retrieve on the next page. Here's a simplified representation of our API:

```ts twoslash
import { Chunk, Effect } from "effect"

type RawData = string

class PageResult {
  constructor(
    readonly results: Chunk.Chunk<RawData>,
    readonly isLast: boolean
  ) {}
}

const pageSize = 2

const listPaginated = (
  pageNumber: number
): Effect.Effect<PageResult, Error> => {
  return Effect.succeed(
    new PageResult(
      Chunk.map(
        Chunk.range(1, pageSize),
        (index) => `Result ${pageNumber}-${index}`
      ),
      pageNumber === 2 // Return 3 pages
    )
  )
}
```

Our goal is to convert this paginated API into a stream of `RowData` events. For our initial attempt, we might think that using the `Stream.unfold` operation is the way to go:

```ts twoslash collapse={3-26}
import { Chunk, Effect, Stream, Option } from "effect"

type RawData = string

class PageResult {
  constructor(
    readonly results: Chunk.Chunk<RawData>,
    readonly isLast: boolean
  ) {}
}

const pageSize = 2

const listPaginated = (
  pageNumber: number
): Effect.Effect<PageResult, Error> => {
  return Effect.succeed(
    new PageResult(
      Chunk.map(
        Chunk.range(1, pageSize),
        (index) => `Result ${pageNumber}-${index}`
      ),
      pageNumber === 2 // Return 3 pages
    )
  )
}

const firstAttempt = Stream.unfoldChunkEffect(0, (pageNumber) =>
  listPaginated(pageNumber).pipe(
    Effect.map((page) => {
      if (page.isLast) {
        return Option.none()
      }
      return Option.some([page.results, pageNumber + 1] as const)
    })
  )
)

Effect.runPromise(Stream.runCollect(firstAttempt)).then(console.log)
/*
Output:
{
  _id: "Chunk",
  values: [ "Result 0-1", "Result 0-2", "Result 1-1", "Result 1-2" ]
}
*/
```

However, this approach has a drawback, it doesn't include the results from the last page. To work around this, we perform an extra API call to include those missing results:

```ts twoslash collapse={3-26}
import { Chunk, Effect, Stream, Option } from "effect"

type RawData = string

class PageResult {
  constructor(
    readonly results: Chunk.Chunk<RawData>,
    readonly isLast: boolean
  ) {}
}

const pageSize = 2

const listPaginated = (
  pageNumber: number
): Effect.Effect<PageResult, Error> => {
  return Effect.succeed(
    new PageResult(
      Chunk.map(
        Chunk.range(1, pageSize),
        (index) => `Result ${pageNumber}-${index}`
      ),
      pageNumber === 2 // Return 3 pages
    )
  )
}

const secondAttempt = Stream.unfoldChunkEffect(
  Option.some(0),
  (pageNumber) =>
    Option.match(pageNumber, {
      // We already hit the last page
      onNone: () => Effect.succeed(Option.none()),
      // We did not hit the last page yet
      onSome: (pageNumber) =>
        listPaginated(pageNumber).pipe(
          Effect.map((page) =>
            Option.some([
              page.results,
              page.isLast ? Option.none() : Option.some(pageNumber + 1)
            ])
          )
        )
    })
)

Effect.runPromise(Stream.runCollect(secondAttempt)).then(console.log)
/*
Output:
{
  _id: 'Chunk',
  values: [
    'Result 0-1',
    'Result 0-2',
    'Result 1-1',
    'Result 1-2',
    'Result 2-1',
    'Result 2-2'
  ]
}
*/
```

While this approach works, it's clear that `Stream.unfold` isn't the most friendly option for retrieving data from paginated APIs. It requires additional workarounds to include the results from the last page.

This is where `Stream.paginate` comes to the rescue. It provides a more ergonomic way to convert a paginated API into an Effect stream. Let's rewrite our solution using `Stream.paginate`:

```ts twoslash collapse={3-26}
import { Chunk, Effect, Stream, Option } from "effect"

type RawData = string

class PageResult {
  constructor(
    readonly results: Chunk.Chunk<RawData>,
    readonly isLast: boolean
  ) {}
}

const pageSize = 2

const listPaginated = (
  pageNumber: number
): Effect.Effect<PageResult, Error> => {
  return Effect.succeed(
    new PageResult(
      Chunk.map(
        Chunk.range(1, pageSize),
        (index) => `Result ${pageNumber}-${index}`
      ),
      pageNumber === 2 // Return 3 pages
    )
  )
}

const finalAttempt = Stream.paginateChunkEffect(0, (pageNumber) =>
  listPaginated(pageNumber).pipe(
    Effect.andThen((page) => {
      return [
        page.results,
        page.isLast ? Option.none<number>() : Option.some(pageNumber + 1)
      ]
    })
  )
)

Effect.runPromise(Stream.runCollect(finalAttempt)).then(console.log)
/*
Output:
{
  _id: 'Chunk',
  values: [
    'Result 0-1',
    'Result 0-2',
    'Result 1-1',
    'Result 1-2',
    'Result 2-1',
    'Result 2-2'
  ]
}
*/
```

## From Queue and PubSub

In Effect, there are two essential asynchronous messaging data types: [Queue](/docs/concurrency/queue/) and [PubSub](/docs/concurrency/pubsub/). You can easily transform these data types into `Stream`s by utilizing `Stream.fromQueue` and `Stream.fromPubSub`, respectively.

## From Schedule

We can create a stream from a `Schedule` that does not require any further input. The stream will emit an element for each value output from the schedule, continuing for as long as the schedule continues:

```ts twoslash
import { Effect, Stream, Schedule } from "effect"

// Emits values every 1 second for a total of 10 emissions
const schedule = Schedule.spaced("1 second").pipe(
  Schedule.compose(Schedule.recurs(10))
)

const stream = Stream.fromSchedule(schedule)

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
Output:
{
  _id: 'Chunk',
  values: [
    0, 1, 2, 3, 4,
    5, 6, 7, 8, 9
  ]
}
*/
```
