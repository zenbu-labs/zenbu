---
title: SubscriptionRef
description: Learn how to manage shared state with SubscriptionRef in Effect, enabling multiple observers to subscribe to and react to state changes efficiently in concurrent environments.
sidebar:
  order: 2
---

A `SubscriptionRef<A>` is a specialized form of a [SynchronizedRef](/docs/state-management/synchronizedref/). It allows us to subscribe and receive updates on the current value and any changes made to that value.

```ts showLineNumbers=false
interface SubscriptionRef<A> extends SynchronizedRef<A> {
  /**
   * A stream containing the current value of the `Ref` as well as all changes
   * to that value.
   */
  readonly changes: Stream<A>
}
```

You can perform all standard operations on a `SubscriptionRef`, such as `get`, `set`, or `modify` to interact with the current value.

The key feature of `SubscriptionRef` is its `changes` stream. This stream allows you to observe the current value at the moment of subscription and receive all subsequent changes. Every time the stream is run, it emits the current value and tracks future updates.

To create a `SubscriptionRef`, you can use the `SubscriptionRef.make` constructor, specifying the initial value:

**Example** (Creating a `SubscriptionRef`)

```ts twoslash
import { SubscriptionRef } from "effect"

const ref = SubscriptionRef.make(0)
```

`SubscriptionRef` is particularly useful for modeling shared state when multiple observers need to react to changes. For example, in functional reactive programming, the `SubscriptionRef` could represent a portion of the application state, and various observers (like UI components) would update in response to state changes.

**Example** (Server-Client Model with `SubscriptionRef`)

In the following example, a "server" continually updates a shared value, while multiple "clients" observe the changes:

```ts twoslash
import { Ref, Effect } from "effect"

// Server function that increments a shared value forever
const server = (ref: Ref.Ref<number>) =>
  Ref.update(ref, (n) => n + 1).pipe(Effect.forever)
```

The `server` function operates on a regular `Ref` and continuously updates the value. It doesn't need to know about `SubscriptionRef` directly.

Next, let's define a `client` that subscribes to changes and collects a specified number of values:

```ts twoslash
import { Ref, Effect, Stream, Random } from "effect"

// Server function that increments a shared value forever
const server = (ref: Ref.Ref<number>) =>
  Ref.update(ref, (n) => n + 1).pipe(Effect.forever)

// Client function that observes the stream of changes
const client = (changes: Stream.Stream<number>) =>
  Effect.gen(function* () {
    const n = yield* Random.nextIntBetween(1, 10)
    const chunk = yield* Stream.runCollect(Stream.take(changes, n))
    return chunk
  })
```

Similarly, the `client` function only works with a `Stream` of values and doesn't concern itself with the source of these values.

To tie everything together, we start the server, launch multiple client instances in parallel, and then shut down the server when we're finished. We also create the `SubscriptionRef` in this process.

```ts twoslash
import {
  Ref,
  Effect,
  Stream,
  Random,
  SubscriptionRef,
  Fiber
} from "effect"

// Server function that increments a shared value forever
const server = (ref: Ref.Ref<number>) =>
  Ref.update(ref, (n) => n + 1).pipe(Effect.forever)

// Client function that observes the stream of changes
const client = (changes: Stream.Stream<number>) =>
  Effect.gen(function* () {
    const n = yield* Random.nextIntBetween(1, 10)
    const chunk = yield* Stream.runCollect(Stream.take(changes, n))
    return chunk
  })

const program = Effect.gen(function* () {
  // Create a SubscriptionRef with an initial value of 0
  const ref = yield* SubscriptionRef.make(0)

  // Fork the server to run concurrently
  const serverFiber = yield* Effect.fork(server(ref))

  // Create 5 clients that subscribe to the changes stream
  const clients = new Array(5).fill(null).map(() => client(ref.changes))

  // Run all clients in concurrently and collect their results
  const chunks = yield* Effect.all(clients, { concurrency: "unbounded" })

  // Interrupt the server when clients are done
  yield* Fiber.interrupt(serverFiber)

  // Output the results collected by each client
  for (const chunk of chunks) {
    console.log(chunk)
  }
})

Effect.runPromise(program)
/*
Example Output:
{ _id: 'Chunk', values: [ 4, 5, 6, 7, 8, 9 ] }
{ _id: 'Chunk', values: [ 4 ] }
{ _id: 'Chunk', values: [ 4, 5, 6, 7, 8, 9 ] }
{ _id: 'Chunk', values: [ 4, 5 ] }
{ _id: 'Chunk', values: [ 4, 5, 6, 7, 8, 9 ] }
*/
```

This setup ensures that each client observes the current value when it starts and receives all subsequent changes to the value.

Since the changes are represented as streams, you can easily build more complex programs using familiar stream operators. You can transform, filter, or merge these streams with other streams to achieve more sophisticated behavior.
