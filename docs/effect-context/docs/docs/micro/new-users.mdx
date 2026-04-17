---
title: Getting Started with Micro
description: Learn how to get started with the Micro module, a lightweight alternative to Effect for reducing bundle size while maintaining essential functionality in TypeScript applications.
sidebar:
  label: Getting Started
  order: 0
---

import {
  Aside,
  Tabs,
  TabItem,
  Steps
} from "@astrojs/starlight/components"

<Aside type="caution" title="Experimental Module">
  The Micro module is currently in its experimental stages. We encourage
  your feedback to further improve its features.
</Aside>

The Micro module is designed as a lighter alternative to the standard Effect module, tailored for situations where it is beneficial to reduce the bundle size.

This module is standalone and does not include more complex functionalities such as [Layer](/docs/requirements-management/layers/), [Ref](/docs/state-management/ref/), [Queue](/docs/concurrency/queue/), and [Deferred](/docs/concurrency/deferred/). This feature set makes Micro especially suitable for libraries that wish to utilize Effect functionalities while keeping the bundle size to a minimum, particularly for those aiming to provide `Promise`-based APIs.

Micro also supports use cases where a client application uses Micro, and a server employs the full suite of Effect features, maintaining both compatibility and logical consistency across various application components.

Integrating Micro adds a minimal footprint to your bundle, starting at **5kb gzipped**, which may increase depending on the features you use.

<Aside type="danger" title="Bundle Size">
  Utilizing major Effect modules beyond basic data modules like `Option`,
  `Either`, `Array`, will incorporate the Effect runtime into your bundle,
  negating the benefits of Micro.
</Aside>

## Importing Micro

Before you start, make sure you have completed the following setup:

Install the `effect` library in your project. If it is not already installed, you can add it using npm with the following command:

<Tabs syncKey="package-manager">

<TabItem label="npm" icon="seti:npm">

```sh showLineNumbers=false
npm install effect
```

</TabItem>

<TabItem label="pnpm" icon="pnpm">

```sh showLineNumbers=false
pnpm add effect
```

</TabItem>

<TabItem label="Yarn" icon="seti:yarn">

```sh showLineNumbers=false
yarn add effect
```

</TabItem>

<TabItem label="Bun" icon="bun">

```sh showLineNumbers=false
bun add effect
```

</TabItem>
<TabItem label="Deno" icon="deno">

```sh showLineNumbers=false
deno add npm:effect
```

</TabItem>

</Tabs>

Micro is a part of the Effect library and can be imported just like any other module:

```ts showLineNumbers=false
import { Micro } from "effect"
```

You can also import it using a namespace import like this:

```ts showLineNumbers=false
import * as Micro from "effect/Micro"
```

Both forms of import allow you to access the functionalities provided by the `Micro` module.

However an important consideration is **tree shaking**, which refers to a process that eliminates unused code during the bundling of your application.
Named imports may generate tree shaking issues when a bundler doesn't support deep scope analysis.

Here are some bundlers that support deep scope analysis and thus don't have issues with named imports:

- Rollup
- Webpack 5+

## The Micro Type

Here is the general form of a `Micro`:

```text showLineNumbers=false
        ┌─── Represents the success type
        │        ┌─── Represents the error type
        │        │      ┌─── Represents required dependencies
        ▼        ▼      ▼
Micro<Success, Error, Requirements>
```

which mirror those of the `Effect` type:

| Parameter        | Description                                                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Success**      | Represents the type of value that an effect can succeed with when executed. If this type parameter is `void`, it means the effect produces no useful information, while if it is `never`, it means the effect runs forever (or until failure). |
| **Error**        | Represents the expected errors that can occur when executing an effect. If this type parameter is `never`, it means the effect cannot fail, because there are no values of type `never`.                                                       |
| **Requirements** | Represents the contextual data required by the effect to be executed. This data is stored in a collection named `Context`. If this type parameter is `never`, it means the effect has no requirements and the `Context` collection is empty.   |

## The MicroExit Type

The `MicroExit` type is used to represent the result of a `Micro` computation.
It can either be successful, containing a value of type `A`, or it can fail, containing an error of type `E` wrapped in a `MicroCause`.

```ts showLineNumbers=false
type MicroExit<A, E> = MicroExit.Success<A, E> | MicroExit.Failure<A, E>
```

## The MicroCause Type

The `MicroCause` type describes the different reasons why an effect may fail.

`MicroCause` comes in three forms:

```ts showLineNumbers=false
type MicroCause<E> = Die | Fail<E> | Interrupt
```

| Variant     | Description                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------- |
| `Die`       | Indicates an unforeseen defect that wasn't planned for in the system's logic.               |
| `Fail<E>`   | Covers anticipated errors that are recognized and typically handled within the application. |
| `Interrupt` | Signifies an operation that has been purposefully stopped.                                  |

## Wrapping a Promise-based API with Micro

This guide shows how to wrap a `Promise`-based API using the `Micro` library from Effect. We'll create a simple example that interacts with a hypothetical weather forecasting API, using Micro to handle structured error handling and execution flow.

<Steps>

1. **Create a Promise-based API Function**

   Start by defining a basic Promise-based function that simulates fetching weather data from an external service.

   ```ts twoslash
   // Simulate fetching weather data
   function fetchWeather(city: string): Promise<string> {
     return new Promise((resolve, reject) => {
       setTimeout(() => {
         if (city === "London") {
           resolve("Sunny")
         } else {
           reject(new Error("Weather data not found for this location"))
         }
       }, 1_000)
     })
   }
   ```

2. **Wrap the Promise with Micro**

   Now, wrap the `fetchWeather` function using Micro, converting the `Promise` to a Micro effect to manage both success and failure scenarios.

   ```ts twoslash collapse={4-14}
   import { Micro } from "effect"

   // Simulate fetching weather data
   function fetchWeather(city: string): Promise<string> {
     return new Promise((resolve, reject) => {
       setTimeout(() => {
         if (city === "London") {
           resolve("Sunny")
         } else {
           reject(new Error("Weather data not found for this location"))
         }
       }, 1_000)
     })
   }

   function getWeather(city: string) {
     return Micro.promise(() => fetchWeather(city))
   }
   ```

   Here, `Micro.promise` transforms the `Promise` returned by `fetchWeather` into a `Micro<string, never, never>` effect.

3. **Running the Micro Effect**

   Once the function is wrapped, execute the Micro effect and handle the results.

   **Example** (Executing the Micro Effect)

   ```ts twoslash collapse={4-14}
   import { Micro } from "effect"

   // Simulate fetching weather data
   function fetchWeather(city: string): Promise<string> {
     return new Promise((resolve, reject) => {
       setTimeout(() => {
         if (city === "London") {
           resolve("Sunny")
         } else {
           reject(new Error("Weather data not found for this location"))
         }
       }, 1_000)
     })
   }

   function getWeather(city: string) {
     return Micro.promise(() => fetchWeather(city))
   }

   //      ┌─── Micro<string, never, never>
   //      ▼
   const weatherEffect = getWeather("London")

   Micro.runPromise(weatherEffect)
     .then((data) => console.log(`The weather in London is: ${data}`))
     .catch((error) =>
       console.error(`Failed to fetch weather data: ${error.message}`)
     )
   /*
   Output:
   The weather in London is: Sunny
   */
   ```

   In the example above, `Micro.runPromise` is used to execute the `weatherEffect`, converting it back into a `Promise`, which can be managed using familiar asynchronous handling methods.

   For more detailed information on the effect's exit status, use `Micro.runPromiseExit`:

   **Example** (Inspecting Exit Status)

   ```ts twoslash collapse={4-14}
   import { Micro } from "effect"

   // Simulate fetching weather data
   function fetchWeather(city: string): Promise<string> {
     return new Promise((resolve, reject) => {
       setTimeout(() => {
         if (city === "London") {
           resolve("Sunny")
         } else {
           reject(new Error("Weather data not found for this location"))
         }
       }, 1_000)
     })
   }

   function getWeather(city: string) {
     return Micro.promise(() => fetchWeather(city))
   }

   //      ┌─── Micro<string, never, never>
   //      ▼
   const weatherEffect = getWeather("London")

   Micro.runPromiseExit(weatherEffect).then(
     // ┌─── MicroExit<string, never>
     // ▼
     (exit) => console.log(exit)
   )
   /*
   Output:
   {
     "_id": "MicroExit",
     "_tag": "Success",
     "value": "Sunny"
   }
   */
   ```

4. **Adding Error Handling**

   To further enhance the function, you might want to handle specific errors differently.
   Micro provides functions like `Micro.tryPromise` to handle anticipated errors gracefully.

   **Example** (Handling Specific Errors)

   ```ts twoslash collapse={4-14}
   import { Micro } from "effect"

   // Simulate fetching weather data
   function fetchWeather(city: string): Promise<string> {
     return new Promise((resolve, reject) => {
       setTimeout(() => {
         if (city === "London") {
           resolve("Sunny")
         } else {
           reject(new Error("Weather data not found for this location"))
         }
       }, 1_000)
     })
   }

   class WeatherError {
     readonly _tag = "WeatherError"
     constructor(readonly message: string) {}
   }

   function getWeather(city: string) {
     return Micro.tryPromise({
       try: () => fetchWeather(city),
       // remap the error
       catch: (error) => new WeatherError(String(error))
     })
   }

   //      ┌─── Micro<string, WeatherError, never>
   //      ▼
   const weatherEffect = getWeather("Paris")

   Micro.runPromise(weatherEffect)
     .then((data) => console.log(`The weather in London is: ${data}`))
     .catch((error) =>
       console.error(`Failed to fetch weather data: ${error}`)
     )
   /*
   Output:
   Failed to fetch weather data: MicroCause.Fail: {"_tag":"WeatherError","message":"Error: Weather data not found for this location"}
   */
   ```

</Steps>

## Expected Errors

These errors, also referred to as _failures_, _typed errors_
or _recoverable errors_, are errors that developers anticipate as part of the normal program execution.
They serve a similar purpose to checked exceptions and play a role in defining the program's domain and control flow.

Expected errors **are tracked** at the type level by the `Micro` data type in the "Error" channel:

```text showLineNumbers=false "Error"
        ┌─── Represents the success type
        │        ┌─── Represents the error type
        │        │      ┌─── Represents required dependencies
        ▼        ▼      ▼
Micro<Success, Error, Requirements>
```

### either

The `Micro.either` function transforms an `Micro<A, E, R>` into an effect that encapsulates both potential failure and success within an [Either](/docs/data-types/either/) data type:

```ts showLineNumbers=false
Micro<A, E, R> -> Micro<Either<A, E>, never, R>
```

This means if you have an effect with the following type:

```ts showLineNumbers=false
Micro<string, HttpError, never>
```

and you call `Micro.either` on it, the type becomes:

```ts showLineNumbers=false
Micro<Either<string, HttpError>, never, never>
```

The resulting effect cannot fail because the potential failure is now represented within the `Either`'s `Left` type.
The error type of the returned `Micro` is specified as `never`, confirming that the effect is structured to not fail.

By yielding an `Either`, we gain the ability to "pattern match" on this type to handle both failure and success cases within the generator function.

**Example** (Using `Micro.either` to Handle Errors)

```ts twoslash
import { Micro, Either } from "effect"

class HttpError {
  readonly _tag = "HttpError"
}

class ValidationError {
  readonly _tag = "ValidationError"
}

//      ┌─── Micro<string, HttpError | ValidationError, never>
//      ▼
const program = Micro.gen(function* () {
  // Simulate http and validation errors
  if (Math.random() > 0.5) yield* Micro.fail(new HttpError())
  if (Math.random() > 0.5) yield* Micro.fail(new ValidationError())
  return "some result"
})

//      ┌─── Micro<string, never, never>
//      ▼
const recovered = Micro.gen(function* () {
  //      ┌─── Either<string, HttpError | ValidationError>
  //      ▼
  const failureOrSuccess = yield* Micro.either(program)
  return Either.match(failureOrSuccess, {
    // Failure case
    onLeft: (error) => `Recovering from ${error._tag}`,
    // Success case
    onRight: (value) => `Result is: ${value}`
  })
})

Micro.runPromiseExit(recovered).then(console.log)
/*
Example Output:
{
  "_id": "MicroExit",
  "_tag": "Success",
  "value": "Recovering from ValidationError"
}
*/
```

As you can see since all errors are handled, the error type of the resulting effect `recovered` is `never`:

```ts showLineNumbers=false
const recovered: Micro<string, never, never>
```

### catchAll

The `Micro.catchAll` function allows you to catch any error that occurs in the program and provide a fallback.

**Example** (Catching All Errors with `Micro.catchAll`)

```ts twoslash
import { Micro } from "effect"

class HttpError {
  readonly _tag = "HttpError"
}

class ValidationError {
  readonly _tag = "ValidationError"
}

//      ┌─── Micro<string, HttpError | ValidationError, never>
//      ▼
const program = Micro.gen(function* () {
  // Simulate http and validation errors
  if (Math.random() > 0.5) yield* Micro.fail(new HttpError())
  if (Math.random() > 0.5) yield* Micro.fail(new ValidationError())
  return "some result"
})

//      ┌─── Micro<string, never, never>
//      ▼
const recovered = program.pipe(
  Micro.catchAll((error) =>
    Micro.succeed(`Recovering from ${error._tag}`)
  )
)

Micro.runPromiseExit(recovered).then(console.log)
/*
Example Output:
{
  "_id": "MicroExit",
  "_tag": "Success",
  "value": "Recovering from HttpError"
}
*/
```

We can observe that the type in the error channel of our program has changed to `never`:

```ts showLineNumbers=false
const recovered: Micro<string, never, never>
```

indicating that all errors have been handled.

### catchTag

If your program's errors are **all tagged** with a `_tag` field that acts as a discriminator you can use the `Effect.catchTag` function to catch and handle specific errors with precision.

**Example** (Handling Errors by Tag with `Micro.catchTag`)

```ts twoslash
import { Micro } from "effect"

class HttpError {
  readonly _tag = "HttpError"
}

class ValidationError {
  readonly _tag = "ValidationError"
}

//      ┌─── Micro<string, HttpError | ValidationError, never>
//      ▼
const program = Micro.gen(function* () {
  // Simulate http and validation errors
  if (Math.random() > 0.5) yield* Micro.fail(new HttpError())
  if (Math.random() > 0.5) yield* Micro.fail(new ValidationError())
  return "Success"
})

//      ┌─── Micro<string, ValidationError, never>
//      ▼
const recovered = program.pipe(
  Micro.catchTag("HttpError", (_HttpError) =>
    Micro.succeed("Recovering from HttpError")
  )
)

Micro.runPromiseExit(recovered).then(console.log)
/*
Example Output:
{
  "_id": "MicroExit",
  "_tag": "Success",
  "value": "Recovering from HttpError"
}
*/
```

In the example above, the `Micro.catchTag` function allows us to handle `HttpError` specifically.
If a `HttpError` occurs during the execution of the program, the provided error handler function will be invoked,
and the program will proceed with the recovery logic specified within the handler.

We can observe that the type in the error channel of our program has changed to only show `ValidationError`:

```ts showLineNumbers=false
const recovered: Micro<string, ValidationError, never>
```

indicating that `HttpError` has been handled.

## Unexpected Errors

Unexpected errors, also referred to as _defects_, _untyped errors_, or _unrecoverable errors_, are errors that developers
do not anticipate occurring during normal program execution.
Unlike expected errors, which are considered part of a program's domain and control flow,
unexpected errors resemble unchecked exceptions and lie outside the expected behavior of the program.

Since these errors are not expected, Effect **does not track** them at the type level.
However, the Effect runtime does keep track of these errors and provides several methods to aid in recovering from unexpected errors.

### die

The `Micro.die` function returns an effect that throws a specified error. This function is useful for terminating a program when a defect, a critical and unexpected error, is detected in the code.

**Example** (Terminating on Division by Zero with `Effect.die`)

```ts twoslash
import { Micro } from "effect"

const divide = (a: number, b: number): Micro.Micro<number> =>
  b === 0
    ? Micro.die(new Error("Cannot divide by zero"))
    : Micro.succeed(a / b)

Micro.runPromise(divide(1, 0))
/*
throws:
Die [(MicroCause.Die) Error]: Cannot divide by zero
  ...stack trace...
*/
```

### orDie

The `Micro.orDie` function converts an effect's failure into a termination of the program, removing the error from the type of the effect. It is useful when you encounter failures that you do not intend to handle or recover from.

**Example** (Converting Failure to Defect with `Micro.orDie`)

```ts twoslash
import { Micro } from "effect"

const divide = (a: number, b: number): Micro.Micro<number, Error> =>
  b === 0
    ? Micro.fail(new Error("Cannot divide by zero"))
    : Micro.succeed(a / b)

//      ┌─── Micro<number, never, never>
//      ▼
const program = Micro.orDie(divide(1, 0))

Micro.runPromise(program)
/*
throws:
Die [(MicroCause.Die) Error]: Cannot divide by zero
  ...stack trace...
*/
```

### catchAllDefect

The `Micro.catchAllDefect` function allows you to recover from all defects using a provided function.

**Example** (Handling All Defects with `Micro.catchAllDefect`)

```ts twoslash
import { Micro } from "effect"

// Helper function to log a message
const log = (message: string) => Micro.sync(() => console.log(message))

// Simulating a runtime error
const task = Micro.die("Boom!")

const program = Micro.catchAllDefect(task, (defect) =>
  log(`Unknown defect caught: ${defect}`)
)

// We get a Right because we caught all defects
Micro.runPromiseExit(program).then((exit) => console.log(exit))
/*
Output:
Unknown defect caught: Boom!
{
  "_id": "MicroExit",
  "_tag": "Success"
}
*/
```

It's important to understand that `Micro.catchAllDefect` can only handle defects, not expected errors (such as those caused by `Micro.fail`) or interruptions in execution (such as when using `Micro.interrupt`).

A defect refers to an error that cannot be anticipated in advance, and there is no reliable way to respond to it. As a general rule, it's recommended to let defects crash the application, as they often indicate serious issues that need to be addressed.

However, in some specific cases, such as when dealing with dynamically loaded plugins, a controlled recovery approach might be necessary. For example, if our application supports runtime loading of plugins and a defect occurs within a plugin, we may choose to log the defect and then reload only the affected plugin instead of crashing the entire application. This allows for a more resilient and uninterrupted operation of the application.

## Fallback

### orElseSucceed

The `Effect.orElseSucceed` function will replace the original failure with a success value, ensuring the effect cannot fail:

**Example** (Replacing Failure with Success using `Micro.orElseSucceed`)

```ts twoslash
import { Micro } from "effect"

const validate = (age: number): Micro.Micro<number, string> => {
  if (age < 0) {
    return Micro.fail("NegativeAgeError")
  } else if (age < 18) {
    return Micro.fail("IllegalAgeError")
  } else {
    return Micro.succeed(age)
  }
}

const program = Micro.orElseSucceed(validate(-1), () => 18)

console.log(Micro.runSyncExit(program))
/*
Output:
{
  "_id": "MicroExit",
  "_tag": "Success",
  "value": 18
}
*/
```

## Matching

### match

The `Micro.match` function lets you handle both success and failure cases without performing side effects. You provide a handler for each case.

**Example** (Handling Both Success and Failure Cases)

```ts twoslash
import { Micro } from "effect"

const success: Micro.Micro<number, Error> = Micro.succeed(42)

const program1 = Micro.match(success, {
  onFailure: (error) => `failure: ${error.message}`,
  onSuccess: (value) => `success: ${value}`
})

// Run and log the result of the successful effect
Micro.runPromise(program1).then(console.log)
// Output: "success: 42"

const failure: Micro.Micro<number, Error> = Micro.fail(
  new Error("Uh oh!")
)

const program2 = Micro.match(failure, {
  onFailure: (error) => `failure: ${error.message}`,
  onSuccess: (value) => `success: ${value}`
})

// Run and log the result of the failed effect
Micro.runPromise(program2).then(console.log)
// Output: "failure: Uh oh!"
```

### matchEffect

The `Micro.matchEffect` function, similar to `Micro.match`, allows you to handle both success and failure cases, but it also enables you to perform additional side effects within those handlers.

**Example** (Handling Success and Failure with Side Effects)

```ts twoslash
import { Micro } from "effect"

// Helper function to log a message
const log = (message: string) => Micro.sync(() => console.log(message))

const success: Micro.Micro<number, Error> = Micro.succeed(42)
const failure: Micro.Micro<number, Error> = Micro.fail(
  new Error("Uh oh!")
)

const program1 = Micro.matchEffect(success, {
  onFailure: (error) =>
    Micro.succeed(`failure: ${error.message}`).pipe(Micro.tap(log)),
  onSuccess: (value) =>
    Micro.succeed(`success: ${value}`).pipe(Micro.tap(log))
})

Micro.runSync(program1)
/*
Output:
success: 42
*/

const program2 = Micro.matchEffect(failure, {
  onFailure: (error) =>
    Micro.succeed(`failure: ${error.message}`).pipe(Micro.tap(log)),
  onSuccess: (value) =>
    Micro.succeed(`success: ${value}`).pipe(Micro.tap(log))
})

Micro.runSync(program2)
/*
Output:
failure: Uh oh!
*/
```

### matchCause / matchCauseEffect

The `Micro.matchCause` and `Micro.matchCauseEffect` functions allow you to handle failures more precisely by providing access to the complete cause of failure within a fiber. This makes it possible to differentiate between various failure types and respond accordingly.

**Example** (Handling Different Failure Causes with `Micro.matchCauseEffect`)

```ts twoslash
import { Micro } from "effect"

// Helper function to log a message
const log = (message: string) => Micro.sync(() => console.log(message))

const task: Micro.Micro<number, Error> = Micro.die("Uh oh!")

const program = Micro.matchCauseEffect(task, {
  onFailure: (cause) => {
    switch (cause._tag) {
      case "Fail":
        // Handle standard failure with a logged message
        return log(`Fail: ${cause.error.message}`)
      case "Die":
        // Handle defects (unexpected errors) by logging the defect
        return log(`Die: ${cause.defect}`)
      case "Interrupt":
        // Handle interruption
        return log("Interrupt")
    }
  },
  onSuccess: (value) =>
    // Log success if the task completes successfully
    log(`succeeded with ${value} value`)
})

Micro.runSync(program)
// Output: "Die: Uh oh!"
```

## Retrying

### retry

The `Micro.retry` function allows you to retry a failing effect according to a defined policy.

**Example** (Retrying with a Fixed Delay)

```ts twoslash
import { Micro } from "effect"

let count = 0

// Simulates an effect with possible failures
const effect = Micro.async<string, Error>((resume) => {
  if (count <= 2) {
    count++
    console.log("failure")
    resume(Micro.fail(new Error()))
  } else {
    console.log("success")
    resume(Micro.succeed("yay!"))
  }
})

// Define a repetition policy using a spaced delay between retries
const policy = Micro.scheduleSpaced(100)

const repeated = Micro.retry(effect, { schedule: policy })

Micro.runPromise(repeated).then(console.log)
/*
Output:
failure
failure
failure
success
yay!
*/
```

## Timing out

When an operation does not finish within the specified duration, the behavior of the `Micro.timeout` depends on whether the operation is "uninterruptible".

<Aside type="note" title="Uninterruptible Effects">
  An uninterruptible effect is one that, once started, cannot be stopped
  mid-execution by the timeout mechanism directly. This could be because
  the operations within the effect need to run to completion to avoid
  leaving the system in an inconsistent state.
</Aside>

1. **Interruptible Operation**: If the operation can be interrupted, it is terminated immediately once the timeout threshold is reached, resulting in a `TimeoutException`.

   ```ts twoslash
   import { Micro } from "effect"

   const task = Micro.gen(function* () {
     console.log("Start processing...")
     yield* Micro.sleep(2_000) // Simulates a delay in processing
     console.log("Processing complete.")
     return "Result"
   })

   const timedEffect = task.pipe(Micro.timeout(1_000))

   Micro.runPromiseExit(timedEffect).then(console.log)
   /*
   Output:
   Start processing...
   {
     "_id": "MicroExit",
     "_tag": "Failure",
     "cause": {
       "_tag": "Fail",
       "traces": [],
       "name": "(MicroCause.Fail) TimeoutException",
       "error": {
         "_tag": "TimeoutException"
       }
     }
   }
   */
   ```

2. **Uninterruptible Operation**: If the operation is uninterruptible, it continues until completion before the `TimeoutException` is assessed.

   ```ts twoslash
   import { Micro } from "effect"

   const task = Micro.gen(function* () {
     console.log("Start processing...")
     yield* Micro.sleep(2_000) // Simulates a delay in processing
     console.log("Processing complete.")
     return "Result"
   })

   const timedEffect = task.pipe(
     Micro.uninterruptible,
     Micro.timeout(1_000)
   )

   // Outputs a TimeoutException after the task completes,
   // because the task is uninterruptible
   Micro.runPromiseExit(timedEffect).then(console.log)
   /*
   Output:
   Start processing...
   Processing complete.
   {
     "_id": "MicroExit",
     "_tag": "Failure",
     "cause": {
       "_tag": "Fail",
       "traces": [],
       "name": "(MicroCause.Fail) TimeoutException",
       "error": {
         "_tag": "TimeoutException"
       }
     }
   }
   */
   ```

## Sandboxing

The `Micro.sandbox` function allows you to encapsulate all the potential causes of an error in an effect. It exposes the full cause of an effect, whether it's due to a failure, defect or interruption.

In simple terms, it takes an effect `Micro<A, E, R>` and transforms it into an effect `Micro<A, MicroCause<E>, R>` where the error channel now contains a detailed cause of the error.

```ts twoslash
import { Micro } from "effect"

// Helper function to log a message
const log = (message: string) => Micro.sync(() => console.log(message))

//      ┌─── Micro<string, Error, never>
//      ▼
const task = Micro.fail(new Error("Oh uh!")).pipe(
  Micro.as("primary result")
)

//      ┌─── Effect<string, MicroCause<Error>, never>
//      ▼
const sandboxed = Micro.sandbox(task)

const program = sandboxed.pipe(
  Micro.catchTag("Fail", (cause) =>
    log(`Caught a defect: ${cause.error}`).pipe(
      Micro.as("fallback result on expected error")
    )
  ),
  Micro.catchTag("Interrupt", () =>
    log(`Caught a defect`).pipe(
      Micro.as("fallback result on fiber interruption")
    )
  ),
  Micro.catchTag("Die", (cause) =>
    log(`Caught a defect: ${cause.defect}`).pipe(
      Micro.as("fallback result on unexpected error")
    )
  )
)

Micro.runPromise(program).then(console.log)
/*
Output:
Caught a defect: Error: Oh uh!
fallback result on expected error
*/
```

## Inspecting Errors

### tapError

Executes an effectful operation to inspect the failure of an effect without altering it.

**Example** (Inspecting Errors)

```ts twoslash
import { Micro } from "effect"

// Helper function to log a message
const log = (message: string) => Micro.sync(() => console.log(message))

// Simulate a task that fails with an error
const task: Micro.Micro<number, string> = Micro.fail("NetworkError")

// Use tapError to log the error message when the task fails
const tapping = Micro.tapError(task, (error) =>
  log(`expected error: ${error}`)
)

Micro.runFork(tapping)
/*
Output:
expected error: NetworkError
*/
```

### tapErrorCause

This function inspects the complete cause of an error, including failures and defects.

**Example** (Inspecting Error Causes)

```ts twoslash
import { Micro } from "effect"

// Helper function to log a message
const log = (message: string) => Micro.sync(() => console.log(message))

// Create a task that fails with a NetworkError
const task1: Micro.Micro<number, string> = Micro.fail("NetworkError")

const tapping1 = Micro.tapErrorCause(task1, (cause) =>
  log(`error cause: ${cause}`)
)

Micro.runFork(tapping1)
/*
Output:
error cause: MicroCause.Fail: NetworkError
*/

// Simulate a severe failure in the system
const task2: Micro.Micro<number, string> = Micro.die(
  "Something went wrong"
)

const tapping2 = Micro.tapErrorCause(task2, (cause) =>
  log(`error cause: ${cause}`)
)

Micro.runFork(tapping2)
/*
Output:
error cause: MicroCause.Die: Something went wrong
*/
```

### tapDefect

Specifically inspects non-recoverable failures or defects in an effect (i.e., one or more [Die](/docs/data-types/cause/#die) causes).

**Example** (Inspecting Defects)

```ts twoslash
import { Micro } from "effect"

// Helper function to log a message
const log = (message: string) => Micro.sync(() => console.log(message))

// Simulate a task that fails with a recoverable error
const task1: Micro.Micro<number, string> = Micro.fail("NetworkError")

// tapDefect won't log anything because NetworkError is not a defect
const tapping1 = Micro.tapDefect(task1, (cause) =>
  log(`defect: ${cause}`)
)

Micro.runFork(tapping1)
/*
No Output
*/

// Simulate a severe failure in the system
const task2: Micro.Micro<number, string> = Micro.die(
  "Something went wrong"
)

// Log the defect using tapDefect
const tapping2 = Micro.tapDefect(task2, (cause) =>
  log(`defect: ${cause}`)
)

Micro.runFork(tapping2)
/*
Output:
defect: Something went wrong
*/
```

## Yieldable Errors

Yieldable Errors are special types of errors that can be yielded directly within a generator function using `Micro.gen`.
These errors allow you to handle them intuitively, without needing to explicitly invoke `Micro.fail`. This simplifies how you manage custom errors in your code.

### Error

The `Error` constructor provides a way to define a base class for yieldable errors.

**Example** (Creating and Yielding a Custom Error)

```ts twoslash
import { Micro } from "effect"

// Define a custom error class extending Error
class MyError extends Micro.Error<{ message: string }> {}

export const program = Micro.gen(function* () {
  // Yield a custom error (equivalent to failing with MyError)
  yield* new MyError({ message: "Oh no!" })
})

Micro.runPromiseExit(program).then(console.log)
/*
Output:
{
  "_id": "MicroExit",
  "_tag": "Failure",
  "cause": {
    "_tag": "Fail",
    "traces": [],
    "name": "(MicroCause.Fail) Error",
    "error": {
      "message": "Oh no!"
    }
  }
}
*/
```

### TaggedError

The `TaggedError` constructor lets you define custom yieldable errors with unique tags. Each error has a `_tag` property, allowing you to easily distinguish between different error types. This makes it convenient to handle specific tagged errors using functions like `Micro.catchTag`.

**Example** (Handling Multiple Tagged Errors)

```ts twoslash
import { Micro } from "effect"

// An error with _tag: "Foo"
class FooError extends Micro.TaggedError("Foo")<{
  message: string
}> {}

// An error with _tag: "Bar"
class BarError extends Micro.TaggedError("Bar")<{
  randomNumber: number
}> {}

export const program = Micro.gen(function* () {
  const n = Math.random()
  return n > 0.5
    ? "yay!"
    : n < 0.2
    ? yield* new FooError({ message: "Oh no!" })
    : yield* new BarError({ randomNumber: n })
}).pipe(
  // Handle different tagged errors using catchTag
  Micro.catchTag("Foo", (error) =>
    Micro.succeed(`Foo error: ${error.message}`)
  ),
  Micro.catchTag("Bar", (error) =>
    Micro.succeed(`Bar error: ${error.randomNumber}`)
  )
)

Micro.runPromise(program).then(console.log, console.error)
/*
Example Output (n < 0.2):
Foo error: Oh no!
*/
```

## Requirements Management

In the context of programming, a **service** refers to a reusable component or functionality that can be used by different parts of an application.
Services are designed to provide specific capabilities and can be shared across multiple modules or components.

Services often encapsulate common tasks or operations that are needed by different parts of an application.
They can handle complex operations, interact with external systems or APIs, manage data, or perform other specialized tasks.

Services are typically designed to be modular and decoupled from the rest of the application.
This allows them to be easily maintained, tested, and replaced without affecting the overall functionality of the application.

To create a new service, you need two things:

- A unique identifier.
- A type describing the possible operations of the service.

```ts twoslash
import { Micro, Context } from "effect"

// Declaring a tag for a service that generates random numbers
class Random extends Context.Tag("MyRandomService")<
  Random,
  { readonly next: Micro.Micro<number> }
>() {}
```

Now that we have our service tag defined, let's see how we can use it by building a simple program.

**Example** (Using a Custom Service in a Program)

```ts twoslash
import * as Context from "effect/Context"
import { Micro } from "effect"

// Declaring a tag for a service that generates random numbers
class Random extends Context.Tag("MyRandomService")<
  Random,
  { readonly next: Micro.Micro<number> }
>() {}

// Using the service
//
//      ┌─── Micro<void, never, Random>
//      ▼
const program = Micro.gen(function* () {
  // Access the Random service
  const random = yield* Micro.service(Random)

  // Retrieve a random number from the service
  const randomNumber = yield* random.next

  console.log(`random number: ${randomNumber}`)
})
```

It's worth noting that the type of the `program` variable includes `Random` in the `Requirements` type parameter:

```ts "Random" showLineNumbers=false
const program: Micro<void, never, Random>
```

This indicates that our program requires the `Random` service to be provided in order to execute successfully.

To successfully execute the program, we need to provide an actual implementation of the `Random` service.

**Example** (Providing and Using a Service)

```ts twoslash
import { Micro, Context } from "effect"

// Declaring a tag for a service that generates random numbers
class Random extends Context.Tag("MyRandomService")<
  Random,
  { readonly next: Micro.Micro<number> }
>() {}

// Using the service
const program = Micro.gen(function* () {
  // Access the Random service
  const random = yield* Micro.service(Random)

  // Retrieve a random number from the service
  const randomNumber = yield* random.next

  console.log(`random number: ${randomNumber}`)
})

// Providing the implementation
//
//      ┌─── Micro<void, never, never>
//      ▼
const runnable = Micro.provideService(program, Random, {
  next: Micro.sync(() => Math.random())
})

Micro.runPromise(runnable)
/*
Example Output:
random number: 0.8241872233134417
*/
```

## Resource Management

### MicroScope

In simple terms, a `MicroScope` represents the lifetime of one or more resources. When a scope is closed, the resources associated with it are guaranteed to be released.

With the `MicroScope` data type, you can:

- **Add finalizers**: A finalizer specifies the cleanup logic for a resource.
- **Close the scope**: When the scope is closed, all resources are released, and the finalizers are executed.

**Example** (Managing a Scope)

```ts twoslash
import { Micro } from "effect"

// Helper function to log a message
const log = (message: string) => Micro.sync(() => console.log(message))

const program =
  // create a new scope
  Micro.scopeMake.pipe(
    // add finalizer 1
    Micro.tap((scope) => scope.addFinalizer(() => log("finalizer 1"))),
    // add finalizer 2
    Micro.tap((scope) => scope.addFinalizer(() => log("finalizer 2"))),
    // close the scope
    Micro.andThen((scope) =>
      scope.close(Micro.exitSucceed("scope closed successfully"))
    )
  )

Micro.runPromise(program)
/*
Output:
finalizer 2 <-- finalizers are closed in reverse order
finalizer 1
*/
```

In the above example, finalizers are added to the scope, and when the scope is closed, the finalizers are **executed in the reverse order**.

This reverse order is important because it ensures that resources are released in the correct sequence.

For instance, if you acquire a network connection and then access a file on a remote server, the file must be closed before the network connection to avoid errors.

### addFinalizer

The `Micro.addFinalizer` function is a high-level API that allows you to add finalizers to the scope of an effect. A finalizer is a piece of code that is guaranteed to run when the associated scope is closed. The behavior of the finalizer can vary based on the `MicroExit` value, which represents how the scope was closed—whether successfully or with an error.

**Example** (Adding a Finalizer on Success)

```ts twoslash
import { Micro } from "effect"

// Helper function to log a message
const log = (message: string) => Micro.sync(() => console.log(message))

//      ┌─── Micro<string, never, MicroScope>
//      ▼
const program = Micro.gen(function* () {
  yield* Micro.addFinalizer((exit) => log(`finalizer after ${exit._tag}`))
  return "some result"
})

//      ┌─── Micro<string, never, never>
//      ▼
const runnable = Micro.scoped(program)

Micro.runPromise(runnable).then(console.log, console.error)
/*
Output:
finalizer after Success
some result
*/
```

Next, let's explore how things behave in the event of a failure:

**Example** (Adding a Finalizer on Failure)

```ts twoslash
import { Micro } from "effect"

// Helper function to log a message
const log = (message: string) => Micro.sync(() => console.log(message))

const program = Micro.gen(function* () {
  yield* Micro.addFinalizer((exit) => log(`finalizer after ${exit._tag}`))
  return yield* Micro.fail("Uh oh!")
})

const runnable = Micro.scoped(program)

Micro.runPromiseExit(runnable).then(console.log)
/*
Output:
finalizer after Failure
{
  "_id": "MicroExit",
  "_tag": "Failure",
  "cause": {
    "_tag": "Fail",
    "traces": [],
    "name": "MicroCause.Fail",
    "error": "Uh oh!"
  }
}
*/
```

### Defining Resources

We can define a resource using operators like `Micro.acquireRelease(acquire, release)`, which allows us to create a scoped value from an `acquire` and `release` workflow.

Every acquire release requires three actions:

- **Acquiring Resource**. An effect describing the acquisition of resource. For example, opening a file.
- **Using Resource**. An effect describing the actual process to produce a result. For example, counting the number of lines in a file.
- **Releasing Resource**. An effect describing the final step of releasing or cleaning up the resource. For example, closing a file.

The `Micro.acquireRelease` operator performs the `acquire` workflow **uninterruptibly**.
This is important because if we allowed interruption during resource acquisition we could be interrupted when the resource was partially acquired.

The guarantee of the `Micro.acquireRelease` operator is that if the `acquire` workflow successfully completes execution then the `release` workflow is guaranteed to be run when the `Scope` is closed.

**Example** (Defining a Simple Resource)

```ts twoslash
import { Micro } from "effect"

// Define an interface for a resource
interface MyResource {
  readonly contents: string
  readonly close: () => Promise<void>
}

// Simulate resource acquisition
const getMyResource = (): Promise<MyResource> =>
  Promise.resolve({
    contents: "lorem ipsum",
    close: () =>
      new Promise((resolve) => {
        console.log("Resource released")
        resolve()
      })
  })

// Define how the resource is acquired
const acquire = Micro.tryPromise({
  try: () =>
    getMyResource().then((res) => {
      console.log("Resource acquired")
      return res
    }),
  catch: () => new Error("getMyResourceError")
})

// Define how the resource is released
const release = (res: MyResource) => Micro.promise(() => res.close())

// Create the resource management workflow
//
//      ┌─── Micro<MyResource, Error, MicroScope>
//      ▼
const resource = Micro.acquireRelease(acquire, release)

//      ┌─── Micro<void, Error, never>
//      ▼
const program = Micro.scoped(
  Micro.gen(function* () {
    const res = yield* resource
    console.log(`content is ${res.contents}`)
  })
)

Micro.runPromise(program)
/*
Resource acquired
content is lorem ipsum
Resource released
*/
```

The `Micro.scoped` operator removes the `MicroScope` from the context, indicating that there are no longer any resources used by this workflow which require a scope.

### acquireUseRelease

The `Micro.acquireUseRelease(acquire, use, release)` function is a specialized version of the `Micro.acquireRelease` function that simplifies resource management by automatically handling the scoping of resources.

The main difference is that `acquireUseRelease` eliminates the need to manually call `Micro.scoped` to manage the resource's scope. It has additional knowledge about when you are done using the resource created with the `acquire` step. This is achieved by providing a `use` argument, which represents the function that operates on the acquired resource. As a result, `acquireUseRelease` can automatically determine when it should execute the release step.

**Example** (Automatically Managing Resource Lifetime)

```ts twoslash
import { Micro } from "effect"

// Define the interface for the resource
interface MyResource {
  readonly contents: string
  readonly close: () => Promise<void>
}

// Simulate getting the resource
const getMyResource = (): Promise<MyResource> =>
  Promise.resolve({
    contents: "lorem ipsum",
    close: () =>
      new Promise((resolve) => {
        console.log("Resource released")
        resolve()
      })
  })

// Define the acquisition of the resource with error handling
const acquire = Micro.tryPromise({
  try: () =>
    getMyResource().then((res) => {
      console.log("Resource acquired")
      return res
    }),
  catch: () => new Error("getMyResourceError")
})

// Define the release of the resource
const release = (res: MyResource) => Micro.promise(() => res.close())

const use = (res: MyResource) =>
  Micro.sync(() => console.log(`content is ${res.contents}`))

//      ┌─── Micro<void, Error, never>
//      ▼
const program = Micro.acquireUseRelease(acquire, use, release)

Micro.runPromise(program)
/*
Resource acquired
content is lorem ipsum
Resource released
*/
```

## Scheduling

### MicroSchedule

The `MicroSchedule` type represents a function that can be used to calculate the delay between
repeats.

```ts showLineNumbers=false
type MicroSchedule = (attempt: number, elapsed: number) => Option<number>
```

The function takes the current attempt number and the elapsed time since
the first attempt, and returns the delay for the next attempt. If the
function returns `None`, the repetition will stop.

### repeat

The `Micro.repeat` function returns a new effect that repeats the given effect according to a specified schedule or until the first failure.

<Aside type="note" title="Initial Execution Included">
  The scheduled recurrences are in addition to the initial execution, so
  `Micro.repeat(action, Micro.scheduleRecurs(1))` executes `action` once
  initially, and if it succeeds, repeats it an additional time.
</Aside>

**Example** (Repeating a Successful Effect)

```ts twoslash
import { Micro } from "effect"

// Define an effect that logs a message to the console
const action = Micro.sync(() => console.log("success"))

// Define a schedule that repeats the action 2 more times with a delay
const policy = Micro.scheduleAddDelay(Micro.scheduleRecurs(2), () => 100)

// Repeat the action according to the schedule
const program = Micro.repeat(action, { schedule: policy })

Micro.runPromise(program)
/*
Output:
success
success
success
*/
```

**Example** (Handling Failures in Repetition)

```ts twoslash
import { Micro } from "effect"

let count = 0

// Define an async effect that simulates an action with potential failure
const action = Micro.async<string, string>((resume) => {
  if (count > 1) {
    console.log("failure")
    resume(Micro.fail("Uh oh!"))
  } else {
    count++
    console.log("success")
    resume(Micro.succeed("yay!"))
  }
})

// Define a schedule that repeats the action 2 more times with a delay
const policy = Micro.scheduleAddDelay(Micro.scheduleRecurs(2), () => 100)

// Repeat the action according to the schedule
const program = Micro.repeat(action, { schedule: policy })

// Run the program and observe the result on failure
Micro.runPromiseExit(program).then(console.log)
/*
Output:
success
success
failure
{
  "_id": "MicroExit",
  "_tag": "Failure",
  "cause": {
    "_tag": "Fail",
    "traces": [],
    "name": "MicroCause.Fail",
    "error": "Uh oh!"
  }
}
*/
```

### Simulating Schedule Behavior

This helper function, `dryRun`, demonstrates how different scheduling policies control repetition timing without executing an actual effect. By returning an array of delay intervals, it visualizes how a schedule would space repetitions.

```ts twoslash
import { Option, Micro } from "effect"

// Helper function to simulate and visualize a schedule's behavior
const dryRun = (
  schedule: Micro.MicroSchedule, // The scheduling policy to simulate
  maxAttempt: number = 7 // Maximum number of repetitions to simulate
): Array<number> => {
  let attempt = 1 // Track the current attempt number
  let elapsed = 0 // Track the total elapsed time
  const out: Array<number> = [] // Array to store each delay duration
  let duration = schedule(attempt, elapsed)

  // Continue until the schedule returns no delay or maxAttempt is reached
  while (Option.isSome(duration) && attempt <= maxAttempt) {
    const value = duration.value
    out.push(value)
    attempt++
    elapsed += value

    // Get the next duration based on the current attempt
    // and total elapsed time
    duration = schedule(attempt, elapsed)
  }

  return out
}
```

### scheduleSpaced

A schedule that repeats indefinitely, each repetition spaced the specified duration from the last run.

**Example** (Recurring with Delay Between Executions)

```ts twoslash collapse={5-21}
import { Micro } from "effect"
import * as Option from "effect/Option"

// Helper function to simulate and visualize a schedule's behavior
const dryRun = (
  schedule: Micro.MicroSchedule,
  maxAttempt: number = 7
): Array<number> => {
  let attempt = 1
  let elapsed = 0
  const out: Array<number> = []
  let duration = schedule(attempt, elapsed)
  while (Option.isSome(duration) && attempt <= maxAttempt) {
    const value = duration.value
    attempt++
    elapsed += value
    out.push(value)
    duration = schedule(attempt, elapsed)
  }
  return out
}

const policy = Micro.scheduleSpaced(10)

console.log(dryRun(policy))
/*
Output:
[
  10, 10, 10, 10,
  10, 10, 10
]
*/
```

### scheduleExponential

A schedule that recurs using exponential backoff, with each delay increasing exponentially.

**Example** (Exponential Backoff Schedule)

```ts twoslash collapse={5-21}
import { Micro } from "effect"
import * as Option from "effect/Option"

// Helper function to simulate and visualize a schedule's behavior
const dryRun = (
  schedule: Micro.MicroSchedule,
  maxAttempt: number = 7
): Array<number> => {
  let attempt = 1
  let elapsed = 0
  const out: Array<number> = []
  let duration = schedule(attempt, elapsed)
  while (Option.isSome(duration) && attempt <= maxAttempt) {
    const value = duration.value
    attempt++
    elapsed += value
    out.push(value)
    duration = schedule(attempt, elapsed)
  }
  return out
}

const policy = Micro.scheduleExponential(10)

console.log(dryRun(policy))
/*
Output:
[
    20,  40,  80,
   160, 320, 640,
  1280
]
*/
```

### scheduleUnion

Combines two schedules using union. The schedule recurs as long as one of the schedules wants to, using the minimum delay between recurrences.

**Example** (Union of Exponential and Spaced Schedules)

```ts twoslash collapse={5-21}
import { Micro } from "effect"
import * as Option from "effect/Option"

// Helper function to simulate and visualize a schedule's behavior
const dryRun = (
  schedule: Micro.MicroSchedule,
  maxAttempt: number = 7
): Array<number> => {
  let attempt = 1
  let elapsed = 0
  const out: Array<number> = []
  let duration = schedule(attempt, elapsed)
  while (Option.isSome(duration) && attempt <= maxAttempt) {
    const value = duration.value
    attempt++
    elapsed += value
    out.push(value)
    duration = schedule(attempt, elapsed)
  }
  return out
}

const policy = Micro.scheduleUnion(
  Micro.scheduleExponential(10),
  Micro.scheduleSpaced(300)
)

console.log(dryRun(policy))
/*
Output:
[
  20,  < exponential
  40,
  80,
  160,
  300, < spaced
  300,
  300
]
*/
```

### scheduleIntersect

Combines two schedules using intersection. The schedule recurs only if both schedules want to continue, using the maximum delay between them.

**Example** (Intersection of Exponential and Recurs Schedules)

```ts twoslash collapse={5-21}
import { Micro } from "effect"
import * as Option from "effect/Option"

// Helper function to simulate and visualize a schedule's behavior
const dryRun = (
  schedule: Micro.MicroSchedule,
  maxAttempt: number = 7
): Array<number> => {
  let attempt = 1
  let elapsed = 0
  const out: Array<number> = []
  let duration = schedule(attempt, elapsed)
  while (Option.isSome(duration) && attempt <= maxAttempt) {
    const value = duration.value
    attempt++
    elapsed += value
    out.push(value)
    duration = schedule(attempt, elapsed)
  }
  return out
}

const policy = Micro.scheduleIntersect(
  Micro.scheduleExponential(10),
  Micro.scheduleSpaced(300)
)

console.log(dryRun(policy))
/*
Output:
[
  300, < spaced
  300,
  300,
  300,
  320, < exponential
  640,
  1280
]
*/
```

## Concurrency

### Forking Effects

One of the fundamental ways to create a fiber is by forking an existing effect.
When you fork an effect, it starts executing the effect on a new fiber, giving you a reference to this newly-created fiber.

The following code demonstrates how to create a single fiber using the `Micro.fork` function. This fiber will execute the function `fib(100)` independently of the main fiber:

**Example** (Forking a Fiber)

```ts twoslash
import { Micro } from "effect"

const fib = (n: number): Micro.Micro<number> =>
  n < 2
    ? Micro.succeed(n)
    : Micro.zipWith(fib(n - 1), fib(n - 2), (a, b) => a + b)

//      ┌─── Micro<MicroFiber<number, never>, never, never>
//      ▼
const fib10Fiber = Micro.fork(fib(10))
```

### Joining Fibers

A common operation with fibers is joining them using the `Micro.fiberJoin` function.
This function returns a `Micro` that will succeed or fail based on the outcome of the fiber it joins:

**Example** (Joining a Fiber)

```ts twoslash
import { Micro } from "effect"

const fib = (n: number): Micro.Micro<number> =>
  n < 2
    ? Micro.succeed(n)
    : Micro.zipWith(fib(n - 1), fib(n - 2), (a, b) => a + b)

//      ┌─── Micro<MicroFiber<number, never>, never, never>
//      ▼
const fib10Fiber = Micro.fork(fib(10))

const program = Micro.gen(function* () {
  // Retrieve the fiber
  const fiber = yield* fib10Fiber
  // Join the fiber and get the result
  const n = yield* Micro.fiberJoin(fiber)
  console.log(n)
})

Micro.runPromise(program)
// Output: 55
```

### Awaiting Fibers

Another useful function for fibers is `Micro.fiberAwait`.
This function returns an effect containing a `MicroExit` value, which provides detailed information about how the fiber completed.

**Example** (Awaiting Fiber Completion)

```ts twoslash
import { Micro } from "effect"

const fib = (n: number): Micro.Micro<number> =>
  n < 2
    ? Micro.succeed(n)
    : Micro.zipWith(fib(n - 1), fib(n - 2), (a, b) => a + b)

//      ┌─── Micro<MicroFiber<number, never>, never, never>
//      ▼
const fib10Fiber = Micro.fork(fib(10))

const program = Micro.gen(function* () {
  // Retrieve the fiber
  const fiber = yield* fib10Fiber
  // Await its completion and get the MicroExit result
  const exit = yield* Micro.fiberAwait(fiber)
  console.log(exit)
})

Micro.runPromise(program)
/*
Output:
{
  "_id": "MicroExit",
  "_tag": "Success",
  "value": 55
}
*/
```

## Interruptions

All effects in Effect are executed by fibers. If you didn't create the fiber yourself, it was created by an operation you're using (if it's concurrent) or by the Effect runtime system.

A fiber is created any time an effect is run. When running effects concurrently, a fiber is created for each concurrent effect.

To summarize:

- A `Micro` is a higher-level concept that describes an effectful computation. It is lazy and immutable, meaning it represents a computation that may produce a value or fail but does not immediately execute.
- A fiber, on the other hand, represents the running execution of a `Micro`. It can be interrupted or awaited to retrieve its result. Think of it as a way to control and interact with the ongoing computation.

Fibers can be interrupted in various ways. Let's explore some of these scenarios and see examples of how to interrupt fibers in Effect.

### Interrupting Fibers

If a fiber's result is no longer needed, it can be interrupted, which immediately terminates the fiber and safely releases all resources by running all finalizers.

Similar to `.await`, `.interrupt` returns a `MicroExit` value describing how the fiber completed.

**Example** (Interrupting a Fiber)

```ts twoslash
import { Micro } from "effect"

const program = Micro.gen(function* () {
  // Fork a fiber that runs indefinitely, printing "Hi!"
  const fiber = yield* Micro.fork(
    Micro.forever(
      Micro.sync(() => console.log("Hi!")).pipe(Micro.delay(10))
    )
  )
  yield* Micro.sleep(30)
  // Interrupt the fiber
  yield* Micro.fiberInterrupt(fiber)
})

Micro.runPromise(program)
/*
Output:
Hi!
Hi!
*/
```

### Micro.interrupt

A fiber can be interrupted using the `Micro.interrupt` effect on that particular fiber.

**Example** (Without Interruption)

In this case, the program runs without any interruption, logging the start and completion of the task.

```ts twoslash
import { Micro } from "effect"

const program = Micro.gen(function* () {
  console.log("start")
  yield* Micro.sleep(2_000)
  console.log("done")
})

Micro.runPromiseExit(program).then(console.log)
/*
Output:
start
done
{
  "_id": "MicroExit",
  "_tag": "Success"
}
*/
```

**Example** (With Interruption)

Here, the fiber is interrupted after the log `"start"` but before the `"done"` log. The `Effect.interrupt` stops the fiber, and it never reaches the final log.

```ts {6} twoslash
import { Micro } from "effect"

const program = Micro.gen(function* () {
  console.log("start")
  yield* Micro.sleep(2_000)
  yield* Micro.interrupt
  console.log("done")
})

Micro.runPromiseExit(program).then(console.log)
/*
Output:
start
{
  "_id": "MicroExit",
  "_tag": "Failure",
  "cause": {
    "_tag": "Interrupt",
    "traces": [],
    "name": "MicroCause.Interrupt"
  }
}
*/
```

When a fiber is interrupted, the cause of the interruption is captured, including details like the fiber's ID and when it started.

### Interruption of Concurrent Effects

When running multiple effects concurrently, such as with `Micro.forEach`, if one of the effects is interrupted, it causes all concurrent effects to be interrupted as well.

**Example** (Interrupting Concurrent Effects)

```ts twoslash
import { Micro } from "effect"

const program = Micro.forEach(
  [1, 2, 3],
  (n) =>
    Micro.gen(function* () {
      console.log(`start #${n}`)
      yield* Micro.sleep(2 * 1_000)
      if (n > 1) {
        yield* Micro.interrupt
      }
      console.log(`done #${n}`)
    }),
  { concurrency: "unbounded" }
)

Micro.runPromiseExit(program).then((exit) =>
  console.log(JSON.stringify(exit, null, 2))
)
/*
Output:
start #1
start #2
start #3
done #1
{
  "_id": "MicroExit",
  "_tag": "Failure",
  "cause": {
    "_tag": "Interrupt",
    "traces": [],
    "name": "MicroCause.Interrupt"
  }
}
*/
```

## Racing

The `Effect.race` function allows you to run multiple effects concurrently, returning the result of the first one that successfully completes.

**Example** (Basic Race Between Effects)

```ts twoslash
import { Micro } from "effect"

const task1 = Micro.delay(Micro.fail("task1"), 1_000)
const task2 = Micro.delay(Micro.succeed("task2"), 2_000)

// Run both tasks concurrently and return
// the result of the first to complete
const program = Micro.race(task1, task2)

Micro.runPromise(program).then(console.log)
/*
Output:
task2
*/
```

If you want to handle the result of whichever task completes first, whether it succeeds or fails, you can use the `Micro.either` function. This function wraps the result in an [Either](/docs/data-types/either/) type, allowing you to see if the result was a success (`Right`) or a failure (`Left`):

**Example** (Handling Success or Failure with Either)

```ts twoslash
import { Micro } from "effect"

const task1 = Micro.delay(Micro.fail("task1"), 1_000)
const task2 = Micro.delay(Micro.succeed("task2"), 2_000)

// Run both tasks concurrently, wrapping the result
// in Either to capture success or failure
const program = Micro.race(Micro.either(task1), Micro.either(task2))

Micro.runPromise(program).then(console.log)
/*
Output:
{ _id: 'Either', _tag: 'Left', left: 'task1' }
*/
```
