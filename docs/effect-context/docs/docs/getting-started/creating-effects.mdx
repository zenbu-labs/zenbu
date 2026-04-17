---
title: Creating Effects
description: Learn to create and manage effects for structured handling of success, failure, and side effects in synchronous and asynchronous workflows.
sidebar:
  order: 7
---

import { Aside } from "@astrojs/starlight/components"

Effect provides different ways to create effects, which are units of computation that encapsulate side effects.
In this guide, we will cover some of the common methods that you can use to create effects.

## Why Not Throw Errors?

In traditional programming, when an error occurs, it is often handled by throwing an exception:

```ts twoslash
// Type signature doesn't show possible exceptions
const divide = (a: number, b: number): number => {
  if (b === 0) {
    throw new Error("Cannot divide by zero")
  }
  return a / b
}
```

However, throwing errors can be problematic. The type signatures of functions do not indicate that they can throw exceptions, making it difficult to reason about potential errors.

To address this issue, Effect introduces dedicated constructors for creating effects that represent both success and failure: `Effect.succeed` and `Effect.fail`. These constructors allow you to explicitly handle success and failure cases while **leveraging the type system to track errors**.

### succeed

Creates an `Effect` that always succeeds with a given value.

Use this function when you need an effect that completes successfully with a specific value
without any errors or external dependencies.

**Example** (Creating a Successful Effect)

```ts twoslash
import { Effect } from "effect"

//      ┌─── Effect<number, never, never>
//      ▼
const success = Effect.succeed(42)
```

The type of `success` is `Effect<number, never, never>`, which means:

- It produces a value of type `number`.
- It does not generate any errors (`never` indicates no errors).
- It requires no additional data or dependencies (`never` indicates no requirements).

```text showLineNumbers=false
         ┌─── Produces a value of type number
         │       ┌─── Does not generate any errors
         │       │      ┌─── Requires no dependencies
         ▼       ▼      ▼
Effect<number, never, never>
```

### fail

Creates an `Effect` that represents an error that can be recovered from.

Use this function to explicitly signal an error in an `Effect`. The error
will keep propagating unless it is handled. You can handle the error with
functions like [Effect.catchAll](/docs/error-management/expected-errors/#catchall) or
[Effect.catchTag](/docs/error-management/expected-errors/#catchtag).

**Example** (Creating a Failed Effect)

```ts twoslash
import { Effect } from "effect"

//      ┌─── Effect<never, Error, never>
//      ▼
const failure = Effect.fail(
  new Error("Operation failed due to network error")
)
```

The type of `failure` is `Effect<never, Error, never>`, which means:

- It never produces a value (`never` indicates that no successful result will be produced).
- It fails with an error, specifically an `Error`.
- It requires no additional data or dependencies (`never` indicates no requirements).

```text showLineNumbers=false
         ┌─── Never produces a value
         │      ┌─── Fails with an Error
         │      │      ┌─── Requires no dependencies
         ▼      ▼      ▼
Effect<never, Error, never>
```

Although you can use `Error` objects with `Effect.fail`, you can also pass strings, numbers, or more complex objects depending on your error management strategy.

Using "tagged" errors (objects with a `_tag` field) can help identify error types and works well with standard Effect functions, like [Effect.catchTag](/docs/error-management/expected-errors/#catchtag).

**Example** (Using Tagged Errors)

```ts twoslash
import { Effect, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

//      ┌─── Effect<never, HttpError, never>
//      ▼
const program = Effect.fail(new HttpError())
```

## Error Tracking

With `Effect.succeed` and `Effect.fail`, you can explicitly handle success and failure cases and the type system will ensure that errors are tracked and accounted for.

**Example** (Rewriting a Division Function)

Here's how you can rewrite the [`divide`](#why-not-throw-errors) function using Effect, making error handling explicit.

```ts twoslash
import { Effect } from "effect"

const divide = (a: number, b: number): Effect.Effect<number, Error> =>
  b === 0
    ? Effect.fail(new Error("Cannot divide by zero"))
    : Effect.succeed(a / b)
```

In this example, the `divide` function indicates in its return type `Effect<number, Error>` that the operation can either succeed with a `number` or fail with an `Error`.

```text showLineNumbers=false
         ┌─── Produces a value of type number
         │       ┌─── Fails with an Error
         ▼       ▼
Effect<number, Error>
```

This clear type signature helps ensure that errors are handled properly and that anyone calling the function is aware of the possible outcomes.

**Example** (Simulating a User Retrieval Operation)

Let's imagine another scenario where we use `Effect.succeed` and `Effect.fail` to model a simple user retrieval operation where the user data is hardcoded, which could be useful in testing scenarios or when mocking data:

```ts twoslash
import { Effect } from "effect"

// Define a User type
interface User {
  readonly id: number
  readonly name: string
}

// A mocked function to simulate fetching a user from a database
const getUser = (userId: number): Effect.Effect<User, Error> => {
  // Normally, you would access a database or API here, but we'll mock it
  const userDatabase: Record<number, User> = {
    1: { id: 1, name: "John Doe" },
    2: { id: 2, name: "Jane Smith" }
  }

  // Check if the user exists in our "database" and return appropriately
  const user = userDatabase[userId]
  if (user) {
    return Effect.succeed(user)
  } else {
    return Effect.fail(new Error("User not found"))
  }
}

// When executed, this will successfully return the user with id 1
const exampleUserEffect = getUser(1)
```

In this example, `exampleUserEffect`, which has the type `Effect<User, Error>`, will either produce a `User` object or an `Error`, depending on whether the user exists in the mocked database.

For a deeper dive into managing errors in your applications, refer to the [Error Management Guide](/docs/error-management/expected-errors/).

## Modeling Synchronous Effects

In JavaScript, you can delay the execution of synchronous computations using "thunks".

<Aside type="note" title="Thunks">
  A "thunk" is a function that takes no arguments and may return some
  value.
</Aside>

Thunks are useful for delaying the computation of a value until it is needed.

To model synchronous side effects, Effect provides the `Effect.sync` and `Effect.try` constructors, which accept a thunk.

### sync

Creates an `Effect` that represents a synchronous side-effectful computation.

Use `Effect.sync` when you are sure the operation will not fail.

The provided function (`thunk`) must not throw errors; if it does, the error will be treated as a ["defect"](/docs/error-management/unexpected-errors/).

This defect is not a standard error but indicates a flaw in the logic that was expected to be error-free.
You can think of it similar to an unexpected crash in the program, which can be further managed or logged using tools like [Effect.catchAllDefect](/docs/error-management/unexpected-errors/#catchalldefect).
This feature ensures that even unexpected failures in your application are not lost and can be handled appropriately.

**Example** (Logging a Message)

In the example below, `Effect.sync` is used to defer the side-effect of writing to the console.

```ts twoslash
import { Effect } from "effect"

const log = (message: string) =>
  Effect.sync(() => {
    console.log(message) // side effect
  })

//      ┌─── Effect<void, never, never>
//      ▼
const program = log("Hello, World!")
```

The side effect (logging to the console) encapsulated within `program` won't occur until the effect is explicitly run (see the [Running Effects](/docs/getting-started/running-effects/) section for more details). This allows you to define side effects at one point in your code and control when they are activated, improving manageability and predictability of side effects in larger applications.

### try

Creates an `Effect` that represents a synchronous computation that might fail.

In situations where you need to perform synchronous operations that might fail, such as parsing JSON, you can use the `Effect.try` constructor.
This constructor is designed to handle operations that could throw exceptions by capturing those exceptions and transforming them into manageable errors.

**Example** (Safe JSON Parsing)

Suppose you have a function that attempts to parse a JSON string. This operation can fail and throw an error if the input string is not properly formatted as JSON:

```ts twoslash
import { Effect } from "effect"

const parse = (input: string) =>
  // This might throw an error if input is not valid JSON
  Effect.try(() => JSON.parse(input))

//      ┌─── Effect<any, UnknownException, never>
//      ▼
const program = parse("")
```

In this example:

- `parse` is a function that creates an effect encapsulating the JSON parsing operation.
- If `JSON.parse(input)` throws an error due to invalid input, `Effect.try` catches this error and the effect represented by `program` will fail with an `UnknownException`. This ensures that errors are not silently ignored but are instead handled within the structured flow of effects.

#### Customizing Error Handling

You might want to transform the caught exception into a more specific error or perform additional operations when catching an error. `Effect.try` supports an overload that allows you to specify how caught exceptions should be transformed:

**Example** (Custom Error Handling)

```ts twoslash {8}
import { Effect } from "effect"

const parse = (input: string) =>
  Effect.try({
    // JSON.parse may throw for bad input
    try: () => JSON.parse(input),
    // remap the error
    catch: (unknown) => new Error(`something went wrong ${unknown}`)
  })

//      ┌─── Effect<any, Error, never>
//      ▼
const program = parse("")
```

You can think of this as a similar pattern to the traditional try-catch block in JavaScript:

```ts showLineNumbers=false
try {
  return JSON.parse(input)
} catch (unknown) {
  throw new Error(`something went wrong ${unknown}`)
}
```

## Modeling Asynchronous Effects

In traditional programming, we often use `Promise`s to handle asynchronous computations. However, dealing with errors in promises can be problematic. By default, `Promise<Value>` only provides the type `Value` for the resolved value, which means errors are not reflected in the type system. This limits the expressiveness and makes it challenging to handle and track errors effectively.

To overcome these limitations, Effect introduces dedicated constructors for creating effects that represent both success and failure in an asynchronous context: `Effect.promise` and `Effect.tryPromise`. These constructors allow you to explicitly handle success and failure cases while **leveraging the type system to track errors**.

### promise

Creates an `Effect` that represents an asynchronous computation guaranteed to succeed.

Use `Effect.promise` when you are sure the operation will not reject.

The provided function (`thunk`) returns a `Promise` that should never reject; if it does, the error will be treated as a ["defect"](/docs/error-management/unexpected-errors/).

This defect is not a standard error but indicates a flaw in the logic that was expected to be error-free.
You can think of it similar to an unexpected crash in the program, which can be further managed or logged using tools like [Effect.catchAllDefect](/docs/error-management/unexpected-errors/#catchalldefect).
This feature ensures that even unexpected failures in your application are not lost and can be handled appropriately.

**Example** (Delayed Message)

```ts twoslash
import { Effect } from "effect"

const delay = (message: string) =>
  Effect.promise<string>(
    () =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(message)
        }, 2000)
      })
  )

//      ┌─── Effect<string, never, never>
//      ▼
const program = delay("Async operation completed successfully!")
```

The `program` value has the type `Effect<string, never, never>` and can be interpreted as an effect that:

- succeeds with a value of type `string`
- does not produce any expected error (`never`)
- does not require any context (`never`)

### tryPromise

Creates an `Effect` that represents an asynchronous computation that might fail.

Unlike `Effect.promise`, this constructor is suitable when the underlying `Promise` might reject.
It provides a way to catch errors and handle them appropriately.
By default if an error occurs, it will be caught and propagated to the error channel as an `UnknownException`.

**Example** (Fetching a TODO Item)

```ts twoslash
import { Effect } from "effect"

const getTodo = (id: number) =>
  // Will catch any errors and propagate them as UnknownException
  Effect.tryPromise(() =>
    fetch(`https://jsonplaceholder.typicode.com/todos/${id}`)
  )

//      ┌─── Effect<Response, UnknownException, never>
//      ▼
const program = getTodo(1)
```

The `program` value has the type `Effect<Response, UnknownException, never>` and can be interpreted as an effect that:

- succeeds with a value of type `Response`
- might produce an error (`UnknownException`)
- does not require any context (`never`)

#### Customizing Error Handling

If you want more control over what gets propagated to the error channel, you can use an overload of `Effect.tryPromise` that takes a remapping function:

**Example** (Custom Error Handling)

```ts twoslash {7}
import { Effect } from "effect"

const getTodo = (id: number) =>
  Effect.tryPromise({
    try: () => fetch(`https://jsonplaceholder.typicode.com/todos/${id}`),
    // remap the error
    catch: (unknown) => new Error(`something went wrong ${unknown}`)
  })

//      ┌─── Effect<Response, Error, never>
//      ▼
const program = getTodo(1)
```

## From a Callback

Creates an `Effect` from a callback-based asynchronous function.

Sometimes you have to work with APIs that don't support `async/await` or `Promise` and instead use the callback style.
To handle callback-based APIs, Effect provides the `Effect.async` constructor.

**Example** (Wrapping a Callback API)

Let's wrap the `readFile` function from Node.js's `fs` module into an Effect-based API (make sure `@types/node` is installed):

```ts twoslash
import { Effect } from "effect"
import * as NodeFS from "node:fs"

const readFile = (filename: string) =>
  Effect.async<Buffer, Error>((resume) => {
    NodeFS.readFile(filename, (error, data) => {
      if (error) {
        // Resume with a failed Effect if an error occurs
        resume(Effect.fail(error))
      } else {
        // Resume with a succeeded Effect if successful
        resume(Effect.succeed(data))
      }
    })
  })

//      ┌─── Effect<Buffer, Error, never>
//      ▼
const program = readFile("example.txt")
```

In the above example, we manually annotate the types when calling `Effect.async`:

```ts showLineNumbers=false "<Buffer, Error>"
Effect.async<Buffer, Error>((resume) => {
  // ...
})
```

because TypeScript cannot infer the type parameters for a callback
based on the return value inside the callback body. Annotating the types ensures that the values provided to `resume` match the expected types.

The `resume` function inside `Effect.async` should be called exactly once. Calling it more than once will result in the extra calls being ignored.

**Example** (Ignoring Subsequent `resume` Calls)

```ts twoslash
import { Effect } from "effect"

const program = Effect.async<number>((resume) => {
  resume(Effect.succeed(1))
  resume(Effect.succeed(2)) // This line will be ignored
})

// Run the program
Effect.runPromise(program).then(console.log) // Output: 1
```

### Advanced Usage

For more advanced use cases, the callback passed to Effect.async may return an Effect that will be executed if the fiber running this effect is interrupted. This can be used to perform cleanup when the operation is cancelled.

**Example** (Handling Interruption with Cleanup)

In this example:

- The `writeFileWithCleanup` function writes data to a file.
- If the fiber running this effect is interrupted, the cleanup effect (which deletes the file) is executed.
- This ensures that resources like open file handles are cleaned up properly when the operation is canceled.

```ts twoslash
import { Effect, Fiber } from "effect"
import * as NodeFS from "node:fs"

// Simulates a long-running operation to write to a file
const writeFileWithCleanup = (filename: string, data: string) =>
  Effect.async<void, Error>((resume) => {
    const writeStream = NodeFS.createWriteStream(filename)

    // Start writing data to the file
    writeStream.write(data)

    // When the stream is finished, resume with success
    writeStream.on("finish", () => resume(Effect.void))

    // In case of an error during writing, resume with failure
    writeStream.on("error", (err) => resume(Effect.fail(err)))

    // Handle interruption by returning a cleanup effect
    return Effect.sync(() => {
      console.log(`Cleaning up ${filename}`)
      NodeFS.unlinkSync(filename)
    })
  })

const program = Effect.gen(function* () {
  const fiber = yield* Effect.fork(
    writeFileWithCleanup("example.txt", "Some long data...")
  )
  // Simulate interrupting the fiber after 1 second
  yield* Effect.sleep("1 second")
  yield* Fiber.interrupt(fiber) // This will trigger the cleanup
})

// Run the program
Effect.runPromise(program)
/*
Output:
Cleaning up example.txt
*/
```

If the operation you're wrapping supports interruption, the `resume` function can receive an `AbortSignal` to handle interruption requests directly.

**Example** (Handling Interruption with `AbortSignal`)

```ts twoslash
import { Effect, Fiber } from "effect"

// A task that supports interruption using AbortSignal
const interruptibleTask = Effect.async<void, Error>((resume, signal) => {
  // Simulate a long-running task
  const timeoutId = setTimeout(() => {
    console.log("Operation completed")
    resume(Effect.void)
  }, 2000)

  // Handle interruption
  signal.addEventListener("abort", () => {
    console.log("Abort signal received")
    clearTimeout(timeoutId)
  })
})

const program = Effect.gen(function* () {
  const fiber = yield* Effect.fork(interruptibleTask)
  // Simulate interrupting the fiber after 1 second
  yield* Effect.sleep("1 second")
  yield* Fiber.interrupt(fiber)
})

// Run the program
Effect.runPromise(program)
/*
Output:
Abort signal received
*/
```

## Suspended Effects

`Effect.suspend` is used to delay the creation of an effect.
It allows you to defer the evaluation of an effect until it is actually needed.
The `Effect.suspend` function takes a thunk that represents the effect, and it wraps it in a suspended effect.

**Syntax**

```ts showLineNumbers=false
const suspendedEffect = Effect.suspend(() => effect)
```

Let's explore some common scenarios where `Effect.suspend` proves useful.

### Lazy Evaluation

When you want to defer the evaluation of an effect until it is required. This can be useful for optimizing the execution of effects, especially when they are not always needed or when their computation is expensive.

Also, when effects with side effects or scoped captures are created, use `Effect.suspend` to re-execute on each invocation.

**Example** (Lazy Evaluation with Side Effects)

```ts twoslash
import { Effect } from "effect"

let i = 0

const bad = Effect.succeed(i++)

const good = Effect.suspend(() => Effect.succeed(i++))

console.log(Effect.runSync(bad)) // Output: 0
console.log(Effect.runSync(bad)) // Output: 0

console.log(Effect.runSync(good)) // Output: 1
console.log(Effect.runSync(good)) // Output: 2
```

<Aside type="note" title="Running Effects">
  This example utilizes `Effect.runSync` to execute effects and display
  their results (refer to [Running
  Effects](/docs/getting-started/running-effects/#runsync) for more
  details).
</Aside>

In this example, `bad` is the result of calling `Effect.succeed(i++)` a single time, which increments the scoped variable but [returns its original value](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Increment#postfix_increment). `Effect.runSync(bad)` does not result in any new computation, because `Effect.succeed(i++)` has already been called. On the other hand, each time `Effect.runSync(good)` is called, the thunk passed to `Effect.suspend()` will be executed, outputting the scoped variable's most recent value.

### Handling Circular Dependencies

`Effect.suspend` is helpful in managing circular dependencies between effects, where one effect depends on another, and vice versa.
For example it's fairly common for `Effect.suspend` to be used in recursive functions to escape an eager call.

**Example** (Recursive Fibonacci)

```ts twoslash
import { Effect } from "effect"

const blowsUp = (n: number): Effect.Effect<number> =>
  n < 2
    ? Effect.succeed(1)
    : Effect.zipWith(blowsUp(n - 1), blowsUp(n - 2), (a, b) => a + b)

// console.log(Effect.runSync(blowsUp(32)))
// crash: JavaScript heap out of memory

const allGood = (n: number): Effect.Effect<number> =>
  n < 2
    ? Effect.succeed(1)
    : Effect.zipWith(
        Effect.suspend(() => allGood(n - 1)),
        Effect.suspend(() => allGood(n - 2)),
        (a, b) => a + b
      )

console.log(Effect.runSync(allGood(32))) // Output: 3524578
```

<Aside type="note" title="Running Effects">
  This example utilizes `Effect.zipWith` to combine the results of two
  effects (refer to the documentation on
  [zipping](/docs/getting-started/control-flow/#zipwith) for more
  details).
</Aside>

The `blowsUp` function creates a recursive Fibonacci sequence without deferring execution. Each call to `blowsUp` triggers further immediate recursive calls, rapidly increasing the JavaScript call stack size.

Conversely, `allGood` avoids stack overflow by using `Effect.suspend` to defer the recursive calls. This mechanism doesn't immediately execute the recursive effects but schedules them to be run later, thus keeping the call stack shallow and preventing a crash.

### Unifying Return Type

In situations where TypeScript struggles to unify the returned effect type, `Effect.suspend` can be employed to resolve this issue.

**Example** (Using `Effect.suspend` to Help TypeScript Infer Types)

```ts twoslash
import { Effect } from "effect"

/*
  Without suspend, TypeScript may struggle with type inference.

  Inferred type:
    (a: number, b: number) =>
      Effect<never, Error, never> | Effect<number, never, never>
*/
const withoutSuspend = (a: number, b: number) =>
  b === 0
    ? Effect.fail(new Error("Cannot divide by zero"))
    : Effect.succeed(a / b)

/*
  Using suspend to unify return types.

  Inferred type:
    (a: number, b: number) => Effect<number, Error, never>
*/
const withSuspend = (a: number, b: number) =>
  Effect.suspend(() =>
    b === 0
      ? Effect.fail(new Error("Cannot divide by zero"))
      : Effect.succeed(a / b)
  )
```

## Cheatsheet

The table provides a summary of the available constructors, along with their input and output types, allowing you to choose the appropriate function based on your needs.

| API                     | Given                              | Result                        |
| ----------------------- | ---------------------------------- | ----------------------------- |
| `succeed`               | `A`                                | `Effect<A>`                   |
| `fail`                  | `E`                                | `Effect<never, E>`            |
| `sync`                  | `() => A`                          | `Effect<A>`                   |
| `try`                   | `() => A`                          | `Effect<A, UnknownException>` |
| `try` (overload)        | `() => A`, `unknown => E`          | `Effect<A, E>`                |
| `promise`               | `() => Promise<A>`                 | `Effect<A>`                   |
| `tryPromise`            | `() => Promise<A>`                 | `Effect<A, UnknownException>` |
| `tryPromise` (overload) | `() => Promise<A>`, `unknown => E` | `Effect<A, E>`                |
| `async`                 | `(Effect<A, E> => void) => void`   | `Effect<A, E>`                |
| `suspend`               | `() => Effect<A, E, R>`            | `Effect<A, E, R>`             |

For the complete list of constructors, visit the [Effect Constructors Documentation](https://effect-ts.github.io/effect/effect/Effect.ts.html#constructors).
