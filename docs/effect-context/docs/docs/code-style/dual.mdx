---
title: Dual APIs
description: Explore data-first and data-last variants of dual APIs in the Effect ecosystem.
sidebar:
  order: 2
---

import { Aside } from "@astrojs/starlight/components"

When you're working with APIs in the Effect ecosystem, you may come across two different ways to use the same API.
These two ways are called the "data-last" and "data-first" variants.

When an API supports both variants, we call them "dual" APIs.

Here's an illustration of these two variants using `Effect.map`.

## Effect.map as a dual API

The `Effect.map` function is defined with two TypeScript overloads. The terms "data-last" and "data-first" refer to the position of the `self` argument (also known as the "data") in the signatures of the two overloads:

```ts showLineNumbers=false
declare const map: {
  //                               ┌─── data-last
  //                               ▼
  <A, B>(f: (a: A) => B): <E, R>(self: Effect<A, E, R>) => Effect<B, E, R>
  //             ┌─── data-first
  //             ▼
  <A, E, R, B>(self: Effect<A, E, R>, f: (a: A) => B): Effect<B, E, R>
}
```

### data-last

In the first overload, the `self` argument comes **last**:

```ts showLineNumbers=false "self"
declare const map: <A, B>(
  f: (a: A) => B
) => <E, R>(self: Effect<A, E, R>) => Effect<B, E, R>
```

This version is commonly used with the `pipe` function. You start by passing the `Effect` as the initial argument to `pipe` and then chain transformations like `Effect.map`:

**Example** (Using data-last with `pipe`)

```ts showLineNumbers=false
const mappedEffect = pipe(effect, Effect.map(func))
```

This style is helpful when chaining multiple transformations, making the code easier to follow in a pipeline format:

```ts showLineNumbers=false
pipe(effect, Effect.map(func1), Effect.map(func2), ...)
```

### data-first

In the second overload, the `self` argument comes **first**:

```ts showLineNumbers=false "self"
declare const map: <A, E, R, B>(
  self: Effect<A, E, R>,
  f: (a: A) => B
) => Effect<B, E, R>
```

This form doesn't require `pipe`. Instead, you provide the `Effect` directly as the first argument:

**Example** (Using data-first without `pipe`)

```ts showLineNumbers=false
const mappedEffect = Effect.map(effect, func)
```

This version works well when you only need to perform a single operation on the `Effect`.

<Aside type="tip" title="Choosing Between Styles">
  Both overloads achieve the same result. Choose the one that best suits
  your coding style and enhances readability for your team.
</Aside>
