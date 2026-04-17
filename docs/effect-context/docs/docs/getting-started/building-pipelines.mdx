---
title: Building Pipelines
description: Learn to create modular, readable pipelines for composing and sequencing operations in Effect, enabling clear and efficient data transformations.
sidebar:
  order: 10
---

import { Aside } from "@astrojs/starlight/components"

Effect pipelines allow for the composition and sequencing of operations on values, enabling the transformation and manipulation of data in a concise and modular manner.

## Why Pipelines are Good for Structuring Your Application

Pipelines are an excellent way to structure your application and handle data transformations in a concise and modular manner. They offer several benefits:

1. **Readability**: Pipelines allow you to compose functions in a readable and sequential manner. You can clearly see the flow of data and the operations applied to it, making it easier to understand and maintain the code.

2. **Code Organization**: With pipelines, you can break down complex operations into smaller, manageable functions. Each function performs a specific task, making your code more modular and easier to reason about.

3. **Reusability**: Pipelines promote the reuse of functions. By breaking down operations into smaller functions, you can reuse them in different pipelines or contexts, improving code reuse and reducing duplication.

4. **Type Safety**: By leveraging the type system, pipelines help catch errors at compile-time. Functions in a pipeline have well-defined input and output types, ensuring that the data flows correctly through the pipeline and minimizing runtime errors.

## Functions vs Methods

The use of functions in the Effect ecosystem libraries is important for
achieving **tree shakeability** and ensuring **extensibility**.
Functions enable efficient bundling by eliminating unused code, and they
provide a flexible and modular approach to extending the libraries'
functionality.

### Tree Shakeability

Tree shakeability refers to the ability of a build system to eliminate unused code during the bundling process. Functions are tree shakeable, while methods are not.

When functions are used in the Effect ecosystem, only the functions that are actually imported and used in your application will be included in the final bundled code. Unused functions are automatically removed, resulting in a smaller bundle size and improved performance.

On the other hand, methods are attached to objects or prototypes, and they cannot be easily tree shaken. Even if you only use a subset of methods, all methods associated with an object or prototype will be included in the bundle, leading to unnecessary code bloat.

### Extensibility

Another important advantage of using functions in the Effect ecosystem is the ease of extensibility. With methods, extending the functionality of an existing API often requires modifying the prototype of the object, which can be complex and error-prone.

In contrast, with functions, extending the functionality is much simpler. You can define your own "extension methods" as plain old functions without the need to modify the prototypes of objects. This promotes cleaner and more modular code, and it also allows for better compatibility with other libraries and modules.

## pipe

The `pipe` function is a utility that allows us to compose functions in a readable and sequential manner. It takes the output of one function and passes it as the input to the next function in the pipeline. This enables us to build complex transformations by chaining multiple functions together.

**Syntax**

```ts showLineNumbers=false
import { pipe } from "effect"

const result = pipe(input, func1, func2, ..., funcN)
```

In this syntax, `input` is the initial value, and `func1`, `func2`, ..., `funcN` are the functions to be applied in sequence. The result of each function becomes the input for the next function, and the final result is returned.

Here's an illustration of how `pipe` works:

```text showLineNumbers=false
┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌────────┐
│ input │───►│ func1 │───►│ func2 │───►│  ...  │───►│ funcN │───►│ result │
└───────┘    └───────┘    └───────┘    └───────┘    └───────┘    └────────┘
```

It's important to note that functions passed to `pipe` must have a **single argument** because they are only called with a single argument.

Let's see an example to better understand how `pipe` works:

**Example** (Chaining Arithmetic Operations)

```ts twoslash
import { pipe } from "effect"

// Define simple arithmetic operations
const increment = (x: number) => x + 1
const double = (x: number) => x * 2
const subtractTen = (x: number) => x - 10

// Sequentially apply these operations using `pipe`
const result = pipe(5, increment, double, subtractTen)

console.log(result)
// Output: 2
```

In the above example, we start with an input value of `5`. The `increment` function adds `1` to the initial value, resulting in `6`. Then, the `double` function doubles the value, giving us `12`. Finally, the `subtractTen` function subtracts `10` from `12`, resulting in the final output of `2`.

The result is equivalent to `subtractTen(double(increment(5)))`, but using `pipe` makes the code more readable because the operations are sequenced from left to right, rather than nesting them inside out.

## map

Transforms the value inside an effect by applying a function to it.

**Syntax**

```ts showLineNumbers=false
const mappedEffect = pipe(myEffect, Effect.map(transformation))
// or
const mappedEffect = Effect.map(myEffect, transformation)
// or
const mappedEffect = myEffect.pipe(Effect.map(transformation))
```

`Effect.map` takes a function and applies it to the value contained within an
effect, creating a new effect with the transformed value.

<Aside type="note" title="Effects are Immutable">
  It's important to note that effects are immutable, meaning that the
  original effect is not modified. Instead, a new effect is returned with
  the updated value.
</Aside>

**Example** (Adding a Service Charge)

Here's a practical example where we apply a service charge to a transaction amount:

```ts twoslash
import { pipe, Effect } from "effect"

// Function to add a small service charge to a transaction amount
const addServiceCharge = (amount: number) => amount + 1

// Simulated asynchronous task to fetch a transaction amount from database
const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))

// Apply service charge to the transaction amount
const finalAmount = pipe(
  fetchTransactionAmount,
  Effect.map(addServiceCharge)
)

Effect.runPromise(finalAmount).then(console.log) // Output: 101
```

## as

Replaces the value inside an effect with a constant value.

`Effect.as` allows you to ignore the original value inside an effect and replace it with a new constant value.

<Aside type="note" title="Effects are Immutable">
  It's important to note that effects are immutable, meaning that the
  original effect is not modified. Instead, a new effect is returned with
  the updated value.
</Aside>

**Example** (Replacing a Value)

```ts twoslash
import { pipe, Effect } from "effect"

// Replace the value 5 with the constant "new value"
const program = pipe(Effect.succeed(5), Effect.as("new value"))

Effect.runPromise(program).then(console.log) // Output: "new value"
```

## flatMap

Chains effects to produce new `Effect` instances, useful for combining operations that depend on previous results.

**Syntax**

```ts showLineNumbers=false
const flatMappedEffect = pipe(myEffect, Effect.flatMap(transformation))
// or
const flatMappedEffect = Effect.flatMap(myEffect, transformation)
// or
const flatMappedEffect = myEffect.pipe(Effect.flatMap(transformation))
```

In the code above, `transformation` is the function that takes a value and returns an `Effect`, and `myEffect` is the initial `Effect` being transformed.

Use `Effect.flatMap` when you need to chain multiple effects, ensuring that each
step produces a new `Effect` while flattening any nested effects that may
occur.

It is similar to `flatMap` used with arrays but works
specifically with `Effect` instances, allowing you to avoid deeply nested
effect structures.

<Aside type="note" title="Effects are Immutable">
  It's important to note that effects are immutable, meaning that the
  original effect is not modified. Instead, a new effect is returned with
  the updated value.
</Aside>

**Example** (Applying a Discount)

```ts twoslash
import { pipe, Effect } from "effect"

// Function to apply a discount safely to a transaction amount
const applyDiscount = (
  total: number,
  discountRate: number
): Effect.Effect<number, Error> =>
  discountRate === 0
    ? Effect.fail(new Error("Discount rate cannot be zero"))
    : Effect.succeed(total - (total * discountRate) / 100)

// Simulated asynchronous task to fetch a transaction amount from database
const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))

// Chaining the fetch and discount application using `flatMap`
const finalAmount = pipe(
  fetchTransactionAmount,
  Effect.flatMap((amount) => applyDiscount(amount, 5))
)

Effect.runPromise(finalAmount).then(console.log)
// Output: 95
```

### Ensure All Effects Are Considered

Make sure that all effects within `Effect.flatMap` contribute to the final computation. If you ignore an effect, it can lead to unexpected behavior:

```ts {3} showLineNumbers=false
Effect.flatMap((amount) => {
  // This effect will be ignored
  Effect.sync(() => console.log(`Apply a discount to: ${amount}`))
  return applyDiscount(amount, 5)
})
```

In this case, the `Effect.sync` call is ignored and does not affect the result of `applyDiscount(amount, 5)`. To handle effects correctly, make sure to explicitly chain them using functions like `Effect.map`, `Effect.flatMap`, `Effect.andThen`, or `Effect.tap`.

## andThen

Chains two actions, where the second action can depend on the result of the first.

**Syntax**

```ts showLineNumbers=false
const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))
// or
const transformedEffect = Effect.andThen(myEffect, anotherEffect)
// or
const transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))
```

Use `andThen` when you need to run multiple actions in sequence, with the
second action depending on the result of the first. This is useful for
combining effects or handling computations that must happen in order.

The second action can be:

1. A value (similar to `Effect.as`)
2. A function returning a value (similar to `Effect.map`)
3. A `Promise`
4. A function returning a `Promise`
5. An `Effect`
6. A function returning an `Effect` (similar to `Effect.flatMap`)

**Example** (Applying a Discount Based on Fetched Amount)

Let's look at an example comparing `Effect.andThen` with `Effect.map` and `Effect.flatMap`:

```ts twoslash
import { pipe, Effect } from "effect"

// Function to apply a discount safely to a transaction amount
const applyDiscount = (
  total: number,
  discountRate: number
): Effect.Effect<number, Error> =>
  discountRate === 0
    ? Effect.fail(new Error("Discount rate cannot be zero"))
    : Effect.succeed(total - (total * discountRate) / 100)

// Simulated asynchronous task to fetch a transaction amount from database
const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))

// Using Effect.map and Effect.flatMap
const result1 = pipe(
  fetchTransactionAmount,
  Effect.map((amount) => amount * 2),
  Effect.flatMap((amount) => applyDiscount(amount, 5))
)

Effect.runPromise(result1).then(console.log) // Output: 190

// Using Effect.andThen
const result2 = pipe(
  fetchTransactionAmount,
  Effect.andThen((amount) => amount * 2),
  Effect.andThen((amount) => applyDiscount(amount, 5))
)

Effect.runPromise(result2).then(console.log) // Output: 190
```

### Option and Either with andThen

Both [Option](/docs/data-types/option/#interop-with-effect) and [Either](/docs/data-types/either/#interop-with-effect) are commonly used for handling optional or missing values or simple error cases. These types integrate well with `Effect.andThen`. When used with `Effect.andThen`, the operations are categorized as scenarios 5 and 6 (as discussed earlier) because both `Option` and `Either` are treated as effects in this context.

**Example** (with Option)

```ts twoslash
import { pipe, Effect, Option } from "effect"

// Simulated asynchronous task fetching a number from a database
const fetchNumberValue = Effect.tryPromise(() => Promise.resolve(42))

//      ┌─── Effect<number, UnknownException | NoSuchElementException, never>
//      ▼
const program = pipe(
  fetchNumberValue,
  Effect.andThen((x) => (x > 0 ? Option.some(x) : Option.none()))
)
```

You might expect the type of `program` to be `Effect<Option<number>, UnknownException, never>`, but it is actually `Effect<number, UnknownException | NoSuchElementException, never>`.

This is because `Option<A>` is treated as an effect of type `Effect<A, NoSuchElementException>`, and as a result, the possible errors are combined into a union type.

<Aside type="tip" title="Option As Effect">
A value of type `Option<A>` is interpreted as an effect of type `Effect<A, NoSuchElementException>`.
</Aside>

**Example** (with Either)

```ts twoslash
import { pipe, Effect, Either } from "effect"

// Function to parse an integer from a string that can fail
const parseInteger = (input: string): Either.Either<number, string> =>
  isNaN(parseInt(input))
    ? Either.left("Invalid integer")
    : Either.right(parseInt(input))

// Simulated asynchronous task fetching a string from database
const fetchStringValue = Effect.tryPromise(() => Promise.resolve("42"))

//      ┌─── Effect<number, string | UnknownException, never>
//      ▼
const program = pipe(
  fetchStringValue,
  Effect.andThen((str) => parseInteger(str))
)
```

Although one might expect the type of `program` to be `Effect<Either<number, string>, UnknownException, never>`, it is actually `Effect<number, string | UnknownException, never>`.

This is because `Either<A, E>` is treated as an effect of type `Effect<A, E>`, meaning the errors are combined into a union type.

<Aside type="tip" title="Either As Effect">
A value of type `Either<A, E>` is interpreted as an effect of type `Effect<A, E>`.
</Aside>

## tap

Runs a side effect with the result of an effect without changing the original value.

Use `Effect.tap` when you want to perform a side effect, like logging or tracking,
without modifying the main value. This is useful when you need to observe or
record an action but want the original value to be passed to the next step.

`Effect.tap` works similarly to `Effect.flatMap`, but it ignores the result of the function
passed to it. The value from the previous effect remains available for the
next part of the chain. Note that if the side effect fails, the entire chain
will fail too.

**Example** (Logging a step in a pipeline)

```ts twoslash
import { pipe, Effect, Console } from "effect"

// Function to apply a discount safely to a transaction amount
const applyDiscount = (
  total: number,
  discountRate: number
): Effect.Effect<number, Error> =>
  discountRate === 0
    ? Effect.fail(new Error("Discount rate cannot be zero"))
    : Effect.succeed(total - (total * discountRate) / 100)

// Simulated asynchronous task to fetch a transaction amount from database
const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))

const finalAmount = pipe(
  fetchTransactionAmount,
  // Log the fetched transaction amount
  Effect.tap((amount) => Console.log(`Apply a discount to: ${amount}`)),
  // `amount` is still available!
  Effect.flatMap((amount) => applyDiscount(amount, 5))
)

Effect.runPromise(finalAmount).then(console.log)
/*
Output:
Apply a discount to: 100
95
*/
```

In this example, `Effect.tap` is used to log the transaction amount before applying the discount, without modifying the value itself. The original value (`amount`) remains available for the next operation (`applyDiscount`).

Using `Effect.tap` allows us to execute side effects during the computation without altering the result.
This can be useful for logging, performing additional actions, or observing the intermediate values without interfering with the main computation flow.

## all

Combines multiple effects into one, returning results based on the input structure.

Use `Effect.all` when you need to run multiple effects and combine their results
into a single output. It supports tuples, iterables, structs, and records,
making it flexible for different input types.

For instance, if the input is a tuple:

```ts showLineNumbers=false
//         ┌─── a tuple of effects
//         ▼
Effect.all([effect1, effect2, ...])
```

the effects are executed in order, and the result is a new effect containing the results as a tuple. The results in the tuple match the order of the effects passed to `Effect.all`.

By default, `Effect.all` runs effects sequentially and produces a tuple or object
with the results. If any effect fails, it stops execution (short-circuiting)
and propagates the error.

See [Collecting](/docs/getting-started/control-flow/#all) for more information on how to use `Effect.all`.

**Example** (Combining Configuration and Database Checks)

```ts twoslash
import { Effect } from "effect"

// Simulated function to read configuration from a file
const webConfig = Effect.promise(() =>
  Promise.resolve({ dbConnection: "localhost", port: 8080 })
)

// Simulated function to test database connectivity
const checkDatabaseConnectivity = Effect.promise(() =>
  Promise.resolve("Connected to Database")
)

// Combine both effects to perform startup checks
const startupChecks = Effect.all([webConfig, checkDatabaseConnectivity])

Effect.runPromise(startupChecks).then(([config, dbStatus]) => {
  console.log(
    `Configuration: ${JSON.stringify(config)}\nDB Status: ${dbStatus}`
  )
})
/*
Output:
Configuration: {"dbConnection":"localhost","port":8080}
DB Status: Connected to Database
*/
```

## Build your first pipeline

Let's now combine the `pipe` function, `Effect.all`, and `Effect.andThen` to create a pipeline that performs a sequence of transformations.

**Example** (Building a Transaction Pipeline)

```ts twoslash
import { Effect, pipe } from "effect"

// Function to add a small service charge to a transaction amount
const addServiceCharge = (amount: number) => amount + 1

// Function to apply a discount safely to a transaction amount
const applyDiscount = (
  total: number,
  discountRate: number
): Effect.Effect<number, Error> =>
  discountRate === 0
    ? Effect.fail(new Error("Discount rate cannot be zero"))
    : Effect.succeed(total - (total * discountRate) / 100)

// Simulated asynchronous task to fetch a transaction amount from database
const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))

// Simulated asynchronous task to fetch a discount rate
// from a configuration file
const fetchDiscountRate = Effect.promise(() => Promise.resolve(5))

// Assembling the program using a pipeline of effects
const program = pipe(
  // Combine both fetch effects to get the transaction amount
  // and discount rate
  Effect.all([fetchTransactionAmount, fetchDiscountRate]),

  // Apply the discount to the transaction amount
  Effect.andThen(([transactionAmount, discountRate]) =>
    applyDiscount(transactionAmount, discountRate)
  ),

  // Add the service charge to the discounted amount
  Effect.andThen(addServiceCharge),

  // Format the final result for display
  Effect.andThen(
    (finalAmount) => `Final amount to charge: ${finalAmount}`
  )
)

// Execute the program and log the result
Effect.runPromise(program).then(console.log)
// Output: "Final amount to charge: 96"
```

This pipeline demonstrates how you can structure your code by combining different effects into a clear, readable flow.

## The pipe method

Effect provides a `pipe` method that works similarly to the `pipe` method found in [rxjs](https://rxjs.dev/api/index/function/pipe). This method allows you to chain multiple operations together, making your code more concise and readable.

**Syntax**

```ts showLineNumbers=false
const result = effect.pipe(func1, func2, ..., funcN)
```

This is equivalent to using the `pipe` **function** like this:

```ts showLineNumbers=false
const result = pipe(effect, func1, func2, ..., funcN)
```

The `pipe` method is available on all effects and many other data types, eliminating the need to import the `pipe` function and saving you some keystrokes.

**Example** (Using the `pipe` Method)

Let's rewrite an [earlier example](#build-your-first-pipeline), this time using the `pipe` method.

```ts twoslash collapse={3-15}
import { Effect } from "effect"

const addServiceCharge = (amount: number) => amount + 1

const applyDiscount = (
  total: number,
  discountRate: number
): Effect.Effect<number, Error> =>
  discountRate === 0
    ? Effect.fail(new Error("Discount rate cannot be zero"))
    : Effect.succeed(total - (total * discountRate) / 100)

const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))

const fetchDiscountRate = Effect.promise(() => Promise.resolve(5))

const program = Effect.all([
  fetchTransactionAmount,
  fetchDiscountRate
]).pipe(
  Effect.andThen(([transactionAmount, discountRate]) =>
    applyDiscount(transactionAmount, discountRate)
  ),
  Effect.andThen(addServiceCharge),
  Effect.andThen(
    (finalAmount) => `Final amount to charge: ${finalAmount}`
  )
)
```

## Cheatsheet

Let's summarize the transformation functions we have seen so far:

| API       | Input                                     | Output                      |
| --------- | ----------------------------------------- | --------------------------- |
| `map`     | `Effect<A, E, R>`, `A => B`               | `Effect<B, E, R>`           |
| `flatMap` | `Effect<A, E, R>`, `A => Effect<B, E, R>` | `Effect<B, E, R>`           |
| `andThen` | `Effect<A, E, R>`, \*                     | `Effect<B, E, R>`           |
| `tap`     | `Effect<A, E, R>`, `A => Effect<B, E, R>` | `Effect<A, E, R>`           |
| `all`     | `[Effect<A, E, R>, Effect<B, E, R>, ...]` | `Effect<[A, B, ...], E, R>` |
