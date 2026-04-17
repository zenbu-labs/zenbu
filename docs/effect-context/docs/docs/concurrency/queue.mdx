---
title: Queue
description: Learn how to use Effect's Queue for lightweight, type-safe, and asynchronous workflows with built-in back-pressure.
sidebar:
  order: 5
---

A `Queue` is a lightweight in-memory queue with built-in back-pressure, enabling asynchronous, purely-functional, and type-safe handling of data.

## Basic Operations

A `Queue<A>` stores values of type `A` and provides two fundamental operations:

| API           | Description                                          |
| ------------- | ---------------------------------------------------- |
| `Queue.offer` | Adds a value of type `A` to the queue.               |
| `Queue.take`  | Removes and returns the oldest value from the queue. |

**Example** (Adding and Retrieving an Item)

```ts twoslash
import { Effect, Queue } from "effect"

const program = Effect.gen(function* () {
  // Creates a bounded queue with capacity 100
  const queue = yield* Queue.bounded<number>(100)
  // Adds 1 to the queue
  yield* Queue.offer(queue, 1)
  // Retrieves and removes the oldest value
  const value = yield* Queue.take(queue)
  return value
})

Effect.runPromise(program).then(console.log)
// Output: 1
```

## Creating a Queue

Queues can be **bounded** (with a specified capacity) or **unbounded** (without a limit). Different types of queues handle new values differently when they reach capacity.

### Bounded Queue

A bounded queue applies back-pressure when full, meaning any `Queue.offer` operation will suspend until there is space.

**Example** (Creating a Bounded Queue)

```ts twoslash
import { Queue } from "effect"

// Creating a bounded queue with a capacity of 100
const boundedQueue = Queue.bounded<number>(100)
```

### Dropping Queue

A dropping queue discards new values if the queue is full.

**Example** (Creating a Dropping Queue)

```ts twoslash
import { Queue } from "effect"

// Creating a dropping queue with a capacity of 100
const droppingQueue = Queue.dropping<number>(100)
```

### Sliding Queue

A sliding queue removes old values to make space for new ones when it reaches capacity.

**Example** (Creating a Sliding Queue)

```ts twoslash
import { Queue } from "effect"

// Creating a sliding queue with a capacity of 100
const slidingQueue = Queue.sliding<number>(100)
```

### Unbounded Queue

An unbounded queue has no capacity limit, allowing unrestricted additions.

**Example** (Creating an Unbounded Queue)

```ts twoslash
import { Queue } from "effect"

// Creates an unbounded queue without a capacity limit
const unboundedQueue = Queue.unbounded<number>()
```

## Adding Items to a Queue

### offer

Use `Queue.offer` to add values to the queue.

**Example** (Adding a Single Item)

```ts twoslash
import { Effect, Queue } from "effect"

const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<number>(100)
  // Adds 1 to the queue
  yield* Queue.offer(queue, 1)
})
```

When using a back-pressured queue, `Queue.offer` suspends if the queue is full. To avoid blocking the main fiber, you can fork the `Queue.offer` operation.

**Example** (Handling a Full Queue with `Effect.fork`)

```ts twoslash
import { Effect, Queue, Fiber } from "effect"

const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<number>(1)
  // Fill the queue with one item
  yield* Queue.offer(queue, 1)
  // Attempting to add a second item will suspend as the queue is full
  const fiber = yield* Effect.fork(Queue.offer(queue, 2))
  // Empties the queue to make space
  yield* Queue.take(queue)
  // Joins the fiber, completing the suspended offer
  yield* Fiber.join(fiber)
  // Returns the size of the queue after additions
  return yield* Queue.size(queue)
})

Effect.runPromise(program).then(console.log)
// Output: 1
```

### offerAll

You can also add multiple items at once using `Queue.offerAll`.

**Example** (Adding Multiple Items)

```ts twoslash
import { Effect, Queue, Array } from "effect"

const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<number>(100)
  const items = Array.range(1, 10)
  // Adds all items to the queue at once
  yield* Queue.offerAll(queue, items)
  // Returns the size of the queue after additions
  return yield* Queue.size(queue)
})

Effect.runPromise(program).then(console.log)
// Output: 10
```

## Consuming Items from a Queue

### take

The `Queue.take` operation removes and returns the oldest item from the queue. If the queue is empty, `Queue.take` will suspend and only resume when an item is added. To prevent blocking, you can fork the `Queue.take` operation into a new fiber.

**Example** (Waiting for an Item in a Fiber)

```ts twoslash
import { Effect, Queue, Fiber } from "effect"

const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<string>(100)
  // This take operation will suspend because the queue is empty
  const fiber = yield* Effect.fork(Queue.take(queue))
  // Adds an item to the queue
  yield* Queue.offer(queue, "something")
  // Joins the fiber to get the result of the take operation
  const value = yield* Fiber.join(fiber)
  return value
})

Effect.runPromise(program).then(console.log)
// Output: something
```

### poll

To retrieve the queue's first item without suspending, use `Queue.poll`. If the queue is empty, `Queue.poll` returns `None`; if it has an item, it wraps it in `Some`.

**Example** (Polling an Item)

```ts twoslash
import { Effect, Queue } from "effect"

const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<number>(100)
  // Adds items to the queue
  yield* Queue.offer(queue, 10)
  yield* Queue.offer(queue, 20)
  // Retrieves the first item if available
  const head = yield* Queue.poll(queue)
  return head
})

Effect.runPromise(program).then(console.log)
/*
Output:
{
  _id: "Option",
  _tag: "Some",
  value: 10
}
*/
```

### takeUpTo

To retrieve multiple items, use `Queue.takeUpTo`, which returns up to the specified number of items.
If there aren't enough items, it returns all available items without waiting for more.

This function is particularly useful for batch processing when an exact number of items is not required. It ensures the program continues working with whatever data is currently available.

If you need to wait for an exact number of items before proceeding, consider using [takeN](#taken).

**Example** (Taking Up to N Items)

```ts twoslash
import { Effect, Queue } from "effect"

const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<number>(100)

  // Adds items to the queue
  yield* Queue.offer(queue, 1)
  yield* Queue.offer(queue, 2)
  yield* Queue.offer(queue, 3)

  // Retrieves up to 2 items
  const chunk = yield* Queue.takeUpTo(queue, 2)
  console.log(chunk)

  return "some result"
})

Effect.runPromise(program).then(console.log)
/*
Output:
{ _id: 'Chunk', values: [ 1, 2 ] }
some result
*/
```

### takeN

Takes a specified number of elements from a queue. If the queue does not contain enough elements, the operation suspends until the required number of elements become available.

This function is useful for scenarios where processing requires an exact number of items at a time, ensuring that the operation does not proceed until the batch is complete.

**Example** (Taking a Fixed Number of Items)

```ts twoslash
import { Effect, Queue, Fiber } from "effect"

const program = Effect.gen(function* () {
  // Create a queue that can hold up to 100 elements
  const queue = yield* Queue.bounded<number>(100)

  // Fork a fiber that attempts to take 3 items from the queue
  const fiber = yield* Effect.fork(
    Effect.gen(function* () {
      console.log("Attempting to take 3 items from the queue...")
      const chunk = yield* Queue.takeN(queue, 3)
      console.log(`Successfully took 3 items: ${chunk}`)
    })
  )

  // Offer only 2 items initially
  yield* Queue.offer(queue, 1)
  yield* Queue.offer(queue, 2)
  console.log(
    "Offered 2 items. The fiber is now waiting for the 3rd item..."
  )

  // Simulate some delay
  yield* Effect.sleep("2 seconds")

  // Offer the 3rd item, which will unblock the takeN call
  yield* Queue.offer(queue, 3)
  console.log("Offered the 3rd item, which should unblock the fiber.")

  // Wait for the fiber to finish
  yield* Fiber.join(fiber)
  return "some result"
})

Effect.runPromise(program).then(console.log)
/*
Output:
Offered 2 items. The fiber is now waiting for the 3rd item...
Attempting to take 3 items from the queue...
Offered the 3rd item, which should unblock the fiber.
Successfully took 3 items: {
  "_id": "Chunk",
  "values": [
    1,
    2,
    3
  ]
}
some result
*/
```

### takeAll

To retrieve all items from the queue at once, use `Queue.takeAll`. This operation completes immediately, returning an empty collection if the queue is empty.

**Example** (Taking All Items)

```ts twoslash
import { Effect, Queue } from "effect"

const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<number>(100)
  // Adds items to the queue
  yield* Queue.offer(queue, 10)
  yield* Queue.offer(queue, 20)
  yield* Queue.offer(queue, 30)
  // Retrieves all items from the queue
  const chunk = yield* Queue.takeAll(queue)
  return chunk
})

Effect.runPromise(program).then(console.log)
/*
Output:
{
  _id: "Chunk",
  values: [ 10, 20, 30 ]
}
*/
```

## Shutting Down a Queue

### shutdown

The `Queue.shutdown` operation allows you to interrupt all fibers that are currently suspended on `offer*` or `take*` operations. This action also empties the queue and makes any future `offer*` and `take*` calls terminate immediately.

**Example** (Interrupting Fibers on Queue Shutdown)

```ts twoslash
import { Effect, Queue, Fiber } from "effect"

const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<number>(3)
  // Forks a fiber that waits to take an item from the queue
  const fiber = yield* Effect.fork(Queue.take(queue))
  // Shuts down the queue, interrupting the fiber
  yield* Queue.shutdown(queue)
  // Joins the interrupted fiber
  yield* Fiber.join(fiber)
})
```

### awaitShutdown

The `Queue.awaitShutdown` operation can be used to run an effect when the queue shuts down. It waits until the queue is closed and resumes immediately if the queue is already shut down.

**Example** (Waiting for Queue Shutdown)

```ts twoslash
import { Effect, Queue, Fiber, Console } from "effect"

const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<number>(3)
  // Forks a fiber to await queue shutdown and log a message
  const fiber = yield* Effect.fork(
    Queue.awaitShutdown(queue).pipe(
      Effect.andThen(Console.log("shutting down"))
    )
  )
  // Shuts down the queue, triggering the await in the fiber
  yield* Queue.shutdown(queue)
  yield* Fiber.join(fiber)
})

Effect.runPromise(program)
// Output: shutting down
```

## Offer-only / Take-only Queues

Sometimes, you might want certain parts of your code to only add values to a queue (`Enqueue`) or only retrieve values from a queue (`Dequeue`). Effect provides interfaces to enforce these specific capabilities.

### Enqueue

All methods for adding values to a queue are defined by the `Enqueue` interface. This restricts the queue to only offer operations.

**Example** (Restricting Queue to Offer-only Operations)

```ts twoslash
import { Queue } from "effect"

const send = (offerOnlyQueue: Queue.Enqueue<number>, value: number) => {
  // This queue is restricted to offer operations only

  // Error: cannot use take on an offer-only queue
// @errors: 2345
  Queue.take(offerOnlyQueue)

  // Valid offer operation
  return Queue.offer(offerOnlyQueue, value)
}
```

### Dequeue

Similarly, all methods for retrieving values from a queue are defined by the `Dequeue` interface, which restricts the queue to only take operations.

**Example** (Restricting Queue to Take-only Operations)

```ts twoslash
import { Queue } from "effect"

const receive = (takeOnlyQueue: Queue.Dequeue<number>) => {
  // This queue is restricted to take operations only

  // Error: cannot use offer on a take-only queue
// @errors: 2345
  Queue.offer(takeOnlyQueue, 1)

  // Valid take operation
  return Queue.take(takeOnlyQueue)
}
```

The `Queue` type combines both `Enqueue` and `Dequeue`, so you can easily pass it to different parts of your code, enforcing only `Enqueue` or `Dequeue` behaviors as needed.

**Example** (Using Offer-only and Take-only Queues Together)

```ts twoslash
import { Effect, Queue } from "effect"

const send = (offerOnlyQueue: Queue.Enqueue<number>, value: number) => {
  return Queue.offer(offerOnlyQueue, value)
}

const receive = (takeOnlyQueue: Queue.Dequeue<number>) => {
  return Queue.take(takeOnlyQueue)
}

const program = Effect.gen(function* () {
  const queue = yield* Queue.unbounded<number>()

  // Add values to the queue
  yield* send(queue, 1)
  yield* send(queue, 2)

  // Retrieve values from the queue
  console.log(yield* receive(queue))
  console.log(yield* receive(queue))
})

Effect.runFork(program)
/*
Output:
1
2
*/
```
