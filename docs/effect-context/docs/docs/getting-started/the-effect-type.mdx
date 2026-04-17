---
title: The Effect Type
description: Understand the Effect type in the Effect ecosystem, which models immutable, lazy workflows with type-safe success, error, and requirement handling for effectful computations.
sidebar:
  order: 6
---

import { Aside } from "@astrojs/starlight/components"

The `Effect` type is a description of a workflow or operation that is **lazily** executed. This means that when you create an `Effect`, it doesn't run immediately, but instead defines a program that can succeed, fail, or require some additional context to complete.

Here is the general form of an `Effect`:

```text showLineNumbers=false
         ┌─── Represents the success type
         │        ┌─── Represents the error type
         │        │      ┌─── Represents required dependencies
         ▼        ▼      ▼
Effect<Success, Error, Requirements>
```

This type indicates that an effect:

- Succeeds and returns a value of type `Success`
- Fails with an error of type `Error`
- May need certain contextual dependencies of type `Requirements` to execute

Conceptually, you can think of `Effect` as an effectful version of the following function type:

```ts showLineNumbers=false
type Effect<Success, Error, Requirements> = (
  context: Context<Requirements>
) => Error | Success
```

However, effects are not actually functions. They can model synchronous, asynchronous, concurrent, and resourceful computations.

**Immutability**. `Effect` values are immutable, and every function in the Effect library produces a new `Effect` value.

**Modeling Interactions**. These values do not perform any actions themselves, they simply model or describe effectful interactions.

**Execution**. An `Effect` can be executed by the [Effect Runtime System](/docs/runtime/), which interprets it into actual interactions with the external world.
Ideally, this execution happens at a single entry point in your application, such as the main function where effectful operations are initiated.

## Type Parameters

The `Effect` type has three type parameters with the following meanings:

| Parameter        | Description                                                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Success**      | Represents the type of value that an effect can succeed with when executed. If this type parameter is `void`, it means the effect produces no useful information, while if it is `never`, it means the effect runs forever (or until failure). |
| **Error**        | Represents the expected errors that can occur when executing an effect. If this type parameter is `never`, it means the effect cannot fail, because there are no values of type `never`.                                                       |
| **Requirements** | Represents the contextual data required by the effect to be executed. This data is stored in a collection named `Context`. If this type parameter is `never`, it means the effect has no requirements and the `Context` collection is empty.   |

<Aside type="note" title="Type Parameter Abbreviations">
  In the Effect ecosystem, you may often encounter the type parameters of
  `Effect` abbreviated as `A`, `E`, and `R` respectively. This is just
  shorthand for the success value of type **A**, **E**rror, and
  **R**equirements.
</Aside>

## Extracting Inferred Types

By using the utility types `Effect.Success`, `Effect.Error`, and `Effect.Context`, you can extract the corresponding types from an effect.

**Example** (Extracting Success, Error, and Context Types)

```ts twoslash
import { Effect, Context } from "effect"

class SomeContext extends Context.Tag("SomeContext")<SomeContext, {}>() {}

// Assume we have an effect that succeeds with a number,
// fails with an Error, and requires SomeContext
declare const program: Effect.Effect<number, Error, SomeContext>

// Extract the success type, which is number
type A = Effect.Effect.Success<typeof program>

// Extract the error type, which is Error
type E = Effect.Effect.Error<typeof program>

// Extract the context type, which is SomeContext
type R = Effect.Effect.Context<typeof program>
```
