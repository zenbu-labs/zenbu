---
title: Introduction to Streams
description: Learn the fundamentals of streams, a powerful tool for emitting multiple values, handling errors, and working with finite or infinite sequences in your applications.
sidebar:
  label: Introduction
  order: 0
---

In this guide, we'll explore the concept of a `Stream<A, E, R>`. A `Stream` is a program description that, when executed, can emit **zero or more values** of type `A`, handle errors of type `E`, and operates within a context of type `R`.

## Use Cases

Streams are particularly handy whenever you're dealing with sequences of values over time. They can serve as replacements for observables, node streams, and AsyncIterables.

## What is a Stream?

Think of a `Stream` as an extension of an `Effect`. While an `Effect<A, E, R>` represents a program that requires a context of type `R`, may encounter an error of type `E`, and always produces a single result of type `A`, a `Stream<A, E, R>` takes this further by allowing the emission of zero or more values of type `A`.

To clarify, let's examine some examples using `Effect`:

```ts twoslash
import { Effect, Chunk, Option } from "effect"

// An Effect that fails with a string error
const failedEffect = Effect.fail("fail!")

// An Effect that produces a single number
const oneNumberValue = Effect.succeed(3)

// An Effect that produces a chunk of numbers
const oneListValue = Effect.succeed(Chunk.make(1, 2, 3))

// An Effect that produces an optional number
const oneOption = Effect.succeed(Option.some(1))
```

In each case, the `Effect` always ends with **exactly one value**. There is no variability; you always get one result.

## Understanding Streams

Now, let's shift our focus to `Stream`. A `Stream` represents a program description that shares similarities with `Effect`, it requires a context of type `R`, may signal errors of type `E`, and yields values of type `A`. However, the key distinction is that it can yield **zero or more values**.

Here are the possible scenarios for a `Stream`:

- **An Empty Stream**: It can end up empty, representing a stream with no values.
- **A Single-Element Stream**: It can represent a stream with just one value.
- **A Finite Stream of Elements**: It can represent a stream with a finite number of values.
- **An Infinite Stream of Elements**: It can represent a stream that continues indefinitely, essentially an infinite stream.

Let's see these scenarios in action:

```ts twoslash
import { Stream } from "effect"

// An empty Stream
const emptyStream = Stream.empty

// A Stream with a single number
const oneNumberValueStream = Stream.succeed(3)

// A Stream with a range of numbers from 1 to 10
const finiteNumberStream = Stream.range(1, 10)

// An infinite Stream of numbers starting from 1 and incrementing
const infiniteNumberStream = Stream.iterate(1, (n) => n + 1)
```

In summary, a `Stream` is a versatile tool for representing programs that may yield multiple values, making it suitable for a wide range of tasks, from processing finite lists to handling infinite sequences.
