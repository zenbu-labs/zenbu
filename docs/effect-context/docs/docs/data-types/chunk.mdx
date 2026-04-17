---
title: Chunk
description: Learn about Chunk, a high-performance immutable data structure in Effect, offering efficient operations like concatenation, slicing, and conversions.
sidebar:
  order: 3
---

import { Aside } from "@astrojs/starlight/components"

A `Chunk<A>` represents an ordered, immutable collection of values of type `A`. While similar to an array, `Chunk` provides a functional interface, optimizing certain operations that can be costly with regular arrays, like repeated concatenation.

<Aside type="caution" title="Use Chunk Only for Repeated Concatenation">
  `Chunk` is optimized to manage the performance cost of repeated array
  concatenation. For cases that do not involve repeated concatenation,
  using `Chunk` may introduce unnecessary overhead, resulting in slower
  performance.
</Aside>

## Why Use Chunk?

- **Immutability**: Unlike standard JavaScript arrays, which are mutable, `Chunk` provides a truly immutable collection, preventing data from being modified after creation. This is especially useful in concurrent programming contexts where immutability can enhance data consistency.

- **High Performance**: `Chunk` supports specialized operations for efficient array manipulation, such as appending single elements or concatenating chunks, making these operations faster than their regular JavaScript array equivalents.

## Creating a Chunk

### empty

Create an empty `Chunk` with `Chunk.empty`.

**Example** (Creating an Empty Chunk)

```ts twoslash
import { Chunk } from "effect"

//      ┌─── Chunk<number>
//      ▼
const chunk = Chunk.empty<number>()
```

### make

To create a `Chunk` with specific values, use `Chunk.make(...values)`. Note that the resulting chunk is typed as non-empty.

**Example** (Creating a Non-Empty Chunk)

```ts twoslash
import { Chunk } from "effect"

//      ┌─── NonEmptyChunk<number>
//      ▼
const chunk = Chunk.make(1, 2, 3)
```

### fromIterable

You can create a `Chunk` by providing a collection, either from an iterable or directly from an array.

**Example** (Creating a Chunk from an Iterable)

```ts twoslash
import { Chunk, List } from "effect"

const fromArray = Chunk.fromIterable([1, 2, 3])

const fromList = Chunk.fromIterable(List.make(1, 2, 3))
```

<Aside type="caution" title="Performance Consideration">
  `Chunk.fromIterable` creates a new copy of the iterable's elements. For
  large data sets or repeated use, this cloning process can impact
  performance.
</Aside>

### unsafeFromArray

`Chunk.unsafeFromArray` creates a `Chunk` directly from an array without cloning. This approach can improve performance by avoiding the overhead of copying data but requires caution, as it bypasses the usual immutability guarantees.

**Example** (Directly Creating a Chunk from an Array)

```ts twoslash
import { Chunk } from "effect"

const chunk = Chunk.unsafeFromArray([1, 2, 3])
```

<Aside type="caution" title="Risk of Mutable Data">
  Using `Chunk.unsafeFromArray` can lead to unexpected behavior if the
  original array is modified after the chunk is created. For safer,
  immutable behavior, use `Chunk.fromIterable` instead.
</Aside>

## Concatenating

To combine two `Chunk` instances into one, use `Chunk.appendAll`.

**Example** (Combining Two Chunks into One)

```ts twoslash
import { Chunk } from "effect"

// Concatenate two chunks with different types of elements
//
//      ┌─── NonEmptyChunk<string | number>
//      ▼
const chunk = Chunk.appendAll(Chunk.make(1, 2), Chunk.make("a", "b"))

console.log(chunk)
/*
Output:
{ _id: 'Chunk', values: [ 1, 2, 'a', 'b' ] }
*/
```

## Dropping

To remove elements from the beginning of a `Chunk`, use `Chunk.drop`, specifying the number of elements to discard.

**Example** (Dropping Elements from the Start)

```ts twoslash
import { Chunk } from "effect"

// Drops the first 2 elements from the Chunk
const chunk = Chunk.drop(Chunk.make(1, 2, 3, 4), 2)
```

## Comparing

To check if two `Chunk` instances are equal, use [`Equal.equals`](/docs/trait/equal/). This function compares the contents of each `Chunk` for structural equality.

**Example** (Comparing Two Chunks)

```ts twoslash
import { Chunk, Equal } from "effect"

const chunk1 = Chunk.make(1, 2)
const chunk2 = Chunk.make(1, 2, 3)

console.log(Equal.equals(chunk1, chunk1))
// Output: true

console.log(Equal.equals(chunk1, chunk2))
// Output: false

console.log(Equal.equals(chunk1, Chunk.make(1, 2)))
// Output: true
```

## Converting

Convert a `Chunk` to a `ReadonlyArray` using `Chunk.toReadonlyArray`. The resulting type varies based on the `Chunk`'s contents, distinguishing between empty, non-empty, and generic chunks.

**Example** (Converting a Chunk to a ReadonlyArray)

```ts twoslash
import { Chunk } from "effect"

//      ┌─── readonly [number, ...number[]]
//      ▼
const nonEmptyArray = Chunk.toReadonlyArray(Chunk.make(1, 2, 3))

//      ┌─── readonly never[]
//      ▼
const emptyArray = Chunk.toReadonlyArray(Chunk.empty())

declare const chunk: Chunk.Chunk<number>

//      ┌─── readonly number[]
//      ▼
const array = Chunk.toReadonlyArray(chunk)
```
