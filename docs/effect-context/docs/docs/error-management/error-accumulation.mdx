---
title: Error Accumulation
description: Learn to manage errors effectively in Effect workflows with tools for sequential execution, error accumulation, and result partitioning.
sidebar:
  order: 8
---

import { Aside } from "@astrojs/starlight/components"

Sequential combinators such as [Effect.zip](/docs/getting-started/control-flow/#zip), [Effect.all](/docs/getting-started/control-flow/#all) and [Effect.forEach](/docs/getting-started/control-flow/#foreach) have a "fail fast" policy when it comes to error management. This means that they stop and return immediately when they encounter the first error.

Here's an example using `Effect.zip`, which stops at the first failure and only shows the first error:

**Example** (Fail Fast with `Effect.zip`)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Console.log("task1").pipe(Effect.as(1))
const task2 = Effect.fail("Oh uh!").pipe(Effect.as(2))
const task3 = Console.log("task2").pipe(Effect.as(3))
const task4 = Effect.fail("Oh no!").pipe(Effect.as(4))

const program = task1.pipe(
  Effect.zip(task2),
  Effect.zip(task3),
  Effect.zip(task4)
)

Effect.runPromise(program).then(console.log, console.error)
/*
Output:
task1
(FiberFailure) Error: Oh uh!
*/
```

The `Effect.forEach` function behaves similarly. It applies an effectful operation to each element in a collection, but will stop when it hits the first error:

**Example** (Fail Fast with `Effect.forEach`)

```ts twoslash
import { Effect, Console } from "effect"

const program = Effect.forEach([1, 2, 3, 4, 5], (n) => {
  if (n < 4) {
    return Console.log(`item ${n}`).pipe(Effect.as(n))
  } else {
    return Effect.fail(`${n} is not less that 4`)
  }
})

Effect.runPromise(program).then(console.log, console.error)
/*
Output:
item 1
item 2
item 3
(FiberFailure) Error: 4 is not less that 4
*/
```

However, there are cases where you may want to collect all errors rather than fail fast. In these situations, you can use functions that accumulate both successes and errors.

## validate

The `Effect.validate` function is similar to `Effect.zip`, but it continues combining effects even after encountering errors, accumulating both successes and failures.

**Example** (Validating and Collecting Errors)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Console.log("task1").pipe(Effect.as(1))
const task2 = Effect.fail("Oh uh!").pipe(Effect.as(2))
const task3 = Console.log("task2").pipe(Effect.as(3))
const task4 = Effect.fail("Oh no!").pipe(Effect.as(4))

const program = task1.pipe(
  Effect.validate(task2),
  Effect.validate(task3),
  Effect.validate(task4)
)

Effect.runPromiseExit(program).then(console.log)
/*
Output:
task1
task2
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Sequential',
    left: { _id: 'Cause', _tag: 'Fail', failure: 'Oh uh!' },
    right: { _id: 'Cause', _tag: 'Fail', failure: 'Oh no!' }
  }
}
*/
```

## validateAll

The `Effect.validateAll` function is similar to the `Effect.forEach` function. It transforms all elements of a collection using the provided effectful operation, but it collects all errors in the error channel, as well as the success values in the success channel.

```ts twoslash
import { Effect, Console } from "effect"

//      ┌─── Effect<number[], string[], never>
//      ▼
const program = Effect.validateAll([1, 2, 3, 4, 5], (n) => {
  if (n < 4) {
    return Console.log(`item ${n}`).pipe(Effect.as(n))
  } else {
    return Effect.fail(`${n} is not less that 4`)
  }
})

Effect.runPromiseExit(program).then(console.log)
/*
Output:
item 1
item 2
item 3
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Fail',
    failure: [ '4 is not less that 4', '5 is not less that 4' ]
  }
}
*/
```

<Aside type="caution" title="Loss of Successes">
  Note that this function is lossy, which means that if there are any
  errors, all successes will be lost. If you need to preserve both
  successes and failures, consider using [Effect.partition](#partition).
</Aside>

## validateFirst

The `Effect.validateFirst` function is similar to `Effect.validateAll` but it returns the first successful result, or all errors if none succeed.

**Example** (Returning the First Success)

```ts twoslash
import { Effect, Console } from "effect"

//      ┌─── Effect<number, string[], never>
//      ▼
const program = Effect.validateFirst([1, 2, 3, 4, 5], (n) => {
  if (n < 4) {
    return Effect.fail(`${n} is not less that 4`)
  } else {
    return Console.log(`item ${n}`).pipe(Effect.as(n))
  }
})

Effect.runPromise(program).then(console.log, console.error)
/*
Output:
item 4
4
*/
```

Notice that `Effect.validateFirst` returns a single `number` as the success type, rather than an array of results like `Effect.validateAll`.

## partition

The `Effect.partition` function processes an iterable and applies an effectful function to each element. It returns a tuple, where the first part contains all the failures, and the second part contains all the successes.

**Example** (Partitioning Successes and Failures)

```ts twoslash
import { Effect } from "effect"

//      ┌─── Effect<[string[], number[]], never, never>
//      ▼
const program = Effect.partition([0, 1, 2, 3, 4], (n) => {
  if (n % 2 === 0) {
    return Effect.succeed(n)
  } else {
    return Effect.fail(`${n} is not even`)
  }
})

Effect.runPromise(program).then(console.log, console.error)
/*
Output:
[ [ '1 is not even', '3 is not even' ], [ 0, 2, 4 ] ]
*/
```

This operator is an unexceptional effect, meaning the error channel type is `never`. Failures are collected without stopping the effect, so the entire operation completes and returns both errors and successes.
