---
title: SynchronizedRef
description: Master concurrent state management with SynchronizedRef in Effect, a mutable reference that supports atomic, effectful updates to shared state in concurrent environments.
sidebar:
  order: 1
---

import { Aside } from "@astrojs/starlight/components"

`SynchronizedRef<A>` serves as a mutable reference to a value of type `A`.
With it, we can store **immutable** data and perform updates **atomically** and effectfully.

<Aside type="tip" title="Learn Ref First">
  Most of the operations for `SynchronizedRef` are similar to those of
  `Ref`. If you're not already familiar with `Ref`, it's recommended to
  read about [the Ref concept](/docs/state-management/ref/) first.
</Aside>

The distinctive function in `SynchronizedRef` is `updateEffect`.
This function takes an effectful operation and executes it to modify the shared state.
This is the key feature setting `SynchronizedRef` apart from `Ref`.

In real-world applications, `SynchronizedRef` is useful when you need to execute effects, such as querying a database, and then update shared state based on the result. It ensures that updates happen sequentially, preserving consistency in concurrent environments.

**Example** (Concurrent Updates with `SynchronizedRef`)

In this example, we simulate fetching user ages concurrently and updating a shared state that stores the ages:

```ts twoslash
import { Effect, SynchronizedRef } from "effect"

// Simulated API to get user age
const getUserAge = (userId: number) =>
  Effect.succeed(userId * 10).pipe(Effect.delay(10 - userId))

const meanAge = Effect.gen(function* () {
  // Initialize a SynchronizedRef to hold an array of ages
  const ref = yield* SynchronizedRef.make<number[]>([])

  // Helper function to log state before each effect
  const log = <R, E, A>(label: string, effect: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const value = yield* SynchronizedRef.get(ref)
      yield* Effect.log(label, value)
      return yield* effect
    })

  const task = (id: number) =>
    log(
      `task ${id}`,
      SynchronizedRef.updateEffect(ref, (sumOfAges) =>
        Effect.gen(function* () {
          const age = yield* getUserAge(id)
          return sumOfAges.concat(age)
        })
      )
    )

  // Run tasks concurrently with a limit of 2 concurrent tasks
  yield* Effect.all([task(1), task(2), task(3), task(4)], {
    concurrency: 2
  })

  // Retrieve the updated value
  const value = yield* SynchronizedRef.get(ref)
  return value
})

Effect.runPromise(meanAge).then(console.log)
/*
Output:
timestamp=... level=INFO fiber=#2 message="task 1" message=[]
timestamp=... level=INFO fiber=#3 message="task 2" message=[]
timestamp=... level=INFO fiber=#2 message="task 3" message="[
  10
]"
timestamp=... level=INFO fiber=#3 message="task 4" message="[
  10,
  20
]"
[ 10, 20, 30, 40 ]
*/
```
