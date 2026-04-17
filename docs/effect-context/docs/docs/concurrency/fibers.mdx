---
title: Fibers
description: Understand fibers in Effect, lightweight virtual threads enabling powerful concurrency, structured lifecycles, and efficient resource management for responsive applications.
sidebar:
  order: 2
---

import { Aside } from "@astrojs/starlight/components"

Effect is a highly concurrent framework powered by fibers. Fibers are lightweight virtual threads with resource-safe cancellation capabilities, enabling many features in Effect.

In this section, you will learn the basics of fibers and get familiar with some of the powerful low-level operators that utilize fibers.

## What Are Virtual Threads?

JavaScript is inherently single-threaded, meaning it executes code in a single sequence of instructions. However, modern JavaScript environments use an event loop to manage asynchronous operations, creating the illusion of multitasking. In this context, virtual threads, or fibers, are logical threads simulated by the Effect runtime. They allow concurrent execution without relying on true multi-threading, which is not natively supported in JavaScript.

## How Fibers work

All effects in Effect are executed by fibers. If you didn't create the fiber yourself, it was created by an operation you're using (if it's concurrent) or by the Effect runtime system.

A fiber is created any time an effect is run. When running effects concurrently, a fiber is created for each concurrent effect.

Even if you write "single-threaded" code with no concurrent operations, there will always be at least one fiber: the "main" fiber that executes your effect.

Effect fibers have a well-defined lifecycle based on the effect they are executing.

Every fiber exits with either a failure or success, depending on whether the effect it is executing fails or succeeds.

Effect fibers have unique identities, local state, and a status (such as done, running, or suspended).

To summarize:

- An `Effect` is a higher-level concept that describes an effectful computation. It is lazy and immutable, meaning it represents a computation that may produce a value or fail but does not immediately execute.
- A fiber, on the other hand, represents the running execution of an `Effect`. It can be interrupted or awaited to retrieve its result. Think of it as a way to control and interact with the ongoing computation.

## The Fiber Data Type

The `Fiber` data type in Effect represents a "handle" on the execution of an effect.

Here is the general form of a `Fiber`:

```text showLineNumbers=false
        ┌─── Represents the success type
        │        ┌─── Represents the error type
        │        │
        ▼        ▼
Fiber<Success, Error>
```

This type indicates that a fiber:

- Succeeds and returns a value of type `Success`
- Fails with an error of type `Error`

Fibers do not have an `Requirements` type parameter because they only execute effects that have already had their requirements provided to them.

## Forking Effects

You can create a new fiber by **forking** an effect. This starts the effect in a new fiber, and you receive a reference to that fiber.

**Example** (Forking a Fiber)

In this example, the Fibonacci calculation is forked into its own fiber, allowing it to run independently of the main fiber. The reference to the `fib10Fiber` can be used later to join or interrupt the fiber.

```ts twoslash
import { Effect } from "effect"

const fib = (n: number): Effect.Effect<number> =>
  n < 2
    ? Effect.succeed(n)
    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) => a + b)

//      ┌─── Effect<RuntimeFiber<number, never>, never, never>
//      ▼
const fib10Fiber = Effect.fork(fib(10))
```

## Joining Fibers

One common operation with fibers is **joining** them. By using the `Fiber.join` function, you can wait for a fiber to complete and retrieve its result. The joined fiber will either succeed or fail, and the `Effect` returned by `join` reflects the outcome of the fiber.

**Example** (Joining a Fiber)

```ts twoslash
import { Effect, Fiber } from "effect"

const fib = (n: number): Effect.Effect<number> =>
  n < 2
    ? Effect.succeed(n)
    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) => a + b)

//      ┌─── Effect<RuntimeFiber<number, never>, never, never>
//      ▼
const fib10Fiber = Effect.fork(fib(10))

const program = Effect.gen(function* () {
  // Retrieve the fiber
  const fiber = yield* fib10Fiber
  // Join the fiber and get the result
  const n = yield* Fiber.join(fiber)
  console.log(n)
})

Effect.runFork(program) // Output: 55
```

## Awaiting Fibers

The `Fiber.await` function is a helpful tool when working with fibers. It allows you to wait for a fiber to complete and retrieve detailed information about how it finished. The result is encapsulated in an [Exit](/docs/data-types/exit/) value, which gives you insight into whether the fiber succeeded, failed, or was interrupted.

**Example** (Awaiting Fiber Completion)

```ts twoslash
import { Effect, Fiber } from "effect"

const fib = (n: number): Effect.Effect<number> =>
  n < 2
    ? Effect.succeed(n)
    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) => a + b)

//      ┌─── Effect<RuntimeFiber<number, never>, never, never>
//      ▼
const fib10Fiber = Effect.fork(fib(10))

const program = Effect.gen(function* () {
  // Retrieve the fiber
  const fiber = yield* fib10Fiber
  // Await its completion and get the Exit result
  const exit = yield* Fiber.await(fiber)
  console.log(exit)
})

Effect.runFork(program)
/*
Output:
{ _id: 'Exit', _tag: 'Success', value: 55 }
*/
```

## Interruption Model

While developing concurrent applications, there are several cases that we need to interrupt the execution of other fibers, for example:

1. A parent fiber might start some child fibers to perform a task, and later the parent might decide that, it doesn't need the result of some or all of the child fibers.

2. Two or more fibers start race with each other. The fiber whose result is computed first wins, and all other fibers are no longer needed, and should be interrupted.

3. In interactive applications, a user may want to stop some already running tasks, such as clicking on the "stop" button to prevent downloading more files.

4. Computations that run longer than expected should be aborted by using timeout operations.

5. When we have an application that perform compute-intensive tasks based on the user inputs, if the user changes the input we should cancel the current task and perform another one.

### Polling vs. Asynchronous Interruption

When it comes to interrupting fibers, a naive approach is to allow one fiber to forcefully terminate another fiber. However, this approach is not ideal because it can leave shared state in an inconsistent and unreliable state if the target fiber is in the middle of modifying that state. Therefore, it does not guarantee internal consistency of the shared mutable state.

Instead, there are two popular and valid solutions to tackle this problem:

1. **Semi-asynchronous Interruption (Polling for Interruption)**: Imperative languages often employ polling as a semi-asynchronous signaling mechanism, such as Java. In this model, a fiber sends an interruption request to another fiber. The target fiber continuously polls the interrupt status and checks whether it has received any interruption requests from other fibers. If an interruption request is detected, the target fiber terminates itself as soon as possible.

   With this solution, the fiber itself handles critical sections. So, if a fiber is in the middle of a critical section and receives an interruption request, it ignores the interruption and defers its handling until after the critical section.

   However, one drawback of this approach is that if the programmer forgets to poll regularly, the target fiber can become unresponsive, leading to deadlocks. Additionally, polling a global flag is not aligned with the functional paradigm followed by Effect.

2. **Asynchronous Interruption**: In asynchronous interruption, a fiber is allowed to terminate another fiber. The target fiber is not responsible for polling the interrupt status. Instead, during critical sections, the target fiber disables the interruptibility of those regions. This is a purely functional solution that doesn't require polling a global state. Effect adopts this solution for its interruption model, which is a fully asynchronous signaling mechanism.

   This mechanism overcomes the drawback of forgetting to poll regularly. It is also fully compatible with the functional paradigm because in a purely functional computation, we can abort the computation at any point, except during critical sections where interruption is disabled.

### Interrupting Fibers

Fibers can be interrupted if their result is no longer needed. This action immediately stops the fiber and safely runs all finalizers to release any resources.

Like `Fiber.await`, the `Fiber.interrupt` function returns an [Exit](/docs/data-types/exit/) value that provides detailed information about how the fiber ended.

**Example** (Interrupting a Fiber)

```ts twoslash
import { Effect, Fiber } from "effect"

const program = Effect.gen(function* () {
  // Fork a fiber that runs indefinitely, printing "Hi!"
  const fiber = yield* Effect.fork(
    Effect.forever(Effect.log("Hi!").pipe(Effect.delay("10 millis")))
  )
  yield* Effect.sleep("30 millis")
  // Interrupt the fiber and get an Exit value detailing how it finished
  const exit = yield* Fiber.interrupt(fiber)
  console.log(exit)
})

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#1 message=Hi!
timestamp=... level=INFO fiber=#1 message=Hi!
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Interrupt',
    fiberId: {
      _id: 'FiberId',
      _tag: 'Runtime',
      id: 0,
      startTimeMillis: ...
    }
  }
}
*/
```

By default, the effect returned by `Fiber.interrupt` waits until the fiber has fully terminated before resuming. This ensures that no new fibers are started before the previous ones have finished, a behavior known as "back-pressuring."

If you do not require this waiting behavior, you can fork the interruption itself, allowing the main program to proceed without waiting for the fiber to terminate:

**Example** (Forking an Interruption)

```ts twoslash
import { Effect, Fiber } from "effect"

const program = Effect.gen(function* () {
  const fiber = yield* Effect.fork(
    Effect.forever(Effect.log("Hi!").pipe(Effect.delay("10 millis")))
  )
  yield* Effect.sleep("30 millis")
  const _ = yield* Effect.fork(Fiber.interrupt(fiber))
  console.log("Do something else...")
})

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#1 message=Hi!
timestamp=... level=INFO fiber=#1 message=Hi!
Do something else...
*/
```

There is also a shorthand for background interruption called `Fiber.interruptFork`.

```ts twoslash del={8} ins={9}
import { Effect, Fiber } from "effect"

const program = Effect.gen(function* () {
  const fiber = yield* Effect.fork(
    Effect.forever(Effect.log("Hi!").pipe(Effect.delay("10 millis")))
  )
  yield* Effect.sleep("30 millis")
  // const _ = yield* Effect.fork(Fiber.interrupt(fiber))
  const _ = yield* Fiber.interruptFork(fiber)
  console.log("Do something else...")
})

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#1 message=Hi!
timestamp=... level=INFO fiber=#1 message=Hi!
Do something else...
*/
```

<Aside type="tip" title="Interrupting via Effect.interrupt">
  You can also interrupt fibers using the high-level API
  `Effect.interrupt`. For more details, refer to the [Effect.interrupt
  documentation](/docs/concurrency/basic-concurrency/#interruptions).
</Aside>

## Composing Fibers

The `Fiber.zip` and `Fiber.zipWith` functions allow you to combine two fibers into one. The resulting fiber will produce the results of both input fibers. If either fiber fails, the combined fiber will also fail.

**Example** (Combining Fibers with `Fiber.zip`)

In this example, both fibers run concurrently, and the results are combined into a tuple.

```ts twoslash
import { Effect, Fiber } from "effect"

const program = Effect.gen(function* () {
  // Fork two fibers that each produce a string
  const fiber1 = yield* Effect.fork(Effect.succeed("Hi!"))
  const fiber2 = yield* Effect.fork(Effect.succeed("Bye!"))

  // Combine the two fibers using Fiber.zip
  const fiber = Fiber.zip(fiber1, fiber2)

  // Join the combined fiber and get the result as a tuple
  const tuple = yield* Fiber.join(fiber)
  console.log(tuple)
})

Effect.runFork(program)
/*
Output:
[ 'Hi!', 'Bye!' ]
*/
```

Another way to compose fibers is by using `Fiber.orElse`. This function allows you to provide an alternative fiber that will execute if the first one fails. If the first fiber succeeds, its result will be returned. If it fails, the second fiber will run instead, and its result will be returned regardless of its outcome.

**Example** (Providing a Fallback Fiber with `Fiber.orElse`)

```ts twoslash
import { Effect, Fiber } from "effect"

const program = Effect.gen(function* () {
  // Fork a fiber that will fail
  const fiber1 = yield* Effect.fork(Effect.fail("Uh oh!"))
  // Fork another fiber that will succeed
  const fiber2 = yield* Effect.fork(Effect.succeed("Hurray!"))
  // If fiber1 fails, fiber2 will be used as a fallback
  const fiber = Fiber.orElse(fiber1, fiber2)
  const message = yield* Fiber.join(fiber)
  console.log(message)
})

Effect.runFork(program)
/*
Output:
Hurray!
*/
```

## Lifetime of Child Fibers

When we fork fibers, depending on how we fork them we can have four different lifetime strategies for the child fibers:

1. **Fork With Automatic Supervision**. If we use the ordinary `Effect.fork` operation, the child fiber will be automatically supervised by the parent fiber. The lifetime child fibers are tied to the lifetime of their parent fiber. This means that these fibers will be terminated either when they end naturally, or when their parent fiber is terminated.

2. **Fork in Global Scope (Daemon)**. Sometimes we want to run long-running background fibers that aren't tied to their parent fiber, and also we want to fork them in a global scope. Any fiber that is forked in global scope will become daemon fiber. This can be achieved by using the `Effect.forkDaemon` operator. As these fibers have no parent, they are not supervised, and they will be terminated when they end naturally, or when our application is terminated.

3. **Fork in Local Scope**. Sometimes, we want to run a background fiber that isn't tied to its parent fiber, but we want that fiber to live in the local scope. We can fork fibers in the local scope by using `Effect.forkScoped`. Such fibers can outlive their parent fiber (so they are not supervised by their parents), and they will be terminated when their life end or their local scope is closed.

4. **Fork in Specific Scope**. This is similar to the previous strategy, but we can have more fine-grained control over the lifetime of the child fiber by forking it in a specific scope. We can do this by using the `Effect.forkIn` operator.

### Fork with Automatic Supervision

Effect follows a **structured concurrency** model, where child fibers' lifetimes are tied to their parent. Simply put, the lifespan of a fiber depends on the lifespan of its parent fiber.

**Example** (Automatically Supervised Child Fiber)

In this scenario, the `parent` fiber spawns a `child` fiber that repeatedly prints a message every second.
The `child` fiber will be terminated when the `parent` fiber completes.

```ts twoslash
import { Effect, Console, Schedule } from "effect"

// Child fiber that logs a message repeatedly every second
const child = Effect.repeat(
  Console.log("child: still running!"),
  Schedule.fixed("1 second")
)

const parent = Effect.gen(function* () {
  console.log("parent: started!")
  // Child fiber is supervised by the parent
  yield* Effect.fork(child)
  yield* Effect.sleep("3 seconds")
  console.log("parent: finished!")
})

Effect.runFork(parent)
/*
Output:
parent: started!
child: still running!
child: still running!
child: still running!
parent: finished!
*/
```

This behavior can be extended to any level of nested fibers, ensuring a predictable and controlled fiber lifecycle.

### Fork in Global Scope (Daemon)

You can create a long-running background fiber using `Effect.forkDaemon`. This type of fiber, known as a daemon fiber, is not tied to the lifecycle of its parent fiber. Instead, its lifetime is linked to the global scope. A daemon fiber continues running even if its parent fiber is terminated and will only stop when the global scope is closed or the fiber completes naturally.

**Example** (Creating a Daemon Fiber)

This example shows how daemon fibers can continue running in the background even after the parent fiber has finished.

```ts twoslash
import { Effect, Console, Schedule } from "effect"

// Daemon fiber that logs a message repeatedly every second
const daemon = Effect.repeat(
  Console.log("daemon: still running!"),
  Schedule.fixed("1 second")
)

const parent = Effect.gen(function* () {
  console.log("parent: started!")
  // Daemon fiber running independently
  yield* Effect.forkDaemon(daemon)
  yield* Effect.sleep("3 seconds")
  console.log("parent: finished!")
})

Effect.runFork(parent)
/*
Output:
parent: started!
daemon: still running!
daemon: still running!
daemon: still running!
parent: finished!
daemon: still running!
daemon: still running!
daemon: still running!
daemon: still running!
daemon: still running!
...etc...
*/
```

Even if the parent fiber is interrupted, the daemon fiber will continue running independently.

**Example** (Interrupting the Parent Fiber)

In this example, interrupting the parent fiber doesn't affect the daemon fiber, which continues to run in the background.

```ts twoslash
import { Effect, Console, Schedule, Fiber } from "effect"

// Daemon fiber that logs a message repeatedly every second
const daemon = Effect.repeat(
  Console.log("daemon: still running!"),
  Schedule.fixed("1 second")
)

const parent = Effect.gen(function* () {
  console.log("parent: started!")
  // Daemon fiber running independently
  yield* Effect.forkDaemon(daemon)
  yield* Effect.sleep("3 seconds")
  console.log("parent: finished!")
}).pipe(Effect.onInterrupt(() => Console.log("parent: interrupted!")))

// Program that interrupts the parent fiber after 2 seconds
const program = Effect.gen(function* () {
  const fiber = yield* Effect.fork(parent)
  yield* Effect.sleep("2 seconds")
  yield* Fiber.interrupt(fiber) // Interrupt the parent fiber
})

Effect.runFork(program)
/*
Output:
parent: started!
daemon: still running!
daemon: still running!
parent: interrupted!
daemon: still running!
daemon: still running!
daemon: still running!
daemon: still running!
daemon: still running!
...etc...
*/
```

### Fork in Local Scope

Sometimes we want to create a fiber that is tied to a local [scope](/docs/resource-management/scope/), meaning its lifetime is not dependent on its parent fiber but is bound to the local scope in which it was forked. This can be done using the `Effect.forkScoped` operator.

Fibers created with `Effect.forkScoped` can outlive their parent fibers and will only be terminated when the local scope itself is closed.

**Example** (Forking a Fiber in a Local Scope)

In this example, the `child` fiber continues to run beyond the lifetime of the `parent` fiber. The `child` fiber is tied to the local scope and will be terminated only when the scope ends.

```ts twoslash
import { Effect, Console, Schedule } from "effect"

// Child fiber that logs a message repeatedly every second
const child = Effect.repeat(
  Console.log("child: still running!"),
  Schedule.fixed("1 second")
)

//      ┌─── Effect<void, never, Scope>
//      ▼
const parent = Effect.gen(function* () {
  console.log("parent: started!")
  // Child fiber attached to local scope
  yield* Effect.forkScoped(child)
  yield* Effect.sleep("3 seconds")
  console.log("parent: finished!")
})

// Program runs within a local scope
const program = Effect.scoped(
  Effect.gen(function* () {
    console.log("Local scope started!")
    yield* Effect.fork(parent)
    // Scope lasts for 5 seconds
    yield* Effect.sleep("5 seconds")
    console.log("Leaving the local scope!")
  })
)

Effect.runFork(program)
/*
Output:
Local scope started!
parent: started!
child: still running!
child: still running!
child: still running!
parent: finished!
child: still running!
child: still running!
Leaving the local scope!
*/
```

### Fork in Specific Scope

There are some cases where we need more fine-grained control, so we want to fork a fiber in a specific scope.
We can use the `Effect.forkIn` operator which takes the target scope as an argument.

**Example** (Forking a Fiber in a Specific Scope)

In this example, the `child` fiber is forked into the `outerScope`, allowing it to outlive the inner scope but still be terminated when the `outerScope` is closed.

```ts twoslash
import { Console, Effect, Schedule } from "effect"

// Child fiber that logs a message repeatedly every second
const child = Effect.repeat(
  Console.log("child: still running!"),
  Schedule.fixed("1 second")
)

const program = Effect.scoped(
  Effect.gen(function* () {
    yield* Effect.addFinalizer(() =>
      Console.log("The outer scope is about to be closed!")
    )

    // Capture the outer scope
    const outerScope = yield* Effect.scope

    // Create an inner scope
    yield* Effect.scoped(
      Effect.gen(function* () {
        yield* Effect.addFinalizer(() =>
          Console.log("The inner scope is about to be closed!")
        )
        // Fork the child fiber in the outer scope
        yield* Effect.forkIn(child, outerScope)
        yield* Effect.sleep("3 seconds")
      })
    )

    yield* Effect.sleep("5 seconds")
  })
)

Effect.runFork(program)
/*
Output:
child: still running!
child: still running!
child: still running!
The inner scope is about to be closed!
child: still running!
child: still running!
child: still running!
child: still running!
child: still running!
child: still running!
The outer scope is about to be closed!
*/
```

## When do Fibers run?

Forked fibers begin execution after the current fiber completes or yields.

**Example** (Late Fiber Start Captures Only One Value)

In the following example, the `changes` stream only captures a single value, `2`.
This happens because the fiber created by `Effect.fork` starts **after** the value is updated.

```ts twoslash
import { Effect, SubscriptionRef, Stream, Console } from "effect"

const program = Effect.gen(function* () {
  const ref = yield* SubscriptionRef.make(0)
  yield* ref.changes.pipe(
    // Log each change in SubscriptionRef
    Stream.tap((n) => Console.log(`SubscriptionRef changed to ${n}`)),
    Stream.runDrain,
    // Fork a fiber to run the stream
    Effect.fork
  )
  yield* SubscriptionRef.set(ref, 1)
  yield* SubscriptionRef.set(ref, 2)
})

Effect.runFork(program)
/*
Output:
SubscriptionRef changed to 2
*/
```

If you add a short delay with `Effect.sleep()` or call `Effect.yieldNow()`, you allow the current fiber to yield. This gives the forked fiber enough time to start and collect all values before they are updated.

<Aside type="caution" title="Fiber Execution is Non-Deterministic">
  Keep in mind that the timing of fiber execution is not deterministic,
  and many factors can affect when a fiber starts. Do not rely on the idea
  that a single yield always ensures your fiber begins at a particular
  time.
</Aside>

**Example** (Delay Allows Fiber to Capture All Values)

```ts twoslash ins={14}
import { Effect, SubscriptionRef, Stream, Console } from "effect"

const program = Effect.gen(function* () {
  const ref = yield* SubscriptionRef.make(0)
  yield* ref.changes.pipe(
    // Log each change in SubscriptionRef
    Stream.tap((n) => Console.log(`SubscriptionRef changed to ${n}`)),
    Stream.runDrain,
    // Fork a fiber to run the stream
    Effect.fork
  )

  // Allow the fiber a chance to start
  yield* Effect.sleep("100 millis")

  yield* SubscriptionRef.set(ref, 1)
  yield* SubscriptionRef.set(ref, 2)
})

Effect.runFork(program)
/*
Output:
SubscriptionRef changed to 0
SubscriptionRef changed to 1
SubscriptionRef changed to 2
*/
```
