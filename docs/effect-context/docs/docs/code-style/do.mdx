---
title: Simplifying Excessive Nesting
description: Simplify nested code with Do simulation and generators.
sidebar:
  label: Excessive Nesting
  order: 5
---

import { Steps } from "@astrojs/starlight/components"

Suppose you want to create a custom function `elapsed` that prints the elapsed time taken by an effect to execute.

## Using plain pipe

Initially, you may come up with code that uses the standard `pipe` [method](/docs/getting-started/building-pipelines/#the-pipe-method), but this approach can lead to excessive nesting and result in verbose and hard-to-read code:

**Example** (Measuring Elapsed Time with `pipe`)

```ts twoslash
import { Effect, Console } from "effect"

// Get the current timestamp
const now = Effect.sync(() => new Date().getTime())

// Prints the elapsed time occurred to `self` to execute
const elapsed = <R, E, A>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  now.pipe(
    Effect.andThen((startMillis) =>
      self.pipe(
        Effect.andThen((result) =>
          now.pipe(
            Effect.andThen((endMillis) => {
              // Calculate the elapsed time in milliseconds
              const elapsed = endMillis - startMillis
              // Log the elapsed time
              return Console.log(`Elapsed: ${elapsed}`).pipe(
                Effect.map(() => result)
              )
            })
          )
        )
      )
    )
  )

// Simulates a successful computation with a delay of 200 milliseconds
const task = Effect.succeed("some task").pipe(Effect.delay("200 millis"))

const program = elapsed(task)

Effect.runPromise(program).then(console.log)
/*
Output:
Elapsed: 204
some task
*/
```

To address this issue and make the code more manageable, there is a solution: the "do simulation."

## Using the "do simulation"

The "do simulation" in Effect allows you to write code in a more declarative style, similar to the "do notation" in other programming languages. It provides a way to define variables and perform operations on them using functions like `Effect.bind` and `Effect.let`.

Here's how the do simulation works:

<Steps>

1. Start the do simulation using the `Effect.Do` value:

   ```ts showLineNumbers=false
   const program = Effect.Do.pipe(/* ... rest of the code */)
   ```

2. Within the do simulation scope, you can use the `Effect.bind` function to define variables and bind them to `Effect` values:

   ```ts showLineNumbers=false
   Effect.bind("variableName", (scope) => effectValue)
   ```

   - `variableName` is the name you choose for the variable you want to define. It must be unique within the scope.
   - `effectValue` is the `Effect` value that you want to bind to the variable. It can be the result of a function call or any other valid `Effect` value.

3. You can accumulate multiple `Effect.bind` statements to define multiple variables within the scope:

   ```ts showLineNumbers=false
   Effect.bind("variable1", () => effectValue1),
   Effect.bind("variable2", ({ variable1 }) => effectValue2),
   // ... additional bind statements
   ```

4. Inside the do simulation scope, you can also use the `Effect.let` function to define variables and bind them to simple values:

   ```ts showLineNumbers=false
   Effect.let("variableName", (scope) => simpleValue)
   ```

   - `variableName` is the name you give to the variable. Like before, it must be unique within the scope.
   - `simpleValue` is the value you want to assign to the variable. It can be a simple value like a `number`, `string`, or `boolean`.

5. Regular Effect functions like `Effect.andThen`, `Effect.flatMap`, `Effect.tap`, and `Effect.map` can still be used within the do simulation. These functions will receive the accumulated variables as arguments within the scope:

   ```ts showLineNumbers=false
   Effect.andThen(({ variable1, variable2 }) => {
     // Perform operations using variable1 and variable2
     // Return an `Effect` value as the result
   })
   ```

</Steps>

With the do simulation, you can rewrite the `elapsed` function like this:

**Example** (Using Do Simulation to Measure Elapsed Time)

```ts twoslash
import { Effect, Console } from "effect"

// Get the current timestamp
const now = Effect.sync(() => new Date().getTime())

const elapsed = <R, E, A>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.Do.pipe(
    Effect.bind("startMillis", () => now),
    Effect.bind("result", () => self),
    Effect.bind("endMillis", () => now),
    Effect.let(
      "elapsed",
      // Calculate the elapsed time in milliseconds
      ({ startMillis, endMillis }) => endMillis - startMillis
    ),
    // Log the elapsed time
    Effect.tap(({ elapsed }) => Console.log(`Elapsed: ${elapsed}`)),
    Effect.map(({ result }) => result)
  )

// Simulates a successful computation with a delay of 200 milliseconds
const task = Effect.succeed("some task").pipe(Effect.delay("200 millis"))

const program = elapsed(task)

Effect.runPromise(program).then(console.log)
/*
Output:
Elapsed: 204
some task
*/
```

## Using Effect.gen

The most concise and convenient solution is to use [Effect.gen](/docs/getting-started/using-generators/), which allows you to work with [generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator) when dealing with effects. This approach leverages the native scope provided by the generator syntax, avoiding excessive nesting and leading to more concise code.

**Example** (Using Effect.gen to Measure Elapsed Time)

```ts twoslash
import { Effect } from "effect"

// Get the current timestamp
const now = Effect.sync(() => new Date().getTime())

// Prints the elapsed time occurred to `self` to execute
const elapsed = <R, E, A>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const startMillis = yield* now
    const result = yield* self
    const endMillis = yield* now
    // Calculate the elapsed time in milliseconds
    const elapsed = endMillis - startMillis
    // Log the elapsed time
    console.log(`Elapsed: ${elapsed}`)
    return result
  })

// Simulates a successful computation with a delay of 200 milliseconds
const task = Effect.succeed("some task").pipe(Effect.delay("200 millis"))

const program = elapsed(task)

Effect.runPromise(program).then(console.log)
/*
Output:
Elapsed: 204
some task
*/
```

Within the generator, we use `yield*` to invoke effects and bind their results to variables. This eliminates the nesting and provides a more readable and sequential code structure.

The generator style in Effect uses a more linear and sequential flow of execution, resembling traditional imperative programming languages. This makes the code easier to read and understand, especially for developers who are more familiar with imperative programming paradigms.
