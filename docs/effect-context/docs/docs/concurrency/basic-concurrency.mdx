---
title: Basic Concurrency
description: Manage and control effect execution with concurrency, interruptions, and racing.
sidebar:
  order: 0
---

import { Aside } from "@astrojs/starlight/components"

## Concurrency Options

Effect provides options to manage how effects are executed, particularly focusing on controlling how many effects run concurrently.

```ts showLineNumbers=false
type Options = {
  readonly concurrency?: Concurrency
}
```

The `concurrency` option is used to determine the level of concurrency, with the following values:

```ts showLineNumbers=false
type Concurrency = number | "unbounded" | "inherit"
```

Let's explore each configuration in detail.

<Aside type="tip" title="Applicability of Concurrency Options">
  The examples here use the `Effect.all` function, but these options apply
  to many other Effect APIs.
</Aside>

### Sequential Execution (Default)

By default, if you don't specify any concurrency option, effects will run sequentially, one after the other. This means each effect starts only after the previous one completes.

**Example** (Sequential Execution)

```ts twoslash
import { Effect, Duration } from "effect"

// Helper function to simulate a task with a delay
const makeTask = (n: number, delay: Duration.DurationInput) =>
  Effect.promise(
    () =>
      new Promise<void>((resolve) => {
        console.log(`start task${n}`) // Logs when the task starts
        setTimeout(() => {
          console.log(`task${n} done`) // Logs when the task finishes
          resolve()
        }, Duration.toMillis(delay))
      })
  )

const task1 = makeTask(1, "200 millis")
const task2 = makeTask(2, "100 millis")

const sequential = Effect.all([task1, task2])

Effect.runPromise(sequential)
/*
Output:
start task1
task1 done
start task2 <-- task2 starts only after task1 completes
task2 done
*/
```

### Numbered Concurrency

You can control how many effects run concurrently by setting a `number` for `concurrency`. For example, `concurrency: 2` allows up to two effects to run at the same time.

**Example** (Limiting to 2 Concurrent Tasks)

```ts twoslash
import { Effect, Duration } from "effect"

// Helper function to simulate a task with a delay
const makeTask = (n: number, delay: Duration.DurationInput) =>
  Effect.promise(
    () =>
      new Promise<void>((resolve) => {
        console.log(`start task${n}`) // Logs when the task starts
        setTimeout(() => {
          console.log(`task${n} done`) // Logs when the task finishes
          resolve()
        }, Duration.toMillis(delay))
      })
  )

const task1 = makeTask(1, "200 millis")
const task2 = makeTask(2, "100 millis")
const task3 = makeTask(3, "210 millis")
const task4 = makeTask(4, "110 millis")
const task5 = makeTask(5, "150 millis")

const numbered = Effect.all([task1, task2, task3, task4, task5], {
  concurrency: 2
})

Effect.runPromise(numbered)
/*
Output:
start task1
start task2 <-- active tasks: task1, task2
task2 done
start task3 <-- active tasks: task1, task3
task1 done
start task4 <-- active tasks: task3, task4
task4 done
start task5 <-- active tasks: task3, task5
task3 done
task5 done
*/
```

### Unbounded Concurrency

When `concurrency: "unbounded"` is used, there's no limit to the number of effects running concurrently.

**Example** (Unbounded Concurrency)

```ts twoslash
import { Effect, Duration } from "effect"

// Helper function to simulate a task with a delay
const makeTask = (n: number, delay: Duration.DurationInput) =>
  Effect.promise(
    () =>
      new Promise<void>((resolve) => {
        console.log(`start task${n}`) // Logs when the task starts
        setTimeout(() => {
          console.log(`task${n} done`) // Logs when the task finishes
          resolve()
        }, Duration.toMillis(delay))
      })
  )

const task1 = makeTask(1, "200 millis")
const task2 = makeTask(2, "100 millis")
const task3 = makeTask(3, "210 millis")
const task4 = makeTask(4, "110 millis")
const task5 = makeTask(5, "150 millis")

const unbounded = Effect.all([task1, task2, task3, task4, task5], {
  concurrency: "unbounded"
})

Effect.runPromise(unbounded)
/*
Output:
start task1
start task2
start task3
start task4
start task5
task2 done
task4 done
task5 done
task1 done
task3 done
*/
```

### Inherit Concurrency

When using `concurrency: "inherit"`, the concurrency level is inherited from the surrounding context. This context can be set using `Effect.withConcurrency(number | "unbounded")`. If no context is provided, the default is `"unbounded"`.

**Example** (Inheriting Concurrency from Context)

```ts twoslash
import { Effect, Duration } from "effect"

// Helper function to simulate a task with a delay
const makeTask = (n: number, delay: Duration.DurationInput) =>
  Effect.promise(
    () =>
      new Promise<void>((resolve) => {
        console.log(`start task${n}`) // Logs when the task starts
        setTimeout(() => {
          console.log(`task${n} done`) // Logs when the task finishes
          resolve()
        }, Duration.toMillis(delay))
      })
  )

const task1 = makeTask(1, "200 millis")
const task2 = makeTask(2, "100 millis")
const task3 = makeTask(3, "210 millis")
const task4 = makeTask(4, "110 millis")
const task5 = makeTask(5, "150 millis")

// Running all tasks with concurrency: "inherit",
// which defaults to "unbounded"
const inherit = Effect.all([task1, task2, task3, task4, task5], {
  concurrency: "inherit"
})

Effect.runPromise(inherit)
/*
Output:
start task1
start task2
start task3
start task4
start task5
task2 done
task4 done
task5 done
task1 done
task3 done
*/
```

If you use `Effect.withConcurrency`, the concurrency configuration will adjust to the specified option.

**Example** (Setting Concurrency Option)

```ts twoslash
import { Effect, Duration } from "effect"

// Helper function to simulate a task with a delay
const makeTask = (n: number, delay: Duration.DurationInput) =>
  Effect.promise(
    () =>
      new Promise<void>((resolve) => {
        console.log(`start task${n}`) // Logs when the task starts
        setTimeout(() => {
          console.log(`task${n} done`) // Logs when the task finishes
          resolve()
        }, Duration.toMillis(delay))
      })
  )

const task1 = makeTask(1, "200 millis")
const task2 = makeTask(2, "100 millis")
const task3 = makeTask(3, "210 millis")
const task4 = makeTask(4, "110 millis")
const task5 = makeTask(5, "150 millis")

// Running tasks with concurrency: "inherit",
// which will inherit the surrounding context
const inherit = Effect.all([task1, task2, task3, task4, task5], {
  concurrency: "inherit"
})

// Setting a concurrency limit of 2
const withConcurrency = inherit.pipe(Effect.withConcurrency(2))

Effect.runPromise(withConcurrency)
/*
Output:
start task1
start task2 <-- active tasks: task1, task2
task2 done
start task3 <-- active tasks: task1, task3
task1 done
start task4 <-- active tasks: task3, task4
task4 done
start task5 <-- active tasks: task3, task5
task3 done
task5 done
*/
```

## Interruptions

All effects in Effect are executed by [fibers](/docs/concurrency/fibers/). If you didn't create the fiber yourself, it was created by an operation you're using (if it's concurrent) or by the Effect [runtime](/docs/runtime/) system.

A fiber is created any time an effect is run. When running effects concurrently, a fiber is created for each concurrent effect.

To summarize:

- An `Effect` is a higher-level concept that describes an effectful computation. It is lazy and immutable, meaning it represents a computation that may produce a value or fail but does not immediately execute.
- A fiber, on the other hand, represents the running execution of an `Effect`. It can be interrupted or awaited to retrieve its result. Think of it as a way to control and interact with the ongoing computation.

Fibers can be interrupted in various ways. Let's explore some of these scenarios and see examples of how to interrupt fibers in Effect.

### interrupt

A fiber can be interrupted using the `Effect.interrupt` effect on that particular fiber.

This effect models the explicit interruption of the fiber in which it runs.
When executed, it causes the fiber to stop its operation immediately, capturing the interruption details such as the fiber's ID and its start time.
The resulting interruption can be observed in the [Exit](/docs/data-types/exit/) type if the effect is run with functions like [runPromiseExit](/docs/getting-started/running-effects/#runpromiseexit).

**Example** (Without Interruption)

In this case, the program runs without any interruption, logging the start and completion of the task.

```ts twoslash
import { Effect } from "effect"

const program = Effect.gen(function* () {
  console.log("start")
  yield* Effect.sleep("2 seconds")
  console.log("done")
  return "some result"
})

Effect.runPromiseExit(program).then(console.log)
/*
Output:
start
done
{ _id: 'Exit', _tag: 'Success', value: 'some result' }
*/
```

**Example** (With Interruption)

Here, the fiber is interrupted after the log `"start"` but before the `"done"` log. The `Effect.interrupt` stops the fiber, and it never reaches the final log.

```ts {6} twoslash
import { Effect } from "effect"

const program = Effect.gen(function* () {
  console.log("start")
  yield* Effect.sleep("2 seconds")
  yield* Effect.interrupt
  console.log("done")
  return "some result"
})

Effect.runPromiseExit(program).then(console.log)
/*
Output:
start
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

### onInterrupt

Registers a cleanup effect to run when an effect is interrupted.

This function allows you to specify an effect to run when the fiber is interrupted. This effect will be executed
when the fiber is interrupted, allowing you to perform cleanup or other actions.

**Example** (Running a Cleanup Action on Interruption)

In this example, we set up a handler that logs "Cleanup completed" whenever the fiber is interrupted. We then show three cases: a successful effect, a failing effect, and an interrupted effect, demonstrating how the handler is triggered depending on how the effect ends.

```ts twoslash
import { Console, Effect } from "effect"

// This handler is executed when the fiber is interrupted
const handler = Effect.onInterrupt((_fibers) =>
  Console.log("Cleanup completed")
)

const success = Console.log("Task completed").pipe(
  Effect.as("some result"),
  handler
)

Effect.runFork(success)
/*
Output:
Task completed
*/

const failure = Console.log("Task failed").pipe(
  Effect.andThen(Effect.fail("some error")),
  handler
)

Effect.runFork(failure)
/*
Output:
Task failed
*/

const interruption = Console.log("Task interrupted").pipe(
  Effect.andThen(Effect.interrupt),
  handler
)

Effect.runFork(interruption)
/*
Output:
Task interrupted
Cleanup completed
*/
```

### Interruption of Concurrent Effects

When running multiple effects concurrently, such as with `Effect.forEach`, if one of the effects is interrupted, it causes all concurrent effects to be interrupted as well.

The resulting [cause](/docs/data-types/cause/) includes information about which fibers were interrupted.

**Example** (Interrupting Concurrent Effects)

```ts twoslash
import { Effect, Console } from "effect"

const program = Effect.forEach(
  [1, 2, 3],
  (n) =>
    Effect.gen(function* () {
      console.log(`start #${n}`)
      yield* Effect.sleep(`${n} seconds`)
      if (n > 1) {
        yield* Effect.interrupt
      }
      console.log(`done #${n}`)
    }).pipe(Effect.onInterrupt(() => Console.log(`interrupted #${n}`))),
  { concurrency: "unbounded" }
)

Effect.runPromiseExit(program).then((exit) =>
  console.log(JSON.stringify(exit, null, 2))
)
/*
Output:
start #1
start #2
start #3
done #1
interrupted #2
interrupted #3
{
  "_id": "Exit",
  "_tag": "Failure",
  "cause": {
    "_id": "Cause",
    "_tag": "Parallel",
    "left": {
      "_id": "Cause",
      "_tag": "Interrupt",
      "fiberId": {
        "_id": "FiberId",
        "_tag": "Runtime",
        "id": 3,
        "startTimeMillis": ...
      }
    },
    "right": {
      "_id": "Cause",
      "_tag": "Sequential",
      "left": {
        "_id": "Cause",
        "_tag": "Empty"
      },
      "right": {
        "_id": "Cause",
        "_tag": "Interrupt",
        "fiberId": {
          "_id": "FiberId",
          "_tag": "Runtime",
          "id": 0,
          "startTimeMillis": ...
        }
      }
    }
  }
}
*/
```

## Racing

### race

This function takes two effects and runs them concurrently. The first effect
that successfully completes will determine the result of the race, and the
other effect will be interrupted.

If neither effect succeeds, the function will fail with a [cause](/docs/data-types/cause/) containing all the errors.

This is useful when you want to run two effects concurrently, but only care
about the first one to succeed. It is commonly used in cases like timeouts,
retries, or when you want to optimize for the faster response without
worrying about the other effect.

**Example** (Both Tasks Succeed)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.succeed("task1").pipe(
  Effect.delay("200 millis"),
  Effect.tap(Console.log("task1 done")),
  Effect.onInterrupt(() => Console.log("task1 interrupted"))
)
const task2 = Effect.succeed("task2").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Console.log("task2 done")),
  Effect.onInterrupt(() => Console.log("task2 interrupted"))
)

const program = Effect.race(task1, task2)

Effect.runFork(program)
/*
Output:
task2 done
task1 interrupted
*/
```

**Example** (One Task Fails, One Succeeds)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.fail("task1").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Console.log("task1 done")),
  Effect.onInterrupt(() => Console.log("task1 interrupted"))
)
const task2 = Effect.succeed("task2").pipe(
  Effect.delay("200 millis"),
  Effect.tap(Console.log("task2 done")),
  Effect.onInterrupt(() => Console.log("task2 interrupted"))
)

const program = Effect.race(task1, task2)

Effect.runFork(program)
/*
Output:
task2 done
*/
```

**Example** (Both Tasks Fail)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.fail("task1").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Console.log("task1 done")),
  Effect.onInterrupt(() => Console.log("task1 interrupted"))
)
const task2 = Effect.fail("task2").pipe(
  Effect.delay("200 millis"),
  Effect.tap(Console.log("task2 done")),
  Effect.onInterrupt(() => Console.log("task2 interrupted"))
)

const program = Effect.race(task1, task2)

Effect.runPromiseExit(program).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Parallel',
    left: { _id: 'Cause', _tag: 'Fail', failure: 'task1' },
    right: { _id: 'Cause', _tag: 'Fail', failure: 'task2' }
  }
}
*/
```

If you want to handle the result of whichever task completes first, whether it succeeds or fails, you can use the `Effect.either` function. This function wraps the result in an [Either](/docs/data-types/either/) type, allowing you to see if the result was a success (`Right`) or a failure (`Left`):

**Example** (Handling Success or Failure with Either)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.fail("task1").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Console.log("task1 done")),
  Effect.onInterrupt(() => Console.log("task1 interrupted"))
)
const task2 = Effect.succeed("task2").pipe(
  Effect.delay("200 millis"),
  Effect.tap(Console.log("task2 done")),
  Effect.onInterrupt(() => Console.log("task2 interrupted"))
)

// Run both tasks concurrently, wrapping the result
// in Either to capture success or failure
const program = Effect.race(Effect.either(task1), Effect.either(task2))

Effect.runPromise(program).then(console.log)
/*
Output:
task2 interrupted
{ _id: 'Either', _tag: 'Left', left: 'task1' }
*/
```

### raceAll

This function runs multiple effects concurrently and returns the result of the first one to succeed. If one effect succeeds, the others will be interrupted.

If none of the effects succeed, the function will fail with the last error encountered.

This is useful when you want to race multiple effects, but only care
about the first one to succeed. It is commonly used in cases like timeouts,
retries, or when you want to optimize for the faster response without
worrying about the other effects.

**Example** (All Tasks Succeed)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.succeed("task1").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Console.log("task1 done")),
  Effect.onInterrupt(() => Console.log("task1 interrupted"))
)
const task2 = Effect.succeed("task2").pipe(
  Effect.delay("200 millis"),
  Effect.tap(Console.log("task2 done")),
  Effect.onInterrupt(() => Console.log("task2 interrupted"))
)

const task3 = Effect.succeed("task3").pipe(
  Effect.delay("150 millis"),
  Effect.tap(Console.log("task3 done")),
  Effect.onInterrupt(() => Console.log("task3 interrupted"))
)

const program = Effect.raceAll([task1, task2, task3])

Effect.runFork(program)
/*
Output:
task1 done
task2 interrupted
task3 interrupted
*/
```

**Example** (One Task Fails, Two Tasks Succeed)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.fail("task1").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Console.log("task1 done")),
  Effect.onInterrupt(() => Console.log("task1 interrupted"))
)
const task2 = Effect.succeed("task2").pipe(
  Effect.delay("200 millis"),
  Effect.tap(Console.log("task2 done")),
  Effect.onInterrupt(() => Console.log("task2 interrupted"))
)

const task3 = Effect.succeed("task3").pipe(
  Effect.delay("150 millis"),
  Effect.tap(Console.log("task3 done")),
  Effect.onInterrupt(() => Console.log("task3 interrupted"))
)

const program = Effect.raceAll([task1, task2, task3])

Effect.runFork(program)
/*
Output:
task3 done
task2 interrupted
*/
```

**Example** (All Tasks Fail)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.fail("task1").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Console.log("task1 done")),
  Effect.onInterrupt(() => Console.log("task1 interrupted"))
)
const task2 = Effect.fail("task2").pipe(
  Effect.delay("200 millis"),
  Effect.tap(Console.log("task2 done")),
  Effect.onInterrupt(() => Console.log("task2 interrupted"))
)

const task3 = Effect.fail("task3").pipe(
  Effect.delay("150 millis"),
  Effect.tap(Console.log("task3 done")),
  Effect.onInterrupt(() => Console.log("task3 interrupted"))
)

const program = Effect.raceAll([task1, task2, task3])

Effect.runPromiseExit(program).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'task2' }
}
*/
```

### raceFirst

This function takes two effects and runs them concurrently, returning the
result of the first one that completes, regardless of whether it succeeds or
fails.

This function is useful when you want to race two operations, and you want to
proceed with whichever one finishes first, regardless of whether it succeeds
or fails.

**Example** (Both Tasks Succeed)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.succeed("task1").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Console.log("task1 done")),
  Effect.onInterrupt(() =>
    Console.log("task1 interrupted").pipe(Effect.delay("100 millis"))
  )
)
const task2 = Effect.succeed("task2").pipe(
  Effect.delay("200 millis"),
  Effect.tap(Console.log("task2 done")),
  Effect.onInterrupt(() =>
    Console.log("task2 interrupted").pipe(Effect.delay("100 millis"))
  )
)

const program = Effect.raceFirst(task1, task2).pipe(
  Effect.tap(Console.log("more work..."))
)

Effect.runPromiseExit(program).then(console.log)
/*
Output:
task1 done
task2 interrupted
more work...
{ _id: 'Exit', _tag: 'Success', value: 'task1' }
*/
```

**Example** (One Task Fails, One Succeeds)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.fail("task1").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Console.log("task1 done")),
  Effect.onInterrupt(() =>
    Console.log("task1 interrupted").pipe(Effect.delay("100 millis"))
  )
)
const task2 = Effect.succeed("task2").pipe(
  Effect.delay("200 millis"),
  Effect.tap(Console.log("task2 done")),
  Effect.onInterrupt(() =>
    Console.log("task2 interrupted").pipe(Effect.delay("100 millis"))
  )
)

const program = Effect.raceFirst(task1, task2).pipe(
  Effect.tap(Console.log("more work..."))
)

Effect.runPromiseExit(program).then(console.log)
/*
Output:
task2 interrupted
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'task1' }
}
*/
```

#### Disconnecting Effects

The `Effect.raceFirst` function safely interrupts the "loser" effect once the other completes, but it will not resume until the loser is cleanly terminated.

If you want a quicker return, you can disconnect the interrupt signal for both effects. Instead of calling:

```ts showLineNumbers=false
Effect.raceFirst(task1, task2)
```

You can use:

```ts showLineNumbers=false
Effect.raceFirst(Effect.disconnect(task1), Effect.disconnect(task2))
```

This allows both effects to complete independently while still terminating the losing effect in the background.

**Example** (Using `Effect.disconnect` for Quicker Return)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.succeed("task1").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Console.log("task1 done")),
  Effect.onInterrupt(() =>
    Console.log("task1 interrupted").pipe(Effect.delay("100 millis"))
  )
)
const task2 = Effect.succeed("task2").pipe(
  Effect.delay("200 millis"),
  Effect.tap(Console.log("task2 done")),
  Effect.onInterrupt(() =>
    Console.log("task2 interrupted").pipe(Effect.delay("100 millis"))
  )
)

// Race the two tasks with disconnect to allow quicker return
const program = Effect.raceFirst(
  Effect.disconnect(task1),
  Effect.disconnect(task2)
).pipe(Effect.tap(Console.log("more work...")))

Effect.runPromiseExit(program).then(console.log)
/*
Output:
task1 done
more work...
{ _id: 'Exit', _tag: 'Success', value: 'task1' }
task2 interrupted
*/
```

### raceWith

This function runs two effects concurrently and calls a specified "finisher" function once one of the effects completes, regardless of whether it succeeds or fails.

The finisher functions for each effect allow you to handle the results of each effect as soon as they complete.

The function takes two finisher callbacks, one for each effect, and allows you to specify how to handle the result of the race.

This function is useful when you need to react to the completion of either effect without waiting for both to finish. It can be used whenever you want to take action based on the first available result.

**Example** (Handling Results of Concurrent Tasks)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.succeed("task1").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Console.log("task1 done")),
  Effect.onInterrupt(() =>
    Console.log("task1 interrupted").pipe(Effect.delay("100 millis"))
  )
)
const task2 = Effect.succeed("task2").pipe(
  Effect.delay("200 millis"),
  Effect.tap(Console.log("task2 done")),
  Effect.onInterrupt(() =>
    Console.log("task2 interrupted").pipe(Effect.delay("100 millis"))
  )
)

const program = Effect.raceWith(task1, task2, {
  onSelfDone: (exit) => Console.log(`task1 exited with ${exit}`),
  onOtherDone: (exit) => Console.log(`task2 exited with ${exit}`)
})

Effect.runFork(program)
/*
Output:
task1 done
task1 exited with {
  "_id": "Exit",
  "_tag": "Success",
  "value": "task1"
}
task2 interrupted
*/
```
