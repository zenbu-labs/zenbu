---
title: Ref
description: Learn how to manage state in concurrent applications using Effect's Ref data type. Master mutable references for safe, controlled state updates across fibers.
sidebar:
  order: 0
---

import { Aside } from "@astrojs/starlight/components"

When we write programs, it is common to need to keep track of some form of state during the execution of the program. State refers to any data that can change as the program runs. For example, in a counter application, the count value changes as the user increments or decrements it. Similarly, in a banking application, the account balance changes as deposits and withdrawals are made. State management is crucial to building interactive and dynamic applications.

In traditional imperative programming, one common way to store state is using variables. However, this approach can introduce bugs, especially when the state is shared between multiple components or functions. As the program becomes more complex, managing shared state can become challenging.

To overcome these issues, Effect introduces a powerful data type called `Ref`, which represents a mutable reference. With `Ref`, we can share state between different parts of our program without relying on mutable variables directly. Instead, `Ref` provides a controlled way to handle mutable state and safely update it in a concurrent environment.

Effect's `Ref` data type enables communication between different fibers in your program. This capability is crucial in concurrent programming, where multiple tasks may need to access and update shared state simultaneously.

In this guide, we will explore how to use the `Ref` data type to manage state in your programs effectively. We will cover simple examples like counting, as well as more complex scenarios where state is shared between different parts of the program. Additionally, we will show how to use `Ref` in a concurrent environment, allowing multiple tasks to interact with shared state safely.

Let's dive in and see how we can leverage `Ref` for effective state management in your Effect programs.

## Using Ref

Here is a simple example using `Ref` to create a counter:

**Example** (Basic Counter with `Ref`)

```ts twoslash
import { Effect, Ref } from "effect"

class Counter {
  inc: Effect.Effect<void>
  dec: Effect.Effect<void>
  get: Effect.Effect<number>

  constructor(private value: Ref.Ref<number>) {
    this.inc = Ref.update(this.value, (n) => n + 1)
    this.dec = Ref.update(this.value, (n) => n - 1)
    this.get = Ref.get(this.value)
  }
}

const make = Effect.andThen(Ref.make(0), (value) => new Counter(value))
```

**Example** (Using the Counter)

```ts twoslash collapse={3-15}
import { Effect, Ref } from "effect"

class Counter {
  inc: Effect.Effect<void>
  dec: Effect.Effect<void>
  get: Effect.Effect<number>

  constructor(private value: Ref.Ref<number>) {
    this.inc = Ref.update(this.value, (n) => n + 1)
    this.dec = Ref.update(this.value, (n) => n - 1)
    this.get = Ref.get(this.value)
  }
}

const make = Effect.andThen(Ref.make(0), (value) => new Counter(value))

const program = Effect.gen(function* () {
  const counter = yield* make
  yield* counter.inc
  yield* counter.inc
  yield* counter.dec
  yield* counter.inc
  const value = yield* counter.get
  console.log(`This counter has a value of ${value}.`)
})

Effect.runPromise(program)
/*
Output:
This counter has a value of 2.
*/
```

<Aside type="note" title="Ref Operations Are Effectful">
  All the operations on the `Ref` data type are effectful. So when we are
  reading from or writing to a `Ref`, we are performing an effectful
  operation.
</Aside>

## Using Ref in a Concurrent Environment

We can also use `Ref` in concurrent scenarios, where multiple tasks might be updating shared state at the same time.

**Example** (Concurrent Updates to Shared Counter)

For this example, let's update the counter concurrently:

```ts twoslash collapse={3-15}
import { Effect, Ref } from "effect"

class Counter {
  inc: Effect.Effect<void>
  dec: Effect.Effect<void>
  get: Effect.Effect<number>

  constructor(private value: Ref.Ref<number>) {
    this.inc = Ref.update(this.value, (n) => n + 1)
    this.dec = Ref.update(this.value, (n) => n - 1)
    this.get = Ref.get(this.value)
  }
}

const make = Effect.andThen(Ref.make(0), (value) => new Counter(value))

const program = Effect.gen(function* () {
  const counter = yield* make

  // Helper to log the counter's value before running an effect
  const logCounter = <R, E, A>(
    label: string,
    effect: Effect.Effect<A, E, R>
  ) =>
    Effect.gen(function* () {
      const value = yield* counter.get
      yield* Effect.log(`${label} get: ${value}`)
      return yield* effect
    })

  yield* logCounter("task 1", counter.inc).pipe(
    Effect.zip(logCounter("task 2", counter.inc), { concurrent: true }),
    Effect.zip(logCounter("task 3", counter.dec), { concurrent: true }),
    Effect.zip(logCounter("task 4", counter.inc), { concurrent: true })
  )
  const value = yield* counter.get
  yield* Effect.log(`This counter has a value of ${value}.`)
})

Effect.runPromise(program)
/*
Output:
timestamp=... fiber=#3 message="task 4 get: 0"
timestamp=... fiber=#6 message="task 3 get: 1"
timestamp=... fiber=#8 message="task 1 get: 0"
timestamp=... fiber=#9 message="task 2 get: 1"
timestamp=... fiber=#0 message="This counter has a value of 2."
*/
```

## Using Ref as a Service

You can pass a `Ref` as a [service](/docs/requirements-management/services/) to share state across different parts of your program.

**Example** (Using `Ref` as a Service)

```ts twoslash
import { Effect, Context, Ref } from "effect"

// Create a Tag for our state
class MyState extends Context.Tag("MyState")<
  MyState,
  Ref.Ref<number>
>() {}

// Subprogram 1: Increment the state value twice
const subprogram1 = Effect.gen(function* () {
  const state = yield* MyState
  yield* Ref.update(state, (n) => n + 1)
  yield* Ref.update(state, (n) => n + 1)
})

// Subprogram 2: Decrement the state value and then increment it
const subprogram2 = Effect.gen(function* () {
  const state = yield* MyState
  yield* Ref.update(state, (n) => n - 1)
  yield* Ref.update(state, (n) => n + 1)
})

// Subprogram 3: Read and log the current value of the state
const subprogram3 = Effect.gen(function* () {
  const state = yield* MyState
  const value = yield* Ref.get(state)
  console.log(`MyState has a value of ${value}.`)
})

// Compose subprograms 1, 2, and 3 to create the main program
const program = Effect.gen(function* () {
  yield* subprogram1
  yield* subprogram2
  yield* subprogram3
})

// Create a Ref instance with an initial value of 0
const initialState = Ref.make(0)

// Provide the Ref as a service
const runnable = program.pipe(
  Effect.provideServiceEffect(MyState, initialState)
)

// Run the program and observe the output
Effect.runPromise(runnable)
/*
Output:
MyState has a value of 2.
*/
```

Note that we use `Effect.provideServiceEffect` instead of `Effect.provideService` to provide an actual implementation of the `MyState` service because all the operations on the `Ref` data type are effectful, including the creation `Ref.make(0)`.

## Sharing State Between Fibers

You can use `Ref` to manage shared state between multiple fibers in a concurrent environment.

**Example** (Managing Shared State Across Fibers)

Let's look at an example where we continuously read names from user input until the user enters `"q"` to exit.

First, let's introduce a `readLine` utility to read user input (ensure you have `@types/node` installed):

```ts twoslash
import { Effect } from "effect"
import * as NodeReadLine from "node:readline"

// Utility to read user input
const readLine = (message: string): Effect.Effect<string> =>
  Effect.promise(
    () =>
      new Promise((resolve) => {
        const rl = NodeReadLine.createInterface({
          input: process.stdin,
          output: process.stdout
        })
        rl.question(message, (answer) => {
          rl.close()
          resolve(answer)
        })
      })
  )
```

Next, we implement the main program to collect names:

```ts twoslash collapse={5-18}
import { Effect, Chunk, Ref } from "effect"
import * as NodeReadLine from "node:readline"

// Utility to read user input
const readLine = (message: string): Effect.Effect<string> =>
  Effect.promise(
    () =>
      new Promise((resolve) => {
        const rl = NodeReadLine.createInterface({
          input: process.stdin,
          output: process.stdout
        })
        rl.question(message, (answer) => {
          rl.close()
          resolve(answer)
        })
      })
  )

const getNames = Effect.gen(function* () {
  const ref = yield* Ref.make(Chunk.empty<string>())
  while (true) {
    const name = yield* readLine("Please enter a name or `q` to exit: ")
    if (name === "q") {
      break
    }
    yield* Ref.update(ref, (state) => Chunk.append(state, name))
  }
  return yield* Ref.get(ref)
})

Effect.runPromise(getNames).then(console.log)
/*
Output:
Please enter a name or `q` to exit: Alice
Please enter a name or `q` to exit: Bob
Please enter a name or `q` to exit: q
{
  _id: "Chunk",
  values: [ "Alice", "Bob" ]
}
*/
```

Now that we have learned how to use the `Ref` data type, we can use it to manage the state concurrently.

For example, assume while we are reading from the console, we have another fiber that is trying to update the state from a different source.

Here, one fiber reads names from user input, while another fiber concurrently adds preset names at regular intervals:

```ts twoslash collapse={5-18}
import { Effect, Chunk, Ref, Fiber } from "effect"
import * as NodeReadLine from "node:readline"

// Utility to read user input
const readLine = (message: string): Effect.Effect<string> =>
  Effect.promise(
    () =>
      new Promise((resolve) => {
        const rl = NodeReadLine.createInterface({
          input: process.stdin,
          output: process.stdout
        })
        rl.question(message, (answer) => {
          rl.close()
          resolve(answer)
        })
      })
  )

const getNames = Effect.gen(function* () {
  const ref = yield* Ref.make(Chunk.empty<string>())

  // Fiber 1: Reading names from user input
  const fiber1 = yield* Effect.fork(
    Effect.gen(function* () {
      while (true) {
        const name = yield* readLine(
          "Please enter a name or `q` to exit: "
        )
        if (name === "q") {
          break
        }
        yield* Ref.update(ref, (state) => Chunk.append(state, name))
      }
    })
  )

  // Fiber 2: Updating the state with predefined names
  const fiber2 = yield* Effect.fork(
    Effect.gen(function* () {
      for (const name of ["John", "Jane", "Joe", "Tom"]) {
        yield* Ref.update(ref, (state) => Chunk.append(state, name))
        yield* Effect.sleep("1 second")
      }
    })
  )
  yield* Fiber.join(fiber1)
  yield* Fiber.join(fiber2)
  return yield* Ref.get(ref)
})

Effect.runPromise(getNames).then(console.log)
/*
Output:
Please enter a name or `q` to exit: Alice
Please enter a name or `q` to exit: Bob
Please enter a name or `q` to exit: q
{
  _id: "Chunk",
  // Note: the following result may vary
  // depending on the speed of user input
  values: [ 'John', 'Jane', 'Joe', 'Tom', 'Alice', 'Bob' ]
}
*/
```
