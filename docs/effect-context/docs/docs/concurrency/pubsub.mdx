---
title: PubSub
description: Effortless message broadcasting and asynchronous communication with PubSub in Effect.
sidebar:
  order: 6
---

import { Aside } from "@astrojs/starlight/components"

A `PubSub` serves as an asynchronous message hub, allowing publishers to send messages that can be received by all current subscribers.

Unlike a [Queue](/docs/concurrency/queue/), where each value is delivered to only one consumer, a `PubSub` broadcasts each published message to all subscribers. This makes `PubSub` ideal for scenarios requiring message broadcasting rather than load distribution.

## Basic Operations

A `PubSub<A>` stores messages of type `A` and provides two fundamental operations:

| API                | Description                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PubSub.publish`   | Sends a message of type `A` to the `PubSub`, returning an effect indicating if the message was successfully published.                                                                                                                |
| `PubSub.subscribe` | Creates a scoped effect that allows subscription to the `PubSub`, automatically unsubscribing when the scope ends. Subscribers receive messages through a [Dequeue](/docs/concurrency/queue/#dequeue) which holds published messages. |

**Example** (Publishing a Message to Multiple Subscribers)

```ts twoslash
import { Effect, PubSub, Queue } from "effect"

const program = Effect.scoped(
  Effect.gen(function* () {
    const pubsub = yield* PubSub.bounded<string>(2)

    // Two subscribers
    const dequeue1 = yield* PubSub.subscribe(pubsub)
    const dequeue2 = yield* PubSub.subscribe(pubsub)

    // Publish a message to the pubsub
    yield* PubSub.publish(pubsub, "Hello from a PubSub!")

    // Each subscriber receives the message
    console.log("Subscriber 1: " + (yield* Queue.take(dequeue1)))
    console.log("Subscriber 2: " + (yield* Queue.take(dequeue2)))
  })
)

Effect.runFork(program)
/*
Output:
Subscriber 1: Hello from a PubSub!
Subscriber 2: Hello from a PubSub!
*/
```

<Aside type="caution" title="Subscribe Before Publishing">
  A subscriber only receives messages published while it is actively
  subscribed. To ensure a subscriber receives a particular message,
  establish the subscription before publishing the message.
</Aside>

## Creating a PubSub

### Bounded PubSub

A bounded `PubSub` applies back pressure to publishers when it reaches capacity, suspending additional publishing until space becomes available.

Back pressure ensures that all subscribers receive all messages while they are subscribed. However, it can lead to slower message delivery if a subscriber is slow.

**Example** (Bounded PubSub Creation)

```ts twoslash
import { PubSub } from "effect"

// Creates a bounded PubSub with a capacity of 2
const boundedPubSub = PubSub.bounded<string>(2)
```

### Dropping PubSub

A dropping `PubSub` discards new values when full. The `PubSub.publish` operation returns `false` if the message is dropped.

In a dropping pubsub, publishers can continue to publish new values, but subscribers are not guaranteed to receive all messages.

**Example** (Dropping PubSub Creation)

```ts twoslash
import { PubSub } from "effect"

// Creates a dropping PubSub with a capacity of 2
const droppingPubSub = PubSub.dropping<string>(2)
```

### Sliding PubSub

A sliding `PubSub` removes the oldest message to make space for new ones, ensuring that publishing never blocks.

A sliding pubsub prevents slow subscribers from impacting the message delivery rate. However, there's still a risk that slow subscribers may miss some messages.

**Example** (Sliding PubSub Creation)

```ts twoslash
import { PubSub } from "effect"

// Creates a sliding PubSub with a capacity of 2
const slidingPubSub = PubSub.sliding<string>(2)
```

### Unbounded PubSub

An unbounded `PubSub` has no capacity limit, so publishing always succeeds immediately.

Unbounded pubsubs guarantee that all subscribers receive all messages without slowing down message delivery. However, they can grow indefinitely if messages are published faster than they are consumed.

Generally, it's recommended to use bounded, dropping, or sliding pubsubs unless you have specific use cases for unbounded pubsubs.

**Example**

```ts twoslash
import { PubSub } from "effect"

// Creates an unbounded PubSub with unlimited capacity
const unboundedPubSub = PubSub.unbounded<string>()
```

## Operators On PubSubs

### publishAll

The `PubSub.publishAll` function lets you publish multiple values to the pubsub at once.

**Example** (Publishing Multiple Messages)

```ts twoslash
import { Effect, PubSub, Queue } from "effect"

const program = Effect.scoped(
  Effect.gen(function* () {
    const pubsub = yield* PubSub.bounded<string>(2)
    const dequeue = yield* PubSub.subscribe(pubsub)
    yield* PubSub.publishAll(pubsub, ["Message 1", "Message 2"])
    console.log(yield* Queue.takeAll(dequeue))
  })
)

Effect.runFork(program)
/*
Output:
{ _id: 'Chunk', values: [ 'Message 1', 'Message 2' ] }
*/
```

### capacity / size

You can check the capacity and current size of a pubsub using `PubSub.capacity` and `PubSub.size`, respectively.

Note that `PubSub.capacity` returns a `number` because the capacity is set at pubsub creation and never changes.
In contrast, `PubSub.size` returns an effect that determines the current size of the pubsub since the number of messages in the pubsub can change over time.

**Example** (Retrieving PubSub Capacity and Size)

```ts twoslash
import { Effect, PubSub } from "effect"

const program = Effect.gen(function* () {
  const pubsub = yield* PubSub.bounded<number>(2)
  console.log(`capacity: ${PubSub.capacity(pubsub)}`)
  console.log(`size: ${yield* PubSub.size(pubsub)}`)
})

Effect.runFork(program)
/*
Output:
capacity: 2
size: 0
*/
```

### Shutting Down a PubSub

To shut down a pubsub, use `PubSub.shutdown`. You can also verify if it has been shut down with `PubSub.isShutdown`, or wait for the shutdown to complete with `PubSub.awaitShutdown`. Shutting down a pubsub also terminates all associated queues, ensuring that the shutdown signal is effectively communicated.

## PubSub as an Enqueue

`PubSub` operators mirror those of [Queue](/docs/concurrency/queue/) with the main difference being that `PubSub.publish` and `PubSub.subscribe` are used in place of `Queue.offer` and `Queue.take`. If you're already familiar with using a `Queue`, you’ll find `PubSub` straightforward.

Essentially, a `PubSub` can be seen as a `Enqueue` that only allows writes:

```ts twoslash showLineNumbers=false
import type { Queue } from "effect"

interface PubSub<A> extends Queue.Enqueue<A> {}
```

Here, the `Enqueue` type refers to a queue that only accepts enqueues (or writes). Any value enqueued here is published to the pubsub, and operations like shutdown will also affect the pubsub.

This design makes `PubSub` highly flexible, letting you use it anywhere you need a `Enqueue` that only accepts published values.
