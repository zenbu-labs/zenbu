---
title: Using Generators
description: Learn how to use generators in Effect for writing effectful code, enhancing control flow, handling errors, and simplifying asynchronous operations with a syntax similar to async/await.
sidebar:
  order: 9
---

import {
  Aside,
  Tabs,
  TabItem,
  Badge
} from "@astrojs/starlight/components"

Effect offers a convenient syntax, similar to `async`/`await`, to write effectful code using [generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator).

<Aside type="note" title="Optional Feature">
  The use of generators is an optional feature in Effect. If you find
  generators unfamiliar or prefer a different coding style, you can
  explore the documentation about [Building
  Pipelines](/docs/getting-started/building-pipelines/) in Effect.
</Aside>

## Understanding Effect.gen

The `Effect.gen` utility simplifies the task of writing effectful code by utilizing JavaScript's generator functions. This method helps your code appear and behave more like traditional synchronous code, which enhances both readability and error management.

**Example** (Performing Transactions with Discounts)

Let's explore a practical program that performs a series of data transformations commonly found in application logic:

```ts twoslash
import { Effect } from "effect"

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

// Simulated asynchronous task to fetch a transaction amount from a
// database
const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))

// Simulated asynchronous task to fetch a discount rate from a
// configuration file
const fetchDiscountRate = Effect.promise(() => Promise.resolve(5))

// Assembling the program using a generator function
const program = Effect.gen(function* () {
  // Retrieve the transaction amount
  const transactionAmount = yield* fetchTransactionAmount

  // Retrieve the discount rate
  const discountRate = yield* fetchDiscountRate

  // Calculate discounted amount
  const discountedAmount = yield* applyDiscount(
    transactionAmount,
    discountRate
  )

  // Apply service charge
  const finalAmount = addServiceCharge(discountedAmount)

  // Return the total amount after applying the charge
  return `Final amount to charge: ${finalAmount}`
})

// Execute the program and log the result
Effect.runPromise(program).then(console.log)
// Output: Final amount to charge: 96
```

Key steps to follow when using `Effect.gen`:

- Wrap your logic in `Effect.gen`
- Use `yield*` to handle effects
- Return the final result

If any of the effects that you handle inside of the generator with `yield*`
fail, then the generator will stop and exit with that failure.

<Aside type="caution" title="Required TypeScript Configuration">
  The generator API is only available when using the `downlevelIteration`
  flag or with a `target` of `"es2015"` or higher in your `tsconfig.json`
  file.
</Aside>

## Comparing Effect.gen with async/await

If you are familiar with `async`/`await`, you may notice that the flow of writing code is similar.

Let's compare the two approaches:

<Tabs syncKey="promises-vs-generators">

<TabItem label="Using Effect.gen">

```ts twoslash
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

export const program = Effect.gen(function* () {
  const transactionAmount = yield* fetchTransactionAmount
  const discountRate = yield* fetchDiscountRate
  const discountedAmount = yield* applyDiscount(
    transactionAmount,
    discountRate
  )
  const finalAmount = addServiceCharge(discountedAmount)
  return `Final amount to charge: ${finalAmount}`
})
```

</TabItem>

<TabItem label="Using Async / Await">

```ts twoslash
const addServiceCharge = (amount: number) => amount + 1

const applyDiscount = (
  total: number,
  discountRate: number
): Promise<number> =>
  discountRate === 0
    ? Promise.reject(new Error("Discount rate cannot be zero"))
    : Promise.resolve(total - (total * discountRate) / 100)

const fetchTransactionAmount = Promise.resolve(100)

const fetchDiscountRate = Promise.resolve(5)

export const program = async function () {
  const transactionAmount = await fetchTransactionAmount
  const discountRate = await fetchDiscountRate
  const discountedAmount = await applyDiscount(
    transactionAmount,
    discountRate
  )
  const finalAmount = addServiceCharge(discountedAmount)
  return `Final amount to charge: ${finalAmount}`
}
```

</TabItem>

</Tabs>

It's important to note that although the code appears similar, the two programs are not identical. The purpose of comparing them side by side is just to highlight the resemblance in how they are written.

## Embracing Control Flow

One significant advantage of using `Effect.gen` in conjunction with generators is its capability to employ standard control flow constructs within the generator function. These constructs include `if`/`else`, `for`, `while`, and other branching and looping mechanisms, enhancing your ability to express complex control flow logic in your code.

**Example** (Using Control Flow)

```ts twoslash
import { Effect } from "effect"

const calculateTax = (
  amount: number,
  taxRate: number
): Effect.Effect<number, Error> =>
  taxRate > 0
    ? Effect.succeed((amount * taxRate) / 100)
    : Effect.fail(new Error("Invalid tax rate"))

const program = Effect.gen(function* () {
  let i = 1

  while (true) {
    if (i === 10) {
      break // Break the loop when counter reaches 10
    } else {
      if (i % 2 === 0) {
        // Calculate tax for even numbers
        console.log(yield* calculateTax(100, i))
      }
      i++
      continue
    }
  }
})

Effect.runPromise(program)
/*
Output:
2
4
6
8
*/
```

## How to Raise Errors

The `Effect.gen` API lets you integrate error handling directly into your workflow by yielding failed effects.
You can introduce errors with `Effect.fail`, as shown in the example below.

**Example** (Introducing an Error into the Flow)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Console.log("task1...")
const task2 = Console.log("task2...")

const program = Effect.gen(function* () {
  // Perform some tasks
  yield* task1
  yield* task2
  // Introduce an error
  yield* Effect.fail("Something went wrong!")
})

Effect.runPromise(program).then(console.log, console.error)
/*
Output:
task1...
task2...
(FiberFailure) Error: Something went wrong!
*/
```

## The Role of Short-Circuiting

When working with `Effect.gen`, it is important to understand how it handles errors.
This API will stop execution at the **first error** it encounters and return that error.

How does this affect your code? If you have several operations in sequence, once any one of them fails, the remaining operations will not run, and the error will be returned.

In simpler terms, if something fails at any point, the program will stop right there and deliver the error to you.

If you don't want to stop on an error, you can use the `Effect.either` method to encapsulate the error in the [Either](/docs/data-types/either/) data type: see the [examples of managing expected errors](/docs/error-management/expected-errors/#either).

**Example** (Halting Execution at the First Error)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Console.log("task1...")
const task2 = Console.log("task2...")
const failure = Effect.fail("Something went wrong!")
const task4 = Console.log("task4...")

const program = Effect.gen(function* () {
  yield* task1
  yield* task2
  // The program stops here due to the error
  yield* failure
  // The following lines never run
  yield* task4
  return "some result"
})

Effect.runPromise(program).then(console.log, console.error)
/*
Output:
task1...
task2...
(FiberFailure) Error: Something went wrong!
*/
```

Even though execution never reaches code after a failure, TypeScript may still assume that the code below the error is reachable unless you explicitly return after the failure.

For example, consider the following scenario where you want to narrow the type of a variable:

**Example** (Type Narrowing without Explicit Return)

```ts twoslash
import { Effect } from "effect"

type User = {
  readonly name: string
}

// Imagine this function checks a database or an external service
declare function getUserById(id: string): Effect.Effect<User | undefined>

function greetUser(id: string) {
  return Effect.gen(function* () {
    const user = yield* getUserById(id)

    if (user === undefined) {
      // Even though we fail here, TypeScript still thinks
      // 'user' might be undefined later
      yield* Effect.fail(`User with id ${id} not found`)
    }

// @errors: 18048
    return `Hello, ${user.name}!`
  })
}
```

In this example, TypeScript still considers `user` possibly `undefined` because there is no explicit return after the failure.

To fix this, explicitly return right after calling `Effect.fail`:

**Example** (Type Narrowing with Explicit Return)

```ts twoslash {15}
import { Effect } from "effect"

type User = {
  readonly name: string
}

declare function getUserById(id: string): Effect.Effect<User | undefined>

function greetUser(id: string) {
  return Effect.gen(function* () {
    const user = yield* getUserById(id)

    if (user === undefined) {
      // Explicitly return after failing
      return yield* Effect.fail(`User with id ${id} not found`)
    }

    // Now TypeScript knows that 'user' is not undefined
    return `Hello, ${user.name}!`
  })
}
```

<Aside type="note" title="Further Learning">
  To learn more about error handling in Effect, refer to the [Error
  Management](/docs/error-management/two-error-types/) section.
</Aside>

## Passing `this`

In some cases, you might need to pass a reference to the current object (`this`) into the body of your generator function.
You can achieve this by utilizing an overload that accepts the reference as the first argument:

**Example** (Passing `this` to Generator)

```ts twoslash
import { Effect } from "effect"

class MyClass {
  readonly local = 1
  compute = Effect.gen(this, function* () {
    const n = this.local + 1

    yield* Effect.log(`Computed value: ${n}`)

    return n
  })
}

Effect.runPromise(new MyClass().compute).then(console.log)
/*
Output:
timestamp=... level=INFO fiber=#0 message="Computed value: 2"
2
*/
```

## Adapter <Badge text="Deprecated" variant="caution" />

You may still come across some code snippets that use an adapter, typically indicated by `_` or `$` symbols.

In earlier versions of TypeScript, the generator "adapter" function was necessary to ensure correct type inference within generators. This adapter was used to facilitate the interaction between TypeScript's type system and generator functions.

**Example** (Adapter in Older Code)

```ts twoslash "$"
import { Effect } from "effect"

const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))

// Older usage with an adapter for proper type inference
const programWithAdapter = Effect.gen(function* ($) {
  const transactionAmount = yield* $(fetchTransactionAmount)
})

// Current usage without an adapter
const program = Effect.gen(function* () {
  const transactionAmount = yield* fetchTransactionAmount
})
```

With advances in TypeScript (v5.5+), the adapter is no longer necessary for type inference. While it remains in the codebase for backward compatibility, it is anticipated to be removed in the upcoming major release of Effect.
