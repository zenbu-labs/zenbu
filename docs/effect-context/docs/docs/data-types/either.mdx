---
title: Either
description: Represent exclusive values as Left or Right with the Either data type, enabling precise control flow in computations.
sidebar:
  order: 7
---

import { Aside } from "@astrojs/starlight/components"

The `Either` data type represents two exclusive values: an `Either<R, L>` can be a `Right` value or a `Left` value, where `R` is the type of the `Right` value, and `L` is the type of the `Left` value.

## Understanding Either and Exit

Either is primarily used as a **simple discriminated union** and is not recommended as the main result type for operations requiring detailed error information.

[Exit](/docs/data-types/exit/) is the preferred **result type** within Effect for capturing comprehensive details about failures.
It encapsulates the outcomes of effectful computations, distinguishing between success and various failure modes, such as errors, defects and interruptions.

## Creating Eithers

You can create an `Either` using the `Either.right` and `Either.left` constructors.

Use `Either.right` to create a `Right` value of type `R`.

**Example** (Creating a Right Value)

```ts twoslash
import { Either } from "effect"

const rightValue = Either.right(42)

console.log(rightValue)
/*
Output:
{ _id: 'Either', _tag: 'Right', right: 42 }
*/
```

Use `Either.left` to create a `Left` value of type `L`.

**Example** (Creating a Left Value)

```ts twoslash
import { Either } from "effect"

const leftValue = Either.left("not a number")

console.log(leftValue)
/*
Output:
{ _id: 'Either', _tag: 'Left', left: 'not a number' }
*/
```

## Guards

Use `Either.isLeft` and `Either.isRight` to check whether an `Either` is a `Left` or `Right` value.

**Example** (Using Guards to Check the Type of Either)

```ts twoslash
import { Either } from "effect"

const foo = Either.right(42)

if (Either.isLeft(foo)) {
  console.log(`The left value is: ${foo.left}`)
} else {
  console.log(`The Right value is: ${foo.right}`)
}
// Output: "The Right value is: 42"
```

## Pattern Matching

Use `Either.match` to handle both cases of an `Either` by specifying separate callbacks for `Left` and `Right`.

**Example** (Pattern Matching with Either)

```ts twoslash
import { Either } from "effect"

const foo = Either.right(42)

const message = Either.match(foo, {
  onLeft: (left) => `The left value is: ${left}`,
  onRight: (right) => `The Right value is: ${right}`
})

console.log(message)
// Output: "The Right value is: 42"
```

## Mapping

### Mapping over the Right Value

Use `Either.map` to transform the `Right` value of an `Either`. The function you provide will only apply to the `Right` value, leaving any `Left` value unchanged.

**Example** (Transforming the Right Value)

```ts twoslash
import { Either } from "effect"

// Transform the Right value by adding 1
const rightResult = Either.map(Either.right(1), (n) => n + 1)
console.log(rightResult)
/*
Output:
{ _id: 'Either', _tag: 'Right', right: 2 }
*/

// The transformation is ignored for Left values
const leftResult = Either.map(Either.left("not a number"), (n) => n + 1)
console.log(leftResult)
/*
Output:
{ _id: 'Either', _tag: 'Left', left: 'not a number' }
*/
```

### Mapping over the Left Value

Use `Either.mapLeft` to transform the `Left` value of an `Either`. The provided function only applies to the `Left` value, leaving any `Right` value unchanged.

**Example** (Transforming the Left Value)

```ts twoslash
import { Either } from "effect"

// The transformation is ignored for Right values
const rightResult = Either.mapLeft(Either.right(1), (s) => s + "!")
console.log(rightResult)
/*
Output:
{ _id: 'Either', _tag: 'Right', right: 1 }
*/

// Transform the Left value by appending "!"
const leftResult = Either.mapLeft(
  Either.left("not a number"),
  (s) => s + "!"
)
console.log(leftResult)
/*
Output:
{ _id: 'Either', _tag: 'Left', left: 'not a number!' }
*/
```

### Mapping over Both Values

Use `Either.mapBoth` to transform both the `Left` and `Right` values of an `Either`. This function takes two separate transformation functions: one for the `Left` value and another for the `Right` value.

**Example** (Transforming Both Left and Right Values)

```ts twoslash
import { Either } from "effect"

const transformedRight = Either.mapBoth(Either.right(1), {
  onLeft: (s) => s + "!",
  onRight: (n) => n + 1
})
console.log(transformedRight)
/*
Output:
{ _id: 'Either', _tag: 'Right', right: 2 }
*/

const transformedLeft = Either.mapBoth(Either.left("not a number"), {
  onLeft: (s) => s + "!",
  onRight: (n) => n + 1
})
console.log(transformedLeft)
/*
Output:
{ _id: 'Either', _tag: 'Left', left: 'not a number!' }
*/
```

## Interop with Effect

The `Either` type works as a subtype of the `Effect` type, allowing you to use it with functions from the `Effect` module. While these functions are built to handle `Effect` values, they can also manage `Either` values correctly.

### How Either Maps to Effect

| Either Variant | Mapped to Effect   | Description          |
| -------------- | ------------------ | -------------------- |
| `Left<L>`      | `Effect<never, L>` | Represents a failure |
| `Right<R>`     | `Effect<R>`        | Represents a success |

**Example** (Combining `Either` with `Effect`)

```ts twoslash
import { Effect, Either } from "effect"

// Function to get the head of an array, returning Either
const head = <A>(array: ReadonlyArray<A>): Either.Either<A, string> =>
  array.length > 0 ? Either.right(array[0]) : Either.left("empty array")

// Simulated fetch function that returns Effect
const fetchData = (): Effect.Effect<string, string> => {
  const success = Math.random() > 0.5
  return success
    ? Effect.succeed("some data")
    : Effect.fail("Failed to fetch data")
}

// Mixing Either and Effect
const program = Effect.all([head([1, 2, 3]), fetchData()])

Effect.runPromise(program).then(console.log)
/*
Example Output:
[ 1, 'some data' ]
*/
```

## Combining Two or More Eithers

### zipWith

The `Either.zipWith` function lets you combine two `Either` values using a provided function. It creates a new `Either` that holds the combined value of both original `Either` values.

**Example** (Combining Two Eithers into an Object)

```ts twoslash
import { Either } from "effect"

const maybeName: Either.Either<string, string> = Either.right("John")
const maybeAge: Either.Either<number, string> = Either.right(25)

// Combine the name and age into a person object
const person = Either.zipWith(maybeName, maybeAge, (name, age) => ({
  name: name.toUpperCase(),
  age
}))

console.log(person)
/*
Output:
{ _id: 'Either', _tag: 'Right', right: { name: 'JOHN', age: 25 } }
*/
```

If either of the `Either` values is `Left`, the result will be `Left`, holding the first encountered `Left` value:

**Example** (Combining Eithers with a Left Value)

```ts twoslash {4}
import { Either } from "effect"

const maybeName: Either.Either<string, string> = Either.right("John")
const maybeAge: Either.Either<number, string> = Either.left("Oh no!")

// Since maybeAge is a Left, the result will also be Left
const person = Either.zipWith(maybeName, maybeAge, (name, age) => ({
  name: name.toUpperCase(),
  age
}))

console.log(person)
/*
Output:
{ _id: 'Either', _tag: 'Left', left: 'Oh no!' }
*/
```

### all

To combine multiple `Either` values without transforming their contents, you can use `Either.all`. This function returns an `Either` with a structure matching the input:

- If you pass a tuple, the result will be a tuple of the same length.
- If you pass a struct, the result will be a struct with the same keys.
- If you pass an `Iterable`, the result will be an array.

**Example** (Combining Multiple Eithers into a Tuple and Struct)

```ts twoslash
import { Either } from "effect"

const maybeName: Either.Either<string, string> = Either.right("John")
const maybeAge: Either.Either<number, string> = Either.right(25)

//      ┌─── Either<[string, number], string>
//      ▼
const tuple = Either.all([maybeName, maybeAge])
console.log(tuple)
/*
Output:
{ _id: 'Either', _tag: 'Right', right: [ 'John', 25 ] }
*/

//      ┌─── Either<{ name: string; age: number; }, string>
//      ▼
const struct = Either.all({ name: maybeName, age: maybeAge })
console.log(struct)
/*
Output:
{ _id: 'Either', _tag: 'Right', right: { name: 'John', age: 25 } }
*/
```

If one or more `Either` values are `Left`, the first `Left` encountered is returned:

**Example** (Handling Multiple Left Values)

```ts
import { Either } from "effect"

const maybeName: Either.Either<string, string> =
  Either.left("name not found")
const maybeAge: Either.Either<number, string> =
  Either.left("age not found")

// The first Left value will be returned
console.log(Either.all([maybeName, maybeAge]))
/*
Output:
{ _id: 'Either', _tag: 'Left', left: 'name not found' }
*/
```

## gen

Similar to [Effect.gen](/docs/getting-started/using-generators/), `Either.gen` provides a more readable, generator-based syntax for working with `Either` values, making code that involves `Either` easier to write and understand. This approach is similar to using `async/await` but tailored for `Either`.

**Example** (Using `Either.gen` to Create a Combined Value)

```ts twoslash
import { Either } from "effect"

const maybeName: Either.Either<string, string> = Either.right("John")
const maybeAge: Either.Either<number, string> = Either.right(25)

const program = Either.gen(function* () {
  const name = (yield* maybeName).toUpperCase()
  const age = yield* maybeAge
  return { name, age }
})

console.log(program)
/*
Output:
{ _id: 'Either', _tag: 'Right', right: { name: 'JOHN', age: 25 } }
*/
```

When any of the `Either` values in the sequence is `Left`, the generator immediately returns the `Left` value, skipping further operations:

**Example** (Handling a `Left` Value with `Either.gen`)

In this example, `Either.gen` halts execution as soon as it encounters the `Left` value, effectively propagating the error without performing further operations.

```ts twoslash
import { Either } from "effect"

const maybeName: Either.Either<string, string> = Either.left("Oh no!")
const maybeAge: Either.Either<number, string> = Either.right(25)

const program = Either.gen(function* () {
  console.log("Retrieving name...")
  const name = (yield* maybeName).toUpperCase()
  console.log("Retrieving age...")
  const age = yield* maybeAge
  return { name, age }
})

console.log(program)
/*
Output:
Retrieving name...
{ _id: 'Either', _tag: 'Left', left: 'Oh no!' }
*/
```

The use of `console.log` in these example is for demonstration purposes only. When using `Either.gen`, avoid including side effects in your generator functions, as `Either` should remain a pure data structure.
