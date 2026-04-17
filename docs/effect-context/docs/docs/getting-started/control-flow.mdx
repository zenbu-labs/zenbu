---
title: Control Flow Operators
description: Learn to control execution flow in Effect programs using advanced constructs for conditional branching, iteration, and combining effects seamlessly.
sidebar:
  order: 11
---

Even though JavaScript provides built-in control flow structures, Effect offers additional control flow functions that are useful in Effect applications. In this section, we will introduce different ways to control the flow of execution.

## if Expression

When working with Effect values, we can use standard JavaScript if-then-else statements:

**Example** (Returning None for Invalid Weight)

Here we are using the [Option](/docs/data-types/option/) data type to represent the absence of a valid value.

```ts twoslash
import { Effect, Option } from "effect"

// Function to validate weight and return an Option
const validateWeightOption = (
  weight: number
): Effect.Effect<Option.Option<number>> => {
  if (weight >= 0) {
    // Return Some if the weight is valid
    return Effect.succeed(Option.some(weight))
  } else {
    // Return None if the weight is invalid
    return Effect.succeed(Option.none())
  }
}
```

**Example** (Returning Error for Invalid Weight)

You can also handle invalid inputs by using the error channel, which allows you to return an error when the input is invalid:

```ts twoslash
import { Effect } from "effect"

// Function to validate weight or fail with an error
const validateWeightOrFail = (
  weight: number
): Effect.Effect<number, string> => {
  if (weight >= 0) {
    // Return the weight if valid
    return Effect.succeed(weight)
  } else {
    // Fail with an error if invalid
    return Effect.fail(`negative input: ${weight}`)
  }
}
```

## Conditional Operators

### if

Executes one of two effects based on a condition evaluated by an effectful predicate.

Use `Effect.if` to run one of two effects depending on whether the predicate effect
evaluates to `true` or `false`. If the predicate is `true`, the `onTrue` effect
is executed. If it is `false`, the `onFalse` effect is executed instead.

**Example** (Simulating a Coin Flip)

In this example, we simulate a virtual coin flip using `Random.nextBoolean` to generate a random boolean value. If the value is `true`, the `onTrue` effect logs "Head". If the value is `false`, the `onFalse` effect logs "Tail".

```ts twoslash
import { Effect, Random, Console } from "effect"

const flipTheCoin = Effect.if(Random.nextBoolean, {
  onTrue: () => Console.log("Head"), // Runs if the predicate is true
  onFalse: () => Console.log("Tail") // Runs if the predicate is false
})

Effect.runFork(flipTheCoin)
```

### when

Conditionally executes an effect based on a boolean condition.

`Effect.when` allows you to conditionally execute an effect, similar to using
an `if (condition)` expression, but with the added benefit of handling
effects. If the condition is `true`, the effect is executed; otherwise, it
does nothing.

The result of the effect is wrapped in an `Option<A>` to indicate whether the
effect was executed. If the condition is `true`, the result of the effect is
wrapped in a `Some`. If the condition is `false`, the result is `None`,
representing that the effect was skipped.

**Example** (Conditional Effect Execution)

```ts twoslash
import { Effect, Option } from "effect"

const validateWeightOption = (
  weight: number
): Effect.Effect<Option.Option<number>> =>
  // Conditionally execute the effect if the weight is non-negative
  Effect.succeed(weight).pipe(Effect.when(() => weight >= 0))

// Run with a valid weight
Effect.runPromise(validateWeightOption(100)).then(console.log)
/*
Output:
{
  _id: "Option",
  _tag: "Some",
  value: 100
}
*/

// Run with an invalid weight
Effect.runPromise(validateWeightOption(-5)).then(console.log)
/*
Output:
{
  _id: "Option",
  _tag: "None"
}
*/
```

In this example, the [Option](/docs/data-types/option/) data type is used to represent the presence or absence of a valid value. If the condition evaluates to `true` (in this case, if the weight is non-negative), the effect is executed and wrapped in a `Some`. Otherwise, the result is `None`.

### whenEffect

Executes an effect conditionally, based on the result of another effect.

Use `Effect.whenEffect` when the condition to determine whether to execute the effect
depends on the outcome of another effect that produces a boolean value.
If the condition effect evaluates to `true`, the specified effect is executed.
If it evaluates to `false`, no effect is executed.

The result of the effect is wrapped in an `Option<A>` to indicate whether the
effect was executed. If the condition is `true`, the result of the effect is
wrapped in a `Some`. If the condition is `false`, the result is `None`,
representing that the effect was skipped.

**Example** (Using an Effect as a Condition)

The following function creates a random integer, but only if a randomly generated boolean is `true`.

```ts twoslash
import { Effect, Random } from "effect"

const randomIntOption = Random.nextInt.pipe(
  Effect.whenEffect(Random.nextBoolean)
)

console.log(Effect.runSync(randomIntOption))
/*
Example Output:
{ _id: 'Option', _tag: 'Some', value: 8609104974198840 }
*/
```

### unless / unlessEffect

The `Effect.unless` and `Effect.unlessEffect` functions are similar to the `when*` functions, but they are equivalent to the `if (!condition) expression` construct.

## Zipping

### zip

Combines two effects into a single effect, producing a tuple with the results of both effects.

The `Effect.zip` function executes the first effect (left) and then the second effect (right).
Once both effects succeed, their results are combined into a tuple.

**Example** (Combining Two Effects Sequentially)

```ts twoslash
import { Effect } from "effect"

const task1 = Effect.succeed(1).pipe(
  Effect.delay("200 millis"),
  Effect.tap(Effect.log("task1 done"))
)

const task2 = Effect.succeed("hello").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Effect.log("task2 done"))
)

// Combine the two effects together
//
//      ┌─── Effect<[number, string], never, never>
//      ▼
const program = Effect.zip(task1, task2)

Effect.runPromise(program).then(console.log)
/*
Output:
timestamp=... level=INFO fiber=#0 message="task1 done"
timestamp=... level=INFO fiber=#0 message="task2 done"
[ 1, 'hello' ]
*/
```

By default, the effects are run sequentially. To run them concurrently, use the `{ concurrent: true }` option.

**Example** (Combining Two Effects Concurrently)

```ts collapse={3-11} "{ concurrent: true }" "task2 done"
import { Effect } from "effect"

const task1 = Effect.succeed(1).pipe(
  Effect.delay("200 millis"),
  Effect.tap(Effect.log("task1 done"))
)

const task2 = Effect.succeed("hello").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Effect.log("task2 done"))
)

// Run both effects concurrently using the concurrent option
const program = Effect.zip(task1, task2, { concurrent: true })

Effect.runPromise(program).then(console.log)
/*
Output:
timestamp=... level=INFO fiber=#3 message="task2 done"
timestamp=... level=INFO fiber=#2 message="task1 done"
[ 1, 'hello' ]
*/
```

In this concurrent version, both effects run in parallel. `task2` completes first, but both tasks can be logged and processed as soon as they're done.

### zipWith

Combines two effects sequentially and applies a function to their results to produce a single value.

The `Effect.zipWith` function is similar to [Effect.zip](#zip), but instead of returning a tuple of results,
it applies a provided function to the results of the two effects, combining them into a single value.

By default, the effects are run sequentially. To run them concurrently, use the `{ concurrent: true }` option.

**Example** (Combining Effects with a Custom Function)

```ts twoslash
import { Effect } from "effect"

const task1 = Effect.succeed(1).pipe(
  Effect.delay("200 millis"),
  Effect.tap(Effect.log("task1 done"))
)
const task2 = Effect.succeed("hello").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Effect.log("task2 done"))
)

//      ┌─── Effect<number, never, never>
//      ▼
const task3 = Effect.zipWith(
  task1,
  task2,
  // Combines results into a single value
  (number, string) => number + string.length
)

Effect.runPromise(task3).then(console.log)
/*
Output:
timestamp=... level=INFO fiber=#3 message="task1 done"
timestamp=... level=INFO fiber=#2 message="task2 done"
6
*/
```

## Looping

### loop

The `Effect.loop` function allows you to repeatedly update a state using a `step` function until a condition defined by the `while` function becomes `false`. It collects the intermediate states in an array and returns them as the final result.

**Syntax**

```ts showLineNumbers=false
Effect.loop(initial, {
  while: (state) => boolean,
  step: (state) => state,
  body: (state) => Effect
})
```

This function is similar to a `while` loop in JavaScript, with the addition of effectful computations:

```ts showLineNumbers=false
let state = initial
const result = []

while (options.while(state)) {
  result.push(options.body(state)) // Perform the effectful operation
  state = options.step(state) // Update the state
}

return result
```

**Example** (Looping with Collected Results)

```ts twoslash
import { Effect } from "effect"

// A loop that runs 5 times, collecting each iteration's result
const result = Effect.loop(
  // Initial state
  1,
  {
    // Condition to continue looping
    while: (state) => state <= 5,
    // State update function
    step: (state) => state + 1,
    // Effect to be performed on each iteration
    body: (state) => Effect.succeed(state)
  }
)

Effect.runPromise(result).then(console.log)
// Output: [1, 2, 3, 4, 5]
```

In this example, the loop starts with the state `1` and continues until the state exceeds `5`. Each state is incremented by `1` and is collected into an array, which becomes the final result.

#### Discarding Intermediate Results

The `discard` option, when set to `true`, will discard the results of each effectful operation, returning `void` instead of an array.

**Example** (Loop with Discarded Results)

```ts twoslash "discard: true"
import { Effect, Console } from "effect"

const result = Effect.loop(
  // Initial state
  1,
  {
    // Condition to continue looping
    while: (state) => state <= 5,
    // State update function
    step: (state) => state + 1,
    // Effect to be performed on each iteration
    body: (state) => Console.log(`Currently at state ${state}`),
    // Discard intermediate results
    discard: true
  }
)

Effect.runPromise(result).then(console.log)
/*
Output:
Currently at state 1
Currently at state 2
Currently at state 3
Currently at state 4
Currently at state 5
undefined
*/
```

In this example, the loop performs a side effect of logging the current index on each iteration, but it discards all intermediate results. The final result is `undefined`.

### iterate

The `Effect.iterate` function lets you repeatedly update a state through an effectful operation. It runs the `body` effect to update the state in each iteration and continues as long as the `while` condition evaluates to `true`.

**Syntax**

```ts showLineNumbers=false
Effect.iterate(initial, {
  while: (result) => boolean,
  body: (result) => Effect
})
```

This function is similar to a `while` loop in JavaScript, with the addition of effectful computations:

```ts showLineNumbers=false
let result = initial

while (options.while(result)) {
  result = options.body(result)
}

return result
```

**Example** (Effectful Iteration)

```ts twoslash
import { Effect } from "effect"

const result = Effect.iterate(
  // Initial result
  1,
  {
    // Condition to continue iterating
    while: (result) => result <= 5,
    // Operation to change the result
    body: (result) => Effect.succeed(result + 1)
  }
)

Effect.runPromise(result).then(console.log)
// Output: 6
```

### forEach

Executes an effectful operation for each element in an `Iterable`.

The `Effect.forEach` function applies a provided operation to each element in the
iterable, producing a new effect that returns an array of results.
If any effect fails, the iteration stops immediately (short-circuiting), and
the error is propagated.

The `concurrency` option controls how many operations are performed
concurrently. By default, the operations are performed sequentially.

**Example** (Applying Effects to Iterable Elements)

```ts twoslash
import { Effect, Console } from "effect"

const result = Effect.forEach([1, 2, 3, 4, 5], (n, index) =>
  Console.log(`Currently at index ${index}`).pipe(Effect.as(n * 2))
)

Effect.runPromise(result).then(console.log)
/*
Output:
Currently at index 0
Currently at index 1
Currently at index 2
Currently at index 3
Currently at index 4
[ 2, 4, 6, 8, 10 ]
*/
```

In this example, we iterate over the array `[1, 2, 3, 4, 5]`, applying an effect that logs the current index. The `Effect.as(n * 2)` operation transforms each value, resulting in an array `[2, 4, 6, 8, 10]`. The final output is the result of collecting all the transformed values.

#### Discarding Results

The `discard` option, when set to `true`, will discard the results of each effectful operation, returning `void` instead of an array.

**Example** (Using `discard` to Ignore Results)

```ts twoslash "{ discard: true }"
import { Effect, Console } from "effect"

// Apply effects but discard the results
const result = Effect.forEach(
  [1, 2, 3, 4, 5],
  (n, index) =>
    Console.log(`Currently at index ${index}`).pipe(Effect.as(n * 2)),
  { discard: true }
)

Effect.runPromise(result).then(console.log)
/*
Output:
Currently at index 0
Currently at index 1
Currently at index 2
Currently at index 3
Currently at index 4
undefined
*/
```

In this case, the effects still run for each element, but the results are discarded, so the final output is `undefined`.

## Collecting

### all

Combines multiple effects into one, returning results based on the input structure.

Use `Effect.all` when you need to run multiple effects and combine their results into a single output. It supports tuples, iterables, structs, and records, making it flexible for different input types.

If any effect fails, it stops execution (short-circuiting) and propagates the error. To change this behavior, you can use the [`mode`](#the-mode-option) option, which allows all effects to run and collect results as [Either](/docs/data-types/either/) or [Option](/docs/data-types/option/).

You can control the execution order (e.g., sequential vs. concurrent) using the [Concurrency Options](/docs/concurrency/basic-concurrency/#concurrency-options).

For instance, if the input is a tuple:

```ts showLineNumbers=false
//         ┌─── a tuple of effects
//         ▼
Effect.all([effect1, effect2, ...])
```

the effects are executed sequentially, and the result is a new effect containing the results as a tuple. The results in the tuple match the order of the effects passed to `Effect.all`.

Let's explore examples for different types of structures: tuples, iterables, objects, and records.

**Example** (Combining Effects in Tuples)

```ts twoslash
import { Effect, Console } from "effect"

const tupleOfEffects = [
  Effect.succeed(42).pipe(Effect.tap(Console.log)),
  Effect.succeed("Hello").pipe(Effect.tap(Console.log))
] as const

//      ┌─── Effect<[number, string], never, never>
//      ▼
const resultsAsTuple = Effect.all(tupleOfEffects)

Effect.runPromise(resultsAsTuple).then(console.log)
/*
Output:
42
Hello
[ 42, 'Hello' ]
*/
```

**Example** (Combining Effects in Iterables)

```ts twoslash
import { Effect, Console } from "effect"

const iterableOfEffects: Iterable<Effect.Effect<number>> = [1, 2, 3].map(
  (n) => Effect.succeed(n).pipe(Effect.tap(Console.log))
)

//      ┌─── Effect<number[], never, never>
//      ▼
const resultsAsArray = Effect.all(iterableOfEffects)

Effect.runPromise(resultsAsArray).then(console.log)
/*
Output:
1
2
3
[ 1, 2, 3 ]
*/
```

**Example** (Combining Effects in Structs)

```ts twoslash
import { Effect, Console } from "effect"

const structOfEffects = {
  a: Effect.succeed(42).pipe(Effect.tap(Console.log)),
  b: Effect.succeed("Hello").pipe(Effect.tap(Console.log))
}

//      ┌─── Effect<{ a: number; b: string; }, never, never>
//      ▼
const resultsAsStruct = Effect.all(structOfEffects)

Effect.runPromise(resultsAsStruct).then(console.log)
/*
Output:
42
Hello
{ a: 42, b: 'Hello' }
*/
```

**Example** (Combining Effects in Records)

```ts twoslash
import { Effect, Console } from "effect"

const recordOfEffects: Record<string, Effect.Effect<number>> = {
  key1: Effect.succeed(1).pipe(Effect.tap(Console.log)),
  key2: Effect.succeed(2).pipe(Effect.tap(Console.log))
}

//      ┌─── Effect<{ [x: string]: number; }, never, never>
//      ▼
const resultsAsRecord = Effect.all(recordOfEffects)

Effect.runPromise(resultsAsRecord).then(console.log)
/*
Output:
1
2
{ key1: 1, key2: 2 }
*/
```

#### Short-Circuiting Behavior

The `Effect.all` function stops execution on the first error it encounters, this is called "short-circuiting".
If any effect in the collection fails, the remaining effects will not run, and the error will be propagated.

**Example** (Bail Out on First Failure)

```ts twoslash
import { Effect, Console } from "effect"

const program = Effect.all([
  Effect.succeed("Task1").pipe(Effect.tap(Console.log)),
  Effect.fail("Task2: Oh no!").pipe(Effect.tap(Console.log)),
  // Won't execute due to earlier failure
  Effect.succeed("Task3").pipe(Effect.tap(Console.log))
])

Effect.runPromiseExit(program).then(console.log)
/*
Output:
Task1
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'Task2: Oh no!' }
}
*/
```

You can override this behavior by using the `mode` option.

#### The `mode` option

The `{ mode: "either" }` option changes the behavior of `Effect.all` to ensure all effects run, even if some fail. Instead of stopping on the first failure, this mode collects both successes and failures, returning an array of `Either` instances where each result is either a `Right` (success) or a `Left` (failure).

**Example** (Collecting Results with `mode: "either"`)

```ts twoslash /{ mode: "either" }/
import { Effect, Console } from "effect"

const effects = [
  Effect.succeed("Task1").pipe(Effect.tap(Console.log)),
  Effect.fail("Task2: Oh no!").pipe(Effect.tap(Console.log)),
  Effect.succeed("Task3").pipe(Effect.tap(Console.log))
]

const program = Effect.all(effects, { mode: "either" })

Effect.runPromiseExit(program).then(console.log)
/*
Output:
Task1
Task3
{
  _id: 'Exit',
  _tag: 'Success',
  value: [
    { _id: 'Either', _tag: 'Right', right: 'Task1' },
    { _id: 'Either', _tag: 'Left', left: 'Task2: Oh no!' },
    { _id: 'Either', _tag: 'Right', right: 'Task3' }
  ]
}
*/
```

Similarly, the `{ mode: "validate" }` option uses `Option` to indicate success or failure. Each effect returns `None` for success and `Some` with the error for failure.

**Example** (Collecting Results with `mode: "validate"`)

```ts twoslash /{ mode: "validate" }/
import { Effect, Console } from "effect"

const effects = [
  Effect.succeed("Task1").pipe(Effect.tap(Console.log)),
  Effect.fail("Task2: Oh no!").pipe(Effect.tap(Console.log)),
  Effect.succeed("Task3").pipe(Effect.tap(Console.log))
]

const program = Effect.all(effects, { mode: "validate" })

Effect.runPromiseExit(program).then((result) => console.log("%o", result))
/*
Output:
Task1
Task3
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Fail',
    failure: [
      { _id: 'Option', _tag: 'None' },
      { _id: 'Option', _tag: 'Some', value: 'Task2: Oh no!' },
      { _id: 'Option', _tag: 'None' }
    ]
  }
}
*/
```
