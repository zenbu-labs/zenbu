---
title: Retrying
description: Enhance resilience with Effect's retrying strategies, enabling robust handling of transient failures with customizable retry policies and fallback mechanisms.
sidebar:
  order: 5
---

import { Aside } from "@astrojs/starlight/components"

In software development, it's common to encounter situations where an operation may fail temporarily due to various factors such as network issues, resource unavailability, or external dependencies. In such cases, it's often desirable to retry the operation automatically, allowing it to succeed eventually.

Retrying is a powerful mechanism to handle transient failures and ensure the successful execution of critical operations. In Effect retrying is made simple and flexible with built-in functions and scheduling strategies.

In this guide, we will explore the concept of retrying in Effect and learn how to use the `retry` and `retryOrElse` functions to handle failure scenarios. We'll see how to define retry policies using schedules, which dictate when and how many times the operation should be retried.

Whether you're working on network requests, database interactions, or any other potentially error-prone operations, mastering the retrying capabilities of effect can significantly enhance the resilience and reliability of your applications.

## retry

The `Effect.retry` function takes an effect and a [Schedule](/docs/scheduling/introduction/) policy, and will automatically retry the effect if it fails, following the rules of the policy.

If the effect ultimately succeeds, the result will be returned.

If the maximum retries are exhausted and the effect still fails, the failure is propagated.

This can be useful when dealing with intermittent failures, such as network issues or temporary resource unavailability. By defining a retry policy, you can control the number of retries, the delay between them, and when to stop retrying.

**Example** (Retrying with a Fixed Delay)

```ts twoslash
import { Effect, Schedule } from "effect"

let count = 0

// Simulates an effect with possible failures
const task = Effect.async<string, Error>((resume) => {
  if (count <= 2) {
    count++
    console.log("failure")
    resume(Effect.fail(new Error()))
  } else {
    console.log("success")
    resume(Effect.succeed("yay!"))
  }
})

// Define a repetition policy using a fixed delay between retries
const policy = Schedule.fixed("100 millis")

const repeated = Effect.retry(task, policy)

Effect.runPromise(repeated).then(console.log)
/*
Output:
failure
failure
failure
success
yay!
*/
```

### Retrying n Times Immediately

You can also retry a failing effect a set number of times with a simpler policy that retries immediately:

**Example** (Retrying a Task up to 5 times)

```ts twoslash
import { Effect } from "effect"

let count = 0

// Simulates an effect with possible failures
const task = Effect.async<string, Error>((resume) => {
  if (count <= 2) {
    count++
    console.log("failure")
    resume(Effect.fail(new Error()))
  } else {
    console.log("success")
    resume(Effect.succeed("yay!"))
  }
})

// Retry the task up to 5 times
Effect.runPromise(Effect.retry(task, { times: 5 }))
/*
Output:
failure
failure
failure
success
*/
```

### Retrying Based on a Condition

You can customize how retries are managed by specifying conditions. Use the `until` or `while` options to control when retries stop.

**Example** (Retrying Until a Specific Condition is Met)

```ts twoslash
import { Effect } from "effect"

let count = 0

// Define an effect that simulates varying error on each invocation
const action = Effect.failSync(() => {
  console.log(`Action called ${++count} time(s)`)
  return `Error ${count}`
})

// Retry the action until a specific condition is met
const program = Effect.retry(action, {
  until: (err) => err === "Error 3"
})

Effect.runPromiseExit(program).then(console.log)
/*
Output:
Action called 1 time(s)
Action called 2 time(s)
Action called 3 time(s)
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'Error 3' }
}
*/
```

<Aside type="tip" title="Alternative">
  You can also use
  [Effect.repeat](/docs/scheduling/repetition/#repeating-based-on-a-condition)
  if your retry condition is based on successful outcomes rather than
  errors.
</Aside>

## retryOrElse

The `Effect.retryOrElse` function attempts to retry a failing effect multiple times according to a defined [Schedule](/docs/scheduling/introduction/) policy.

If the retries are exhausted and the effect still fails, it runs a fallback effect instead.

This function is useful when you want to handle failures gracefully by specifying an alternative action after repeated failures.

**Example** (Retrying with Fallback)

```ts twoslash
import { Effect, Schedule, Console } from "effect"

let count = 0

// Simulates an effect with possible failures
const task = Effect.async<string, Error>((resume) => {
  if (count <= 2) {
    count++
    console.log("failure")
    resume(Effect.fail(new Error()))
  } else {
    console.log("success")
    resume(Effect.succeed("yay!"))
  }
})

// Retry the task with a delay between retries and a maximum of 2 retries
const policy = Schedule.addDelay(Schedule.recurs(2), () => "100 millis")

// If all retries fail, run the fallback effect
const repeated = Effect.retryOrElse(
  task,
  policy,
  // fallback
  () => Console.log("orElse").pipe(Effect.as("default value"))
)

Effect.runPromise(repeated).then(console.log)
/*
Output:
failure
failure
failure
orElse
default value
*/
```
