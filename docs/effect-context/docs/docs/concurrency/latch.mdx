---
title: Latch
description: A Latch synchronizes fibers by allowing them to wait until a specific event occurs, controlling access based on its open or closed state.
sidebar:
  order: 8
---

A Latch is a synchronization tool that works like a gate, letting fibers wait until the latch is opened before they continue. The latch can be either open or closed:

- When closed, fibers that reach the latch wait until it opens.
- When open, fibers pass through immediately.

Once opened, a latch typically stays open, although you can close it again if needed

Imagine an application that processes requests only after completing an initial setup (like loading configuration data or establishing a database connection).
You can create a latch in a closed state while the setup is happening.
Any incoming requests, represented as fibers, would wait at the latch until it opens.
Once the setup is finished, you call `latch.open` so the requests can proceed.

## The Latch Interface

A `Latch` includes several operations that let you control and observe its state:

| Operation  | Description                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `whenOpen` | Runs a given effect only if the latch is open, otherwise, waits until it opens.                          |
| `open`     | Opens the latch so that any waiting fibers can proceed.                                                  |
| `close`    | Closes the latch, causing fibers to wait when they reach this latch in the future.                       |
| `await`    | Suspends the current fiber until the latch is opened. If the latch is already open, returns immediately. |
| `release`  | Allows waiting fibers to continue without permanently opening the latch.                                 |

## Creating a Latch

Use the `Effect.makeLatch` function to create a latch in an open or closed state by passing a boolean. The default is `false`, which means it starts closed.

**Example** (Creating and Using a Latch)

In this example, the latch starts closed. A fiber logs "open sesame" only when the latch is open. After waiting for one second, the latch is opened, releasing the fiber:

```ts twoslash
import { Console, Effect } from "effect"

// A generator function that demonstrates latch usage
const program = Effect.gen(function* () {
  // Create a latch, starting in the closed state
  const latch = yield* Effect.makeLatch()

  // Fork a fiber that logs "open sesame" only when the latch is open
  const fiber = yield* Console.log("open sesame").pipe(
    latch.whenOpen, // Waits for the latch to open
    Effect.fork // Fork the effect into a new fiber
  )

  // Wait for 1 second
  yield* Effect.sleep("1 second")

  // Open the latch, releasing the fiber
  yield* latch.open

  // Wait for the forked fiber to finish
  yield* fiber.await
})

Effect.runFork(program)
// Output: open sesame (after 1 second)
```

## Latch vs Semaphore

A latch is good when you have a one-time event or condition that determines whether fibers can proceed. For example, you might use a latch to block all fibers until a setup step is finished, and then open the latch so everyone can continue.

A [semaphore](/docs/concurrency/semaphore/) with one lock (often called a binary semaphore or a mutex) is usually for mutual exclusion: it ensures that only one fiber at a time accesses a shared resource or section of code. Once a fiber acquires the lock, no other fiber can enter the protected area until the lock is released.

In short:

- Use a **latch** if you're gating a set of fibers on a specific event ("Wait here until this becomes true").
- Use a **semaphore (with one lock)** if you need to ensure only one fiber at a time is in a critical section or using a shared resource.
