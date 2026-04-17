---
title: Repetition
description: Explore repetition in Effect for executing actions multiple times with control over retries, failures, and conditions.
sidebar:
  order: 1
---

import { Aside } from "@astrojs/starlight/components"

Repetition is a common requirement when working with effects in software development. It allows us to perform an effect multiple times according to a specific repetition policy.

## repeat

The `Effect.repeat` function returns a new effect that repeats the given effect according to a specified schedule or until the first failure.

<Aside type="note" title="Initial Execution Included">
  The scheduled recurrences are in addition to the initial execution, so
  `Effect.repeat(action, Schedule.once)` executes `action` once initially,
  and if it succeeds, repeats it an additional time.
</Aside>

**Example** (Repeating a Successful Effect)

```ts twoslash
import { Effect, Schedule, Console } from "effect"

// Define an effect that logs a message to the console
const action = Console.log("success")

// Define a schedule that repeats the action 2 more times with a delay
const policy = Schedule.addDelay(Schedule.recurs(2), () => "100 millis")

// Repeat the action according to the schedule
const program = Effect.repeat(action, policy)

// Run the program and log the number of repetitions
Effect.runPromise(program).then((n) => console.log(`repetitions: ${n}`))
/*
Output:
success
success
success
repetitions: 2
*/
```

**Example** (Handling Failures in Repetition)

```ts twoslash
import { Effect, Schedule } from "effect"

let count = 0

// Define an async effect that simulates an action with potential failure
const action = Effect.async<string, string>((resume) => {
  if (count > 1) {
    console.log("failure")
    resume(Effect.fail("Uh oh!"))
  } else {
    count++
    console.log("success")
    resume(Effect.succeed("yay!"))
  }
})

// Define a schedule that repeats the action 2 more times with a delay
const policy = Schedule.addDelay(Schedule.recurs(2), () => "100 millis")

// Repeat the action according to the schedule
const program = Effect.repeat(action, policy)

// Run the program and observe the result on failure
Effect.runPromiseExit(program).then(console.log)
/*
Output:
success
success
failure
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'Uh oh!' }
}
*/
```

### Skipping First Execution

If you want to avoid the first execution and only run the action according to a schedule, you can use `Effect.schedule`. This allows the effect to skip the initial run and follow the defined repeat policy.

**Example** (Skipping First Execution)

```ts twoslash
import { Effect, Schedule, Console } from "effect"

const action = Console.log("success")

const policy = Schedule.addDelay(Schedule.recurs(2), () => "100 millis")

const program = Effect.schedule(action, policy)

Effect.runPromise(program).then((n) => console.log(`repetitions: ${n}`))
/*
Output:
success
success
repetitions: 2
*/
```

## repeatN

The `repeatN` function returns a new effect that repeats the specified effect a given number of times or until the first failure. The repeats are in addition to the initial execution, so `Effect.repeatN(action, 1)` executes `action` once initially and then repeats it one additional time if it succeeds.

**Example** (Repeating an Action Multiple Times)

```ts twoslash
import { Effect, Console } from "effect"

const action = Console.log("success")

// Repeat the action 2 additional times after the first execution
const program = Effect.repeatN(action, 2)

Effect.runPromise(program)
/*
Output:
success
success
success
*/
```

## repeatOrElse

The `repeatOrElse` function returns a new effect that repeats the specified effect according to the given schedule or until the first failure.
When a failure occurs, the failure value and schedule output are passed to a specified handler.
Scheduled recurrences are in addition to the initial execution, so `Effect.repeat(action, Schedule.once)` executes `action` once initially and then repeats it an additional time if it succeeds.

**Example** (Handling Failure During Repeats)

```ts twoslash
import { Effect, Schedule } from "effect"

let count = 0

// Define an async effect that simulates an action with possible failures
const action = Effect.async<string, string>((resume) => {
  if (count > 1) {
    console.log("failure")
    resume(Effect.fail("Uh oh!"))
  } else {
    count++
    console.log("success")
    resume(Effect.succeed("yay!"))
  }
})

// Define a schedule that repeats up to 2 times
// with a 100ms delay between attempts
const policy = Schedule.addDelay(Schedule.recurs(2), () => "100 millis")

// Provide a handler to run when failure occurs after the retries
const program = Effect.repeatOrElse(action, policy, () =>
  Effect.sync(() => {
    console.log("orElse")
    return count - 1
  })
)

Effect.runPromise(program).then((n) => console.log(`repetitions: ${n}`))
/*
Output:
success
success
failure
orElse
repetitions: 1
*/
```

## Repeating Based on a Condition

You can control the repetition of an effect by a condition using either a `while` or `until` option, allowing for dynamic control based on runtime outcomes.

**Example** (Repeating Until a Condition is Met)

```ts twoslash
import { Effect } from "effect"

let count = 0

// Define an effect that simulates varying outcomes on each invocation
const action = Effect.sync(() => {
  console.log(`Action called ${++count} time(s)`)
  return count
})

// Repeat the action until the count reaches 3
const program = Effect.repeat(action, { until: (n) => n === 3 })

Effect.runFork(program)
/*
Output:
Action called 1 time(s)
Action called 2 time(s)
Action called 3 time(s)
*/
```

<Aside type="tip" title="Retrying on Errors">
  You can use
  [Effect.retry](/docs/error-management/retrying/#retrying-based-on-a-condition)
  if you need to set conditions based on error occurrences rather than
  success outcomes.
</Aside>
