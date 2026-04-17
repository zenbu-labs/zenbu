---
title: Option
description: Represent optional values with Option, supporting presence (Some) or absence (None) and seamless operations like mapping, combining, and pattern matching.
sidebar:
  order: 10
---

import { Aside } from "@astrojs/starlight/components"

The `Option` data type represents optional values. An `Option<A>` can either be `Some<A>`, containing a value of type `A`, or `None`, representing the absence of a value.

You can use `Option` in scenarios like:

- Using it for initial values
- Returning values from functions that are not defined for all possible inputs (referred to as "partial functions")
- Managing optional fields in data structures
- Handling optional function arguments

## Creating Options

### some

Use the `Option.some` constructor to create an `Option` that holds a value of type `A`.

**Example** (Creating an Option with a Value)

```ts twoslash
import { Option } from "effect"

// An Option holding the number 1
const value = Option.some(1)

console.log(value)
// Output: { _id: 'Option', _tag: 'Some', value: 1 }
```

### none

Use the `Option.none` constructor to create an `Option` representing the absence of a value.

**Example** (Creating an Option with No Value)

```ts twoslash
import { Option } from "effect"

// An Option holding no value
const noValue = Option.none()

console.log(noValue)
// Output: { _id: 'Option', _tag: 'None' }
```

### liftPredicate

You can create an `Option` based on a predicate, for example, to check if a value is positive.

**Example** (Using Explicit Option Creation)

Here's how you can achieve this using `Option.none` and `Option.some`:

```ts twoslash
import { Option } from "effect"

const isPositive = (n: number) => n > 0

const parsePositive = (n: number): Option.Option<number> =>
  isPositive(n) ? Option.some(n) : Option.none()
```

**Example** (Using `Option.liftPredicate` for Conciseness)

Alternatively, you can simplify the above logic with `Option.liftPredicate`:

```ts twoslash
import { Option } from "effect"

const isPositive = (n: number) => n > 0

//      ┌─── (b: number) => Option<number>
//      ▼
const parsePositive = Option.liftPredicate(isPositive)
```

## Modeling Optional Properties

Consider a `User` model where the `"email"` property is optional and can hold a `string` value. We use the `Option<string>` type to represent this optional property:

```ts {6} twoslash
import { Option } from "effect"

interface User {
  readonly id: number
  readonly username: string
  readonly email: Option.Option<string>
}
```

<Aside type="note" title="Property Key Always Present">
  Optionality only applies to the value of the property. The key `"email"`
  will always be present in the object, regardless of whether it has a
  value or not.
</Aside>

Here are examples of how to create `User` instances with and without an email:

**Example** (Creating Users with and without Email)

```ts twoslash
import { Option } from "effect"

interface User {
  readonly id: number
  readonly username: string
  readonly email: Option.Option<string>
}

const withEmail: User = {
  id: 1,
  username: "john_doe",
  email: Option.some("john.doe@example.com")
}

const withoutEmail: User = {
  id: 2,
  username: "jane_doe",
  email: Option.none()
}
```

## Guards

You can check whether an `Option` is a `Some` or a `None` using the `Option.isSome` and `Option.isNone` guards.

**Example** (Using Guards to Check Option Values)

```ts twoslash
import { Option } from "effect"

const foo = Option.some(1)

console.log(Option.isSome(foo))
// Output: true

if (Option.isNone(foo)) {
  console.log("Option is empty")
} else {
  console.log(`Option has a value: ${foo.value}`)
}
// Output: "Option has a value: 1"
```

## Pattern Matching

Use `Option.match` to handle both cases of an `Option` by specifying separate callbacks for `None` and `Some`.

**Example** (Pattern Matching with Option)

```ts twoslash
import { Option } from "effect"

const foo = Option.some(1)

const message = Option.match(foo, {
  onNone: () => "Option is empty",
  onSome: (value) => `Option has a value: ${value}`
})

console.log(message)
// Output: "Option has a value: 1"
```

## Working with Option

### map

The `Option.map` function lets you transform the value inside an `Option` without manually unwrapping and re-wrapping it. If the `Option` holds a value (`Some`), the transformation function is applied. If the `Option` is `None`, the function is ignored, and the `Option` remains unchanged.

**Example** (Mapping a Value in Some)

```ts twoslash
import { Option } from "effect"

// Transform the value inside Some
console.log(Option.map(Option.some(1), (n) => n + 1))
// Output: { _id: 'Option', _tag: 'Some', value: 2 }
```

When dealing with `None`, the mapping function is not executed, and the `Option` remains `None`:

**Example** (Mapping over None)

```ts twoslash
import { Option } from "effect"

// Mapping over None results in None
console.log(Option.map(Option.none(), (n) => n + 1))
// Output: { _id: 'Option', _tag: 'None' }
```

### flatMap

The `Option.flatMap` function is similar to `Option.map`, but it is designed to handle cases where the transformation might return another `Option`. This allows us to chain computations that depend on whether or not a value is present in an `Option`.

Consider a `User` model that includes a nested optional `Address`, which itself contains an optional `street` property:

```ts twoslash {7,12}
import { Option } from "effect"

interface User {
  readonly id: number
  readonly username: string
  readonly email: Option.Option<string>
  readonly address: Option.Option<Address>
}

interface Address {
  readonly city: string
  readonly street: Option.Option<string>
}
```

In this model, the `address` field is an `Option<Address>`, and the `street` field within `Address` is an `Option<string>`.

We can use `Option.flatMap` to extract the `street` property from `address`:

**Example** (Extracting a Nested Optional Property)

```ts twoslash
import { Option } from "effect"

interface Address {
  readonly city: string
  readonly street: Option.Option<string>
}

interface User {
  readonly id: number
  readonly username: string
  readonly email: Option.Option<string>
  readonly address: Option.Option<Address>
}

const user: User = {
  id: 1,
  username: "john_doe",
  email: Option.some("john.doe@example.com"),
  address: Option.some({
    city: "New York",
    street: Option.some("123 Main St")
  })
}

// Use flatMap to extract the street value
const street = user.address.pipe(
  Option.flatMap((address) => address.street)
)

console.log(street)
// Output: { _id: 'Option', _tag: 'Some', value: '123 Main St' }
```

If `user.address` is `Some`, `Option.flatMap` applies the function `(address) => address.street` to retrieve the `street` value.

If `user.address` is `None`, the function is not executed, and `street` remains `None`.

This approach lets us handle nested optional values concisely, avoiding manual checks and making the code cleaner and easier to read.

### filter

The `Option.filter` function allows you to filter an `Option` based on a given predicate. If the predicate is not met or if the `Option` is `None`, the result will be `None`.

**Example** (Filtering an Option Value)

Here's how you can simplify some code using `Option.filter` for a more idiomatic approach:

Original Code

```ts twoslash
import { Option } from "effect"

// Function to remove empty strings from an Option
const removeEmptyString = (input: Option.Option<string>) => {
  if (Option.isSome(input) && input.value === "") {
    return Option.none() // Return None if the value is an empty string
  }
  return input // Otherwise, return the original Option
}

console.log(removeEmptyString(Option.none()))
// Output: { _id: 'Option', _tag: 'None' }

console.log(removeEmptyString(Option.some("")))
// Output: { _id: 'Option', _tag: 'None' }

console.log(removeEmptyString(Option.some("a")))
// Output: { _id: 'Option', _tag: 'Some', value: 'a' }
```

Refactored Idiomatic Code

Using `Option.filter`, we can write the same logic more concisely:

```ts twoslash
import { Option } from "effect"

const removeEmptyString = (input: Option.Option<string>) =>
  Option.filter(input, (value) => value !== "")

console.log(removeEmptyString(Option.none()))
// Output: { _id: 'Option', _tag: 'None' }

console.log(removeEmptyString(Option.some("")))
// Output: { _id: 'Option', _tag: 'None' }

console.log(removeEmptyString(Option.some("a")))
// Output: { _id: 'Option', _tag: 'Some', value: 'a' }
```

## Getting the Value from an Option

To retrieve the value stored inside an `Option`, you can use several helper functions provided by the `Option` module. Here's an overview of the available methods:

### getOrThrow

This function extracts the value from a `Some`. If the `Option` is `None`, it throws an error.

**Example** (Retrieving Value or Throwing an Error)

```ts twoslash
import { Option } from "effect"

console.log(Option.getOrThrow(Option.some(10)))
// Output: 10

console.log(Option.getOrThrow(Option.none()))
// throws: Error: getOrThrow called on a None
```

### getOrNull / getOrUndefined

These functions convert a `None` to either `null` or `undefined`, which is useful when working with non-`Option`-based code.

**Example** (Converting `None` to `null` or `undefined`)

```ts twoslash
import { Option } from "effect"

console.log(Option.getOrNull(Option.some(5)))
// Output: 5

console.log(Option.getOrNull(Option.none()))
// Output: null

console.log(Option.getOrUndefined(Option.some(5)))
// Output: 5

console.log(Option.getOrUndefined(Option.none()))
// Output: undefined
```

### getOrElse

This function allows you to specify a default value to return when the `Option` is `None`.

**Example** (Providing a Default Value When `None`)

```ts twoslash
import { Option } from "effect"

console.log(Option.getOrElse(Option.some(5), () => 0))
// Output: 5

console.log(Option.getOrElse(Option.none(), () => 0))
// Output: 0
```

## Fallback

### orElse

When a computation returns `None`, you might want to try an alternative computation that yields an `Option`. The `Option.orElse` function is helpful in such cases. It lets you chain multiple computations, moving on to the next if the current one results in `None`. This approach is often used in retry logic, attempting computations until one succeeds or all possibilities are exhausted.

**Example** (Attempting Alternative Computations)

```ts twoslash
import { Option } from "effect"

// Simulating a computation that may or may not produce a result
const computation = (): Option.Option<number> =>
  Math.random() < 0.5 ? Option.some(10) : Option.none()

// Simulates an alternative computation
const alternativeComputation = (): Option.Option<number> =>
  Math.random() < 0.5 ? Option.some(20) : Option.none()

// Attempt the first computation, then try an alternative if needed
const program = computation().pipe(
  Option.orElse(() => alternativeComputation())
)

const result = Option.match(program, {
  onNone: () => "Both computations resulted in None",
  // At least one computation succeeded
  onSome: (value) => `Computed value: ${value}`
})

console.log(result)
// Output: Computed value: 10
```

### firstSomeOf

You can also use `Option.firstSomeOf` to get the first `Some` value from an iterable of `Option` values:

**Example** (Retrieving the First `Some` Value)

```ts twoslash
import { Option } from "effect"

const first = Option.firstSomeOf([
  Option.none(),
  Option.some(2),
  Option.none(),
  Option.some(3)
])

console.log(first)
// Output: { _id: 'Option', _tag: 'Some', value: 2 }
```

## Interop with Nullable Types

When dealing with the `Option` data type, you may encounter code that uses `undefined` or `null` to represent optional values. The `Option` module provides several APIs to make interaction with these nullable types straightforward.

### fromNullable

`Option.fromNullable` converts a nullable value (`null` or `undefined`) into an `Option`. If the value is `null` or `undefined`, it returns `Option.none()`. Otherwise, it wraps the value in `Option.some()`.

**Example** (Creating Option from Nullable Values)

```ts twoslash
import { Option } from "effect"

console.log(Option.fromNullable(null))
// Output: { _id: 'Option', _tag: 'None' }

console.log(Option.fromNullable(undefined))
// Output: { _id: 'Option', _tag: 'None' }

console.log(Option.fromNullable(1))
// Output: { _id: 'Option', _tag: 'Some', value: 1 }
```

If you need to convert an `Option` back to a nullable value, there are two helper methods:

- `Option.getOrNull`: Converts `None` to `null`.
- `Option.getOrUndefined`: Converts `None` to `undefined`.

## Interop with Effect

The `Option` type works as a subtype of the `Effect` type, allowing you to use it with functions from the `Effect` module. While these functions are built to handle `Effect` values, they can also manage `Option` values correctly.

### How Option Maps to Effect

| Option Variant | Mapped to Effect                        | Description                        |
| -------------- | --------------------------------------- | ---------------------------------- |
| `None`         | `Effect<never, NoSuchElementException>` | Represents the absence of a value  |
| `Some<A>`      | `Effect<A>`                             | Represents the presence of a value |

**Example** (Combining `Option` with `Effect`)

```ts twoslash
import { Effect, Option } from "effect"

// Function to get the head of an array, returning Option
const head = <A>(array: ReadonlyArray<A>): Option.Option<A> =>
  array.length > 0 ? Option.some(array[0]) : Option.none()

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

## Combining Two or More Options

### zipWith

The `Option.zipWith` function lets you combine two `Option` values using a provided function. It creates a new `Option` that holds the combined value of both original `Option` values.

**Example** (Combining Two Options into an Object)

```ts twoslash
import { Option } from "effect"

const maybeName: Option.Option<string> = Option.some("John")
const maybeAge: Option.Option<number> = Option.some(25)

// Combine the name and age into a person object
const person = Option.zipWith(maybeName, maybeAge, (name, age) => ({
  name: name.toUpperCase(),
  age
}))

console.log(person)
/*
Output:
{ _id: 'Option', _tag: 'Some', value: { name: 'JOHN', age: 25 } }
*/
```

If either of the `Option` values is `None`, the result will be `None`:

**Example** (Handling None Values)

```ts {4} twoslash
import { Option } from "effect"

const maybeName: Option.Option<string> = Option.some("John")
const maybeAge: Option.Option<number> = Option.none()

// Since maybeAge is a None, the result will also be None
const person = Option.zipWith(maybeName, maybeAge, (name, age) => ({
  name: name.toUpperCase(),
  age
}))

console.log(person)
// Output: { _id: 'Option', _tag: 'None' }
```

### all

To combine multiple `Option` values without transforming their contents, you can use `Option.all`. This function returns an `Option` with a structure matching the input:

- If you pass a tuple, the result will be a tuple of the same length.
- If you pass a struct, the result will be a struct with the same keys.
- If you pass an `Iterable`, the result will be an array.

**Example** (Combining Multiple Options into a Tuple and Struct)

```ts twoslash
import { Option } from "effect"

const maybeName: Option.Option<string> = Option.some("John")
const maybeAge: Option.Option<number> = Option.some(25)

//      ┌─── Option<[string, number]>
//      ▼
const tuple = Option.all([maybeName, maybeAge])
console.log(tuple)
/*
Output:
{ _id: 'Option', _tag: 'Some', value: [ 'John', 25 ] }
*/

//      ┌─── Option<{ name: string; age: number; }>
//      ▼
const struct = Option.all({ name: maybeName, age: maybeAge })
console.log(struct)
/*
Output:
{ _id: 'Option', _tag: 'Some', value: { name: 'John', age: 25 } }
*/
```

If any of the `Option` values are `None`, the result will be `None`:

**Example**

```ts
import { Option } from "effect"

const maybeName: Option.Option<string> = Option.some("John")
const maybeAge: Option.Option<number> = Option.none()

console.log(Option.all([maybeName, maybeAge]))
// Output: { _id: 'Option', _tag: 'None' }
```

## gen

Similar to [Effect.gen](/docs/getting-started/using-generators/), `Option.gen` provides a more readable, generator-based syntax for working with `Option` values, making code that involves `Option` easier to write and understand. This approach is similar to using `async/await` but tailored for `Option`.

**Example** (Using `Option.gen` to Create a Combined Value)

```ts twoslash
import { Option } from "effect"

const maybeName: Option.Option<string> = Option.some("John")
const maybeAge: Option.Option<number> = Option.some(25)

const person = Option.gen(function* () {
  const name = (yield* maybeName).toUpperCase()
  const age = yield* maybeAge
  return { name, age }
})

console.log(person)
/*
Output:
{ _id: 'Option', _tag: 'Some', value: { name: 'JOHN', age: 25 } }
*/
```

When any of the `Option` values in the sequence is `None`, the generator immediately returns the `None` value, skipping further operations:

**Example** (Handling a `None` Value with `Option.gen`)

In this example, `Option.gen` halts execution as soon as it encounters the `None` value, effectively propagating the missing value without performing further operations.

```ts twoslash
import { Option } from "effect"

const maybeName: Option.Option<string> = Option.none()
const maybeAge: Option.Option<number> = Option.some(25)

const program = Option.gen(function* () {
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
{ _id: 'Option', _tag: 'None' }
*/
```

The use of `console.log` in these example is for demonstration purposes only. When using `Option.gen`, avoid including side effects in your generator functions, as `Option` should remain a pure data structure.

## Equivalence

You can compare `Option` values using the `Option.getEquivalence` function. This function allows you to specify how to compare the contents of `Option` types by providing an [Equivalence](/docs/behaviour/equivalence/) for the type of value they may contain.

**Example** (Comparing Optional Numbers for Equivalence)

Suppose you have optional numbers and want to check if they are equivalent. Here's how you can use `Option.getEquivalence`:

```ts twoslash
import { Option, Equivalence } from "effect"

const myEquivalence = Option.getEquivalence(Equivalence.number)

console.log(myEquivalence(Option.some(1), Option.some(1)))
// Output: true, both options contain the number 1

console.log(myEquivalence(Option.some(1), Option.some(2)))
// Output: false, the numbers are different

console.log(myEquivalence(Option.some(1), Option.none()))
// Output: false, one is a number and the other is empty
```

## Sorting

You can sort a collection of `Option` values using the `Option.getOrder` function. This function helps specify a custom sorting rule for the type of value contained within the `Option`.

**Example** (Sorting Optional Numbers)

Suppose you have a list of optional numbers and want to sort them in ascending order, with empty values (`Option.none()`) treated as the lowest:

```ts twoslash
import { Option, Array, Order } from "effect"

const items = [Option.some(1), Option.none(), Option.some(2)]

// Create an order for sorting Option values containing numbers
const myOrder = Option.getOrder(Order.number)

console.log(Array.sort(myOrder)(items))
/*
Output:
[
  { _id: 'Option', _tag: 'None' },           // None appears first because it's considered the lowest
  { _id: 'Option', _tag: 'Some', value: 1 }, // Sorted in ascending order
  { _id: 'Option', _tag: 'Some', value: 2 }
]
*/
```

**Example** (Sorting Optional Dates in Reverse Order)

Consider a more complex case where you have a list of objects containing optional dates, and you want to sort them in descending order, with `Option.none()` values at the end:

```ts
import { Option, Array, Order } from "effect"

const items = [
  { data: Option.some(new Date(10)) },
  { data: Option.some(new Date(20)) },
  { data: Option.none() }
]

// Define the order to sort dates within Option values in reverse
const sorted = Array.sortWith(
  items,
  (item) => item.data,
  Order.reverse(Option.getOrder(Order.Date))
)

console.log(sorted)
/*
Output:
[
  { data: { _id: 'Option', _tag: 'Some', value: '1970-01-01T00:00:00.020Z' } },
  { data: { _id: 'Option', _tag: 'Some', value: '1970-01-01T00:00:00.010Z' } },
  { data: { _id: 'Option', _tag: 'None' } } // None placed last
]
*/
```
