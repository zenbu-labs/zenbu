---
title: Parallel and Sequential Errors
description: Handle concurrent and sequential errors in Effect programs, capturing multiple failures and ensuring robust error management in concurrent and sequential workflows.
sidebar:
  order: 10
---

import { Aside } from "@astrojs/starlight/components"

When working with Effect, if an error occurs, the default behavior is to fail with the first error encountered.

**Example** (Failing on the First Error)

Here, the program fails with the first error it encounters, `"Oh uh!"`.

```ts twoslash
import { Effect } from "effect"

const fail = Effect.fail("Oh uh!")
const die = Effect.dieMessage("Boom!")

// Run both effects sequentially
const program = Effect.all([fail, die])

Effect.runPromiseExit(program).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'Oh uh!' }
}
*/
```

## Parallel Errors

In some cases, you might encounter multiple errors, especially during concurrent computations. When tasks are run concurrently, multiple errors can happen at the same time.

**Example** (Handling Multiple Errors in Concurrent Computations)

In this example, both the `fail` and `die` effects are executed concurrently. Since both fail, the program will report multiple errors in the output.

```ts twoslash
import { Effect } from "effect"

const fail = Effect.fail("Oh uh!")
const die = Effect.dieMessage("Boom!")

// Run both effects concurrently
const program = Effect.all([fail, die], {
  concurrency: "unbounded"
}).pipe(Effect.asVoid)

Effect.runPromiseExit(program).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Parallel',
    left: { _id: 'Cause', _tag: 'Fail', failure: 'Oh uh!' },
    right: { _id: 'Cause', _tag: 'Die', defect: [Object] }
  }
}
*/
```

### parallelErrors

Effect provides a function called `Effect.parallelErrors` that captures all failure errors from concurrent operations in the error channel.

**Example** (Capturing Multiple Concurrent Failures)

In this example, `Effect.parallelErrors` combines the errors from `fail1` and `fail2` into a single error.

```ts twoslash
import { Effect } from "effect"

const fail1 = Effect.fail("Oh uh!")
const fail2 = Effect.fail("Oh no!")
const die = Effect.dieMessage("Boom!")

// Run all effects concurrently and capture all errors
const program = Effect.all([fail1, fail2, die], {
  concurrency: "unbounded"
}).pipe(Effect.asVoid, Effect.parallelErrors)

Effect.runPromiseExit(program).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: [ 'Oh uh!', 'Oh no!' ] }
}
*/
```

<Aside type="note" title="Applicability">
  Note that `Effect.parallelErrors` is only for failures, not defects or
  interruptions.
</Aside>

## Sequential Errors

When working with resource-safety operators like `Effect.ensuring`, you may encounter multiple sequential errors.
This happens because regardless of whether the original effect has any errors or not, the finalizer is uninterruptible and will always run.

**Example** (Handling Multiple Sequential Errors)

In this example, both `fail` and the finalizer `die` result in sequential errors, and both are captured.

```ts twoslash
import { Effect } from "effect"

// Simulate an effect that fails
const fail = Effect.fail("Oh uh!")

// Simulate a finalizer that causes a defect
const die = Effect.dieMessage("Boom!")

// The finalizer 'die' will always run, even if 'fail' fails
const program = fail.pipe(Effect.ensuring(die))

Effect.runPromiseExit(program).then(console.log)
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Sequential',
    left: { _id: 'Cause', _tag: 'Fail', failure: 'Oh uh!' },
    right: { _id: 'Cause', _tag: 'Die', defect: [Object] }
  }
}
*/
```
