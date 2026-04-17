---
title: Supervisor
description: Effect's Supervisor manages fiber lifecycles, enabling tracking, monitoring, and controlling fibers' behavior within an application.
sidebar:
  order: 3
---

A `Supervisor<A>` is a utility for managing fibers in Effect, allowing you to track their lifecycle (creation and termination) and producing a value of type `A` that reflects this supervision. Supervisors are useful when you need insight into or control over the behavior of fibers within your application.

To create a supervisor, you can use the `Supervisor.track` function. This generates a new supervisor that keeps track of its child fibers, maintaining them in a set. This allows you to observe and monitor their status during execution.

You can supervise an effect by using the `Effect.supervised` function. This function takes a supervisor as an argument and returns an effect where all child fibers forked within it are supervised by the provided supervisor. This enables you to capture detailed information about these child fibers, such as their status, through the supervisor.

**Example** (Monitoring Fiber Count)

In this example, we'll periodically monitor the number of fibers running in the application using a supervisor. The program calculates a Fibonacci number, spawning multiple fibers in the process, while a separate monitor tracks the fiber count.

```ts twoslash
import { Effect, Supervisor, Schedule, Fiber, FiberStatus } from "effect"

// Main program that monitors fibers while calculating a Fibonacci number
const program = Effect.gen(function* () {
  // Create a supervisor to track child fibers
  const supervisor = yield* Supervisor.track

  // Start a Fibonacci calculation, supervised by the supervisor
  const fibFiber = yield* fib(20).pipe(
    Effect.supervised(supervisor),
    // Fork the Fibonacci effect into a fiber
    Effect.fork
  )

  // Define a schedule to periodically monitor the fiber count every 500ms
  const policy = Schedule.spaced("500 millis").pipe(
    Schedule.whileInputEffect((_) =>
      Fiber.status(fibFiber).pipe(
        // Continue while the Fibonacci fiber is not done
        Effect.andThen((status) => status !== FiberStatus.done)
      )
    )
  )

  // Start monitoring the fibers, using the supervisor to track the count
  const monitorFiber = yield* monitorFibers(supervisor).pipe(
    // Repeat the monitoring according to the schedule
    Effect.repeat(policy),
    // Fork the monitoring into its own fiber
    Effect.fork
  )

  // Join the monitor and Fibonacci fibers to ensure they complete
  yield* Fiber.join(monitorFiber)
  const result = yield* Fiber.join(fibFiber)

  console.log(`fibonacci result: ${result}`)
})

// Function to monitor and log the number of active fibers
const monitorFibers = (
  supervisor: Supervisor.Supervisor<Array<Fiber.RuntimeFiber<any, any>>>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const fibers = yield* supervisor.value // Get the current set of fibers
    console.log(`number of fibers: ${fibers.length}`)
  })

// Recursive Fibonacci calculation, spawning fibers for each recursive step
const fib = (n: number): Effect.Effect<number> =>
  Effect.gen(function* () {
    if (n <= 1) {
      return 1
    }
    yield* Effect.sleep("500 millis") // Simulate work by delaying

    // Fork two fibers for the recursive Fibonacci calls
    const fiber1 = yield* Effect.fork(fib(n - 2))
    const fiber2 = yield* Effect.fork(fib(n - 1))

    // Join the fibers to retrieve their results
    const v1 = yield* Fiber.join(fiber1)
    const v2 = yield* Fiber.join(fiber2)

    return v1 + v2 // Combine the results
  })

Effect.runPromise(program)
/*
Output:
number of fibers: 0
number of fibers: 2
number of fibers: 6
number of fibers: 14
number of fibers: 30
number of fibers: 62
number of fibers: 126
number of fibers: 254
number of fibers: 510
number of fibers: 1022
number of fibers: 2034
number of fibers: 3795
number of fibers: 5810
number of fibers: 6474
number of fibers: 4942
number of fibers: 2515
number of fibers: 832
number of fibers: 170
number of fibers: 18
number of fibers: 0
fibonacci result: 10946
*/
```
