---
title: Why Effect?
description: Discover how Effect transforms TypeScript programming by using the type system to track errors, context, and success, offering practical solutions for building reliable, maintainable applications.
sidebar:
  order: 1
---

Programming is challenging. When we build libraries and apps, we look to many tools to handle the complexity and make our day-to-day more manageable. Effect presents a new way of thinking about programming in TypeScript.

Effect is an ecosystem of tools that help you build better applications and libraries. As a result, you will also learn more about the TypeScript language and how to use the type system to make your programs more reliable and easier to maintain.

In "typical" TypeScript, without Effect, we write code that assumes that a function is either successful or throws an exception. For example:

```ts twoslash
const divide = (a: number, b: number): number => {
  if (b === 0) {
    throw new Error("Cannot divide by zero")
  }
  return a / b
}
```

Based on the types, we have no idea that this function can throw an exception. We can only find out by reading the code. This may not seem like much of a problem when you only have one function in your codebase, but when you have hundreds or thousands, it really starts to add up. It's easy to forget that a function can throw an exception, and it's easy to forget to handle that exception.

Often, we will do the "easiest" thing and just wrap the function in a `try/catch` block. This is a good first step to prevent your program from crashing, but it doesn't make it any easier to manage or understand our complex application/library. We can do better.

One of the most important tools we have in TypeScript is the compiler. It is the first line of defense against bugs, domain errors, and general complexity.

## The Effect Pattern

While Effect is a vast ecosystem of many different tools, if it had to be reduced down to just one idea, it would be the following:

Effect's major unique insight is that we can use the type system to track **errors** and **context**, not only **success** values as shown in the divide example above.

Here's the same divide function from above, but with the Effect pattern:

```ts twoslash
import { Effect } from "effect"

const divide = (
  a: number,
  b: number
): Effect.Effect<number, Error, never> =>
  b === 0
    ? Effect.fail(new Error("Cannot divide by zero"))
    : Effect.succeed(a / b)
```

With this approach, the function no longer throws exceptions. Instead, errors are handled as values, which can be passed along like success values. The type signature also makes it clear:

- What success value the function returns (`number`).
- What error can occur (`Error`).
- What additional context or dependencies are required (`never` indicates none).

```text showLineNumbers=false
         ┌─── Produces a value of type number
         │       ┌─── Fails with an Error
         │       │      ┌─── Requires no dependencies
         ▼       ▼      ▼
Effect<number, Error, never>
```

Additionally, tracking context allows you to provide additional information to your functions without having to pass in everything as an argument. For example, you can swap out implementations of live external services with mocks during your tests without changing any core business logic.

## Don't Re-Invent the Wheel

Application code in TypeScript often solves the same problems over and over again. Interacting with external services, filesystems, databases, etc. are common problems for all application developers. Effect provides a rich ecosystem of libraries that provide standardized solutions to many of these problems. You can use these libraries to build your application, or you can use them to build your own libraries.

Managing challenges like error handling, debugging, tracing, async/promises, retries, streaming, concurrency, caching, resource management, and a lot more are made manageable with Effect. You don't have to re-invent the solutions to these problems, or install tons of dependencies. Effect, under one umbrella, solves many of the problems that you would usually install many different dependencies with different APIs to solve.

## Solving Practical Problems

Effect is heavily inspired by great work done in other languages, like Scala and Haskell. However, it's important to understand that Effect's goal is to be a practical toolkit, and it goes to great lengths to solve real, everyday problems that developers face when building applications and libraries in TypeScript.

## Enjoy Building and Learning

Learning Effect is a lot of fun. Many developers in the Effect ecosystem are using Effect to solve real problems in their day-to-day work, and also experiment with cutting edge ideas for pushing TypeScript to be the most useful language it can be.

You don't have to use all aspects of Effect at once, and can start with the pieces of the ecosystem that make the most sense for the problems you are solving. Effect is a toolkit, and you can pick and choose the pieces that make the most sense for your use case. However, as more and more of your codebase is using Effect, you will probably find yourself wanting to utilize more of the ecosystem!

Effect's concepts may be new to you, and might not completely make sense at first. This is totally normal. Take your time with reading the docs and try to understand the core concepts - this will really pay off later on as you get into the more advanced tooling in the Effect ecosystem. The Effect community is always happy to help you learn and grow. Feel free to hop into our [Discord](https://discord.gg/effect-ts) or discuss on [GitHub](https://github.com/Effect-TS)! We are open to feedback and contributions, and are always looking for ways to improve Effect.
