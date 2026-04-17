---
title: Data
description: Define immutable data structures, ensure equality, and manage errors seamlessly with Effect's Data module.
sidebar:
  order: 4
---

import { Aside } from "@astrojs/starlight/components"

The Data module simplifies creating and handling data structures in TypeScript. It provides tools for **defining data types**, ensuring **equality** between objects, and **hashing** data for efficient comparisons.

## Value Equality

The Data module provides constructors for creating data types with built-in support for equality and hashing, eliminating the need for custom implementations.

This means that two values created using these constructors are considered equal if they have the same structure and values.

### struct

In plain JavaScript, objects are considered equal only if they refer to the exact same instance.

**Example** (Comparing Two Objects in Plain JavaScript)

```ts twoslash
const alice = { name: "Alice", age: 30 }

// This comparison is false because they are different instances
// @errors: 2839
console.log(alice === { name: "Alice", age: 30 }) // Output: false
```

However, the `Data.struct` constructor allows you to compare values based on their structure and content.

**Example** (Creating and Checking Equality of Structs)

```ts twoslash
import { Data, Equal } from "effect"

//      ┌─── { readonly name: string; readonly age: number; }
//      ▼
const alice = Data.struct({ name: "Alice", age: 30 })

// Check if Alice is equal to a new object
// with the same structure and values
console.log(Equal.equals(alice, Data.struct({ name: "Alice", age: 30 })))
// Output: true

// Check if Alice is equal to a plain JavaScript object
// with the same content
console.log(Equal.equals(alice, { name: "Alice", age: 30 }))
// Output: false
```

The comparison performed by `Equal.equals` is **shallow**, meaning nested objects are not compared recursively unless they are also created using `Data.struct`.

**Example** (Shallow Comparison with Nested Objects)

```ts twoslash
import { Data, Equal } from "effect"

const nested = Data.struct({ name: "Alice", nested_field: { value: 42 } })

// This will be false because the nested objects are compared by reference
console.log(
  Equal.equals(
    nested,
    Data.struct({ name: "Alice", nested_field: { value: 42 } })
  )
)
// Output: false
```

To ensure nested objects are compared by structure, use `Data.struct` for them as well.

**Example** (Correctly Comparing Nested Objects)

```ts twoslash
import { Data, Equal } from "effect"

const nested = Data.struct({
  name: "Alice",
  nested_field: Data.struct({ value: 42 })
})

// Now, the comparison returns true
console.log(
  Equal.equals(
    nested,
    Data.struct({
      name: "Alice",
      nested_field: Data.struct({ value: 42 })
    })
  )
)
// Output: true
```

### tuple

To represent your data using tuples, you can use the `Data.tuple` constructor. This ensures that your tuples can be compared structurally.

**Example** (Creating and Checking Equality of Tuples)

```ts twoslash
import { Data, Equal } from "effect"

//      ┌─── readonly [string, number]
//      ▼
const alice = Data.tuple("Alice", 30)

// Check if Alice is equal to a new tuple
// with the same structure and values
console.log(Equal.equals(alice, Data.tuple("Alice", 30)))
// Output: true

// Check if Alice is equal to a plain JavaScript tuple
// with the same content
console.log(Equal.equals(alice, ["Alice", 30]))
// Output: false
```

<Aside type="caution" title="Shallow Comparison">
  `Equal.equals` only checks the top-level structure. Use `Data`
  constructors for nested objects if you need deep comparisons.
</Aside>

### array

You can use `Data.array` to create an array-like data structure that supports structural equality.

**Example** (Creating and Checking Equality of Arrays)

```ts twoslash
import { Data, Equal } from "effect"

//      ┌─── readonly number[]
//      ▼
const numbers = Data.array([1, 2, 3, 4, 5])

// Check if the array is equal to a new array
// with the same values
console.log(Equal.equals(numbers, Data.array([1, 2, 3, 4, 5])))
// Output: true

// Check if the array is equal to a plain JavaScript array
// with the same content
console.log(Equal.equals(numbers, [1, 2, 3, 4, 5]))
// Output: false
```

<Aside type="caution" title="Shallow Comparison">
  `Equal.equals` only checks the top-level structure. Use `Data`
  constructors for nested objects if you need deep comparisons.
</Aside>

## Constructors

The module introduces a concept known as "Case classes", which automate various essential operations when defining data types.
These operations include generating **constructors**, handling **equality** checks, and managing **hashing**.

Case classes can be defined in two primary ways:

- as plain objects using `case` or `tagged`
- as TypeScript classes using `Class` or `TaggedClass`

### case

The `Data.case` helper generates constructors and built-in support for equality checks and hashing for your data type.

**Example** (Defining a Case Class and Checking Equality)

In this example, `Data.case` is used to create a constructor for `Person`. The resulting instances have built-in support for equality checks, allowing you to compare them directly using `Equal.equals`.

```ts twoslash
import { Data, Equal } from "effect"

interface Person {
  readonly name: string
}

// Create a constructor for `Person`
//
//      ┌─── (args: { readonly name: string; }) => Person
//      ▼
const make = Data.case<Person>()

const alice = make({ name: "Alice" })

console.log(Equal.equals(alice, make({ name: "Alice" })))
// Output: true

console.log(Equal.equals(alice, make({ name: "John" })))
// Output: false
```

**Example** (Defining and Comparing Nested Case Classes)

This example demonstrates using `Data.case` to create nested data structures, such as a `Person` type containing an `Address`. Both `Person` and `Address` constructors support equality checks.

```ts twoslash
import { Data, Equal } from "effect"

interface Address {
  readonly street: string
  readonly city: string
}

// Create a constructor for `Address`
const Address = Data.case<Address>()

interface Person {
  readonly name: string
  readonly address: Address
}

// Create a constructor for `Person`
const Person = Data.case<Person>()

const alice = Person({
  name: "Alice",
  address: Address({ street: "123 Main St", city: "Wonderland" })
})

const anotherAlice = Person({
  name: "Alice",
  address: Address({ street: "123 Main St", city: "Wonderland" })
})

console.log(Equal.equals(alice, anotherAlice))
// Output: true
```

Alternatively, you can use `Data.struct` to create nested data structures without defining a separate `Address` constructor.

**Example** (Using `Data.struct` for Nested Objects)

```ts twoslash
import { Data, Equal } from "effect"

interface Person {
  readonly name: string
  readonly address: {
    readonly street: string
    readonly city: string
  }
}

// Create a constructor for `Person`
const Person = Data.case<Person>()

const alice = Person({
  name: "Alice",
  address: Data.struct({ street: "123 Main St", city: "Wonderland" })
})

const anotherAlice = Person({
  name: "Alice",
  address: Data.struct({ street: "123 Main St", city: "Wonderland" })
})

console.log(Equal.equals(alice, anotherAlice))
// Output: true
```

**Example** (Defining and Comparing Recursive Case Classes)

This example demonstrates a recursive structure using `Data.case` to define a binary tree where each node can contain other nodes.

```ts twoslash
import { Data, Equal } from "effect"

interface BinaryTree<T> {
  readonly value: T
  readonly left: BinaryTree<T> | null
  readonly right: BinaryTree<T> | null
}

// Create a constructor for `BinaryTree`
const BinaryTree = Data.case<BinaryTree<number>>()

const tree1 = BinaryTree({
  value: 0,
  left: BinaryTree({ value: 1, left: null, right: null }),
  right: null
})

const tree2 = BinaryTree({
  value: 0,
  left: BinaryTree({ value: 1, left: null, right: null }),
  right: null
})

console.log(Equal.equals(tree1, tree2))
// Output: true
```

### tagged

When you're working with a data type that includes a tag field, like in disjoint union types, defining the tag manually for each instance can get repetitive. Using the `case` approach requires you to specify the tag field every time, which can be cumbersome.

**Example** (Defining a Tagged Case Class Manually)

Here, we create a `Person` type with a `_tag` field using `Data.case`. Notice that the `_tag` needs to be specified for every new instance.

```ts twoslash
import { Data } from "effect"

interface Person {
  readonly _tag: "Person" // the tag
  readonly name: string
}

const Person = Data.case<Person>()

// Repeating `_tag: 'Person'` for each instance
const alice = Person({ _tag: "Person", name: "Alice" })
const bob = Person({ _tag: "Person", name: "Bob" })
```

To streamline this process, the `Data.tagged` helper automatically adds the tag. It follows the convention in the Effect ecosystem of naming the tag field as `"_tag"`.

**Example** (Using Data.tagged to Simplify Tagging)

The `Data.tagged` helper allows you to define the tag just once, making instance creation simpler.

```ts twoslash
import { Data } from "effect"

interface Person {
  readonly _tag: "Person" // the tag
  readonly name: string
}

const Person = Data.tagged<Person>("Person")

// The `_tag` field is automatically added
const alice = Person({ name: "Alice" })
const bob = Person({ name: "Bob" })

console.log(alice)
// Output: { name: 'Alice', _tag: 'Person' }
```

### Class

If you prefer working with classes instead of plain objects, you can use `Data.Class` as an alternative to `Data.case`. This approach may feel more natural in scenarios where you want a class-oriented structure, complete with methods and custom logic.

**Example** (Using Data.Class for a Class-Oriented Structure)

Here's how to define a `Person` class using `Data.Class`:

```ts twoslash
import { Data, Equal } from "effect"

// Define a Person class extending Data.Class
class Person extends Data.Class<{ name: string }> {}

// Create an instance of Person
const alice = new Person({ name: "Alice" })

// Check for equality between two instances
console.log(Equal.equals(alice, new Person({ name: "Alice" })))
// Output: true
```

One of the benefits of using classes is that you can easily add custom methods and getters. This allows you to extend the functionality of your data types.

**Example** (Adding Custom Getters to a Class)

In this example, we add a `upperName` getter to the `Person` class to return the name in uppercase:

```ts twoslash
import { Data } from "effect"

// Extend Person class with a custom getter
class Person extends Data.Class<{ name: string }> {
  get upperName() {
    return this.name.toUpperCase()
  }
}

// Create an instance and use the custom getter
const alice = new Person({ name: "Alice" })

console.log(alice.upperName)
// Output: ALICE
```

### TaggedClass

If you prefer a class-based approach but also want the benefits of tagging for disjoint unions, `Data.TaggedClass` can be a helpful option. It works similarly to `tagged` but is tailored for class definitions.

**Example** (Defining a Tagged Class with Built-In Tagging)

Here's how to define a `Person` class using `Data.TaggedClass`. Notice that the tag `"Person"` is automatically added:

```ts twoslash
import { Data, Equal } from "effect"

// Define a tagged class Person with the _tag "Person"
class Person extends Data.TaggedClass("Person")<{ name: string }> {}

// Create an instance of Person
const alice = new Person({ name: "Alice" })

console.log(alice)
// Output: Person { name: 'Alice', _tag: 'Person' }

// Check equality between two instances
console.log(Equal.equals(alice, new Person({ name: "Alice" })))
// Output: true
```

One benefit of using tagged classes is the ability to easily add custom methods and getters, extending the class's functionality as needed.

**Example** (Adding Custom Getters to a Tagged Class)

In this example, we add a `upperName` getter to the `Person` class, which returns the name in uppercase:

```ts twoslash
import { Data } from "effect"

// Extend the Person class with a custom getter
class Person extends Data.TaggedClass("Person")<{ name: string }> {
  get upperName() {
    return this.name.toUpperCase()
  }
}

// Create an instance and use the custom getter
const alice = new Person({ name: "Alice" })

console.log(alice.upperName)
// Output: ALICE
```

## Union of Tagged Structs

To create a disjoint union of tagged structs, you can use `Data.TaggedEnum` and `Data.taggedEnum`. These utilities make it straightforward to define and work with unions of plain objects.

### Definition

The type passed to `Data.TaggedEnum` must be an object where the keys represent the tags,
and the values define the structure of the corresponding data types.

**Example** (Defining a Tagged Union and Checking Equality)

```ts twoslash
import { Data, Equal } from "effect"

// Define a union type using TaggedEnum
type RemoteData = Data.TaggedEnum<{
  Loading: {}
  Success: { readonly data: string }
  Failure: { readonly reason: string }
}>

// Create constructors for each case in the union
const { Loading, Success, Failure } = Data.taggedEnum<RemoteData>()

// Instantiate different states
const state1 = Loading()
const state2 = Success({ data: "test" })
const state3 = Success({ data: "test" })
const state4 = Failure({ reason: "not found" })

// Check equality between states
console.log(Equal.equals(state2, state3)) // Output: true
console.log(Equal.equals(state2, state4)) // Output: false

// Display the states
console.log(state1) // Output: { _tag: 'Loading' }
console.log(state2) // Output: { data: 'test', _tag: 'Success' }
console.log(state4) // Output: { reason: 'not found', _tag: 'Failure' }
```

<Aside type="note" title="Tag Field Naming Convention">
  The tag field `"_tag"` is used to identify the type of each state,
  following Effect's naming convention.
</Aside>

### $is and $match

The `Data.taggedEnum` provides `$is` and `$match` functions for convenient type guarding and pattern matching.

**Example** (Using Type Guards and Pattern Matching)

```ts twoslash
import { Data } from "effect"

type RemoteData = Data.TaggedEnum<{
  Loading: {}
  Success: { readonly data: string }
  Failure: { readonly reason: string }
}>

const { $is, $match, Loading, Success } = Data.taggedEnum<RemoteData>()

// Use `$is` to create a type guard for "Loading"
const isLoading = $is("Loading")

console.log(isLoading(Loading()))
// Output: true
console.log(isLoading(Success({ data: "test" })))
// Output: false

// Use `$match` for pattern matching
const matcher = $match({
  Loading: () => "this is a Loading",
  Success: ({ data }) => `this is a Success: ${data}`,
  Failure: ({ reason }) => `this is a Failure: ${reason}`
})

console.log(matcher(Success({ data: "test" })))
// Output: "this is a Success: test"
```

### Adding Generics

You can create more flexible and reusable tagged unions by using `TaggedEnum.WithGenerics`. This approach allows you to define tagged unions that can handle different types dynamically.

**Example** (Using Generics with TaggedEnum)

```ts twoslash
import { Data } from "effect"

// Define a generic TaggedEnum for RemoteData
type RemoteData<Success, Failure> = Data.TaggedEnum<{
  Loading: {}
  Success: { data: Success }
  Failure: { reason: Failure }
}>

// Extend TaggedEnum.WithGenerics to add generics
interface RemoteDataDefinition extends Data.TaggedEnum.WithGenerics<2> {
  readonly taggedEnum: RemoteData<this["A"], this["B"]>
}

// Create constructors for the generic RemoteData
const { Loading, Failure, Success } =
  Data.taggedEnum<RemoteDataDefinition>()

// Instantiate each case with specific types
const loading = Loading()
const failure = Failure({ reason: "not found" })
const success = Success({ data: 1 })
```

## Errors

In Effect, handling errors is simplified using specialized constructors:

- `Error`
- `TaggedError`

These constructors make defining custom error types straightforward, while also providing useful integrations like equality checks and structured error handling.

### Error

`Data.Error` lets you create an `Error` type with extra fields beyond the typical `message` property.

**Example** (Creating a Custom Error with Additional Fields)

```ts twoslash
import { Data } from "effect"

// Define a custom error with additional fields
class NotFound extends Data.Error<{ message: string; file: string }> {}

// Create an instance of the custom error
const err = new NotFound({
  message: "Cannot find this file",
  file: "foo.txt"
})

console.log(err instanceof Error)
// Output: true

console.log(err.file)
// Output: foo.txt
console.log(err)
/*
Output:
NotFound [Error]: Cannot find this file
  file: 'foo.txt'
  ... stack trace ...
*/
```

You can yield an instance of `NotFound` directly in an [Effect.gen](/docs/getting-started/using-generators/), without needing to use `Effect.fail`.

**Example** (Yielding a Custom Error in `Effect.gen`)

```ts twoslash
import { Data, Effect } from "effect"

class NotFound extends Data.Error<{ message: string; file: string }> {}

const program = Effect.gen(function* () {
  yield* new NotFound({
    message: "Cannot find this file",
    file: "foo.txt"
  })
})

Effect.runPromise(program)
/*
throws:
Error: Cannot find this file
    at ... {
  name: '(FiberFailure) Error',
  [Symbol(effect/Runtime/FiberFailure/Cause)]: {
    _tag: 'Fail',
    error: NotFound [Error]: Cannot find this file
        at ...stack trace...
      file: 'foo.txt'
    }
  }
}
*/
```

### TaggedError

Effect provides a `TaggedError` API to add a `_tag` field automatically to your custom errors. This simplifies error handling with APIs like [Effect.catchTag](/docs/error-management/expected-errors/#catchtag) or [Effect.catchTags](/docs/error-management/expected-errors/#catchtags).

```ts twoslash
import { Data, Effect, Console } from "effect"

// Define a custom tagged error
class NotFound extends Data.TaggedError("NotFound")<{
  message: string
  file: string
}> {}

const program = Effect.gen(function* () {
  yield* new NotFound({
    message: "Cannot find this file",
    file: "foo.txt"
  })
}).pipe(
  // Catch and handle the tagged error
  Effect.catchTag("NotFound", (err) =>
    Console.error(`${err.message} (${err.file})`)
  )
)

Effect.runPromise(program)
// Output: Cannot find this file (foo.txt)
```

### Native Cause Support

Errors created using `Data.Error` or `Data.TaggedError` can include a `cause` property, integrating with the native `cause` feature of JavaScript's `Error` for more detailed error tracing.

**Example** (Using the `cause` Property)

```ts twoslash {22}
import { Data, Effect } from "effect"

// Define an error with a cause property
class MyError extends Data.Error<{ cause: Error }> {}

const program = Effect.gen(function* () {
  yield* new MyError({
    cause: new Error("Something went wrong")
  })
})

Effect.runPromise(program)
/*
throws:
Error: An error has occurred
    at ... {
  name: '(FiberFailure) Error',
  [Symbol(effect/Runtime/FiberFailure/Cause)]: {
    _tag: 'Fail',
    error: MyError
        at ...
      [cause]: Error: Something went wrong
          at ...
*/
```
