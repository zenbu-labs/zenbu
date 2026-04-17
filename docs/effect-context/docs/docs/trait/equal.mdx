---
title: Equal
description: Implement value-based equality checks for improved data integrity and predictable behavior in TypeScript.
sidebar:
  order: 0
---

The Equal module provides a simple and convenient way to define and check for equality between two values in TypeScript.

Here are some key reasons why Effect exports an Equal module:

1. **Value-Based Equality**: JavaScript's native equality operators (`===` and `==`) check for equality by reference, meaning they compare objects based on their memory addresses rather than their content. This behavior can be problematic when you want to compare objects with the same values but different references. The Equal module offers a solution by allowing developers to define custom equality checks based on the values of objects.

2. **Custom Equality**: The Equal module enables developers to implement custom equality checks for their data types and classes. This is crucial when you have specific requirements for determining when two objects should be considered equal. By implementing the `Equal` interface, developers can define their own equality logic.

3. **Data Integrity**: In some applications, maintaining data integrity is crucial. The ability to perform value-based equality checks ensures that identical data is not duplicated within collections like sets or maps. This can lead to more efficient memory usage and more predictable behavior.

4. **Predictable Behavior**: The Equal module promotes more predictable behavior when comparing objects. By explicitly defining equality criteria, developers can avoid unexpected results that may occur with JavaScript's default reference-based equality checks.

## How to Perform Equality Checking in Effect

In Effect it's advisable to **stop using** JavaScript's `===` and `==` operators and instead rely on the `Equal.equals` function.
This function can work with any data type that implements the `Equal` interface.
Some examples of such data types include [Option](/docs/data-types/option/), [Either](/docs/data-types/either/), [HashSet](https://effect-ts.github.io/effect/effect/HashSet.ts.html), and [HashMap](https://effect-ts.github.io/effect/effect/HashMap.ts.html).

When you use `Equal.equals` and your objects do not implement the `Equal` interface, it defaults to using the `===` operator for object comparison:

**Example** (Using `Equal.equals` with Default Comparison)

```ts twoslash
import { Equal } from "effect"

// Two objects with identical properties and values
const a = { name: "Alice", age: 30 }
const b = { name: "Alice", age: 30 }

// Equal.equals falls back to the default '===' comparison
console.log(Equal.equals(a, b))
// Output: false
```

In this example, `a` and `b` are two separate objects with the same contents. However, `===` considers them different because they occupy different memory locations. This behavior can lead to unexpected results when you want to compare values based on their content.

However, you can configure your models to ensure that `Equal.equals` behaves consistently with your custom equality checks. There are two alternative approaches:

1. **Implementing the `Equal` Interface**: This method is useful when you need to define your custom equality check.

2. **Using the Data Module**: For simple value equality, the [Data](/docs/data-types/data/) module provides a more straightforward solution by automatically generating default implementations for `Equal`.

Let's explore both.

### Implementing the Equal Interface

To create custom equality behavior, you can implement the `Equal` interface in your models. This interface extends the `Hash` interface from the [Hash](/docs/trait/hash/) module.

**Example** (Implementing `Equal` and `Hash` for a Custom Class)

```ts twoslash
import { Equal, Hash } from "effect"

class Person implements Equal.Equal {
  constructor(
    readonly id: number, // Unique identifier
    readonly name: string,
    readonly age: number
  ) {}

  // Define equality based on id, name, and age
  [Equal.symbol](that: Equal.Equal): boolean {
    if (that instanceof Person) {
      return (
        Equal.equals(this.id, that.id) &&
        Equal.equals(this.name, that.name) &&
        Equal.equals(this.age, that.age)
      )
    }
    return false
  }

  // Generate a hash code based on the unique id
  [Hash.symbol](): number {
    return Hash.hash(this.id)
  }
}
```

In the above code, we define a custom equality function `[Equal.symbol]` and a hash function `[Hash.symbol]` for the `Person` class. The `Hash` interface optimizes equality checks by comparing hash values instead of the objects themselves. When you use the `Equal.equals` function to compare two objects, it first checks if their hash values are equal. If not, it quickly determines that the objects are not equal, avoiding the need for a detailed property-by-property comparison.

Once you've implemented the `Equal` interface, you can utilize the `Equal.equals` function to check for equality using your custom logic.

**Example** (Comparing `Person` Instances)

```ts twoslash collapse={3-26}
import { Equal, Hash } from "effect"

class Person implements Equal.Equal {
  constructor(
    readonly id: number, // Unique identifier for each person
    readonly name: string,
    readonly age: number
  ) {}

  // Defines equality based on id, name, and age
  [Equal.symbol](that: Equal.Equal): boolean {
    if (that instanceof Person) {
      return (
        Equal.equals(this.id, that.id) &&
        Equal.equals(this.name, that.name) &&
        Equal.equals(this.age, that.age)
      )
    }
    return false
  }

  // Generates a hash code based primarily on the unique id
  [Hash.symbol](): number {
    return Hash.hash(this.id)
  }
}

const alice = new Person(1, "Alice", 30)
console.log(Equal.equals(alice, new Person(1, "Alice", 30)))
// Output: true

const bob = new Person(2, "Bob", 40)
console.log(Equal.equals(alice, bob))
// Output: false
```

In this code, the equality check returns `true` when comparing `alice` to a new `Person` object with identical property values and `false` when comparing `alice` to `bob` due to their differing property values.

### Simplifying Equality with the Data Module

Implementing both `Equal` and `Hash` can become cumbersome when all you need is straightforward value equality checks. Luckily, the [Data](/docs/data-types/data/) module provides a simpler solution. It offers APIs that automatically generate default implementations for both `Equal` and `Hash`.

**Example** (Using `Data.struct` for Equality Checks)

```ts twoslash
import { Equal, Data } from "effect"

const alice = Data.struct({ id: 1, name: "Alice", age: 30 })

const bob = Data.struct({ id: 2, name: "Bob", age: 40 })

console.log(
  Equal.equals(alice, Data.struct({ id: 1, name: "Alice", age: 30 }))
)
// Output: true

console.log(Equal.equals(alice, { id: 1, name: "Alice", age: 30 }))
// Output: false

console.log(Equal.equals(alice, bob))
// Output: false
```

In this example, we use the [Data.struct](/docs/data-types/data/#struct) function to create structured data objects and check their equality using `Equal.equals`. The Data module simplifies the process by providing a default implementation for both `Equal` and `Hash`, allowing you to focus on comparing values without the need for explicit implementations.

The Data module isn't limited to just structs. It can handle various data types, including tuples, arrays, and records. If you're curious about how to leverage its full range of features, you can explore the [Data module documentation](/docs/data-types/data/#value-equality).

## Working with Collections

JavaScript's built-in `Set` and `Map` can be a bit tricky when it comes to checking equality:

**Example** (Native `Set` with Reference-Based Equality)

```ts twoslash
const set = new Set()

// Adding two objects with the same content to the set
set.add({ name: "Alice", age: 30 })
set.add({ name: "Alice", age: 30 })

// Even though the objects have identical values, they are treated
// as different elements because JavaScript compares objects by reference,
// not by value.
console.log(set.size)
// Output: 2
```

Even though the two elements in the set have the same values, the set contains two elements. Why? JavaScript's `Set` checks for equality by reference, not by values.

To perform value-based equality checks, you'll need to use the `Hash*` collection types available in the `effect` package. These collection types, such as [HashSet](https://effect-ts.github.io/effect/effect/HashSet.ts.html) and [HashMap](https://effect-ts.github.io/effect/effect/HashMap.ts.html), provide support for the `Equal` interface.

### HashSet

When you use the `HashSet`, it correctly handles value-based equality checks. In the following example, even though you're adding two objects with the same values, the `HashSet` treats them as a single element.

**Example** (Using `HashSet` for Value-Based Equality)

```ts twoslash
import { HashSet, Data } from "effect"

// Creating a HashSet with objects that implement the Equal interface
const set = HashSet.empty().pipe(
  HashSet.add(Data.struct({ name: "Alice", age: 30 })),
  HashSet.add(Data.struct({ name: "Alice", age: 30 }))
)

// HashSet recognizes them as equal, so only one element is stored
console.log(HashSet.size(set))
// Output: 1
```

**Note**: It's crucial to use elements that implement the `Equal` interface, either by implementing custom equality checks or by using the Data module. This ensures proper functionality when working with `HashSet`. Without this, you'll encounter the same behavior as the native `Set` data type:

**Example** (Reference-Based Equality in `HashSet`)

```ts twoslash
import { HashSet } from "effect"

// Creating a HashSet with objects that do NOT implement
// the Equal interface
const set = HashSet.empty().pipe(
  HashSet.add({ name: "Alice", age: 30 }),
  HashSet.add({ name: "Alice", age: 30 })
)

// Since these objects are compared by reference,
// HashSet considers them different
console.log(HashSet.size(set))
// Output: 2
```

In this case, without using the Data module alongside `HashSet`, you'll experience the same behavior as the native `Set` data type. The set contains two elements because it checks for equality by reference, not by values.

### HashMap

When working with the `HashMap`, you have the advantage of comparing keys by their values instead of their references. This is particularly helpful in scenarios where you want to associate values with keys based on their content.

**Example** (Value-Based Key Comparisons with `HashMap`)

```ts twoslash
import { HashMap, Data } from "effect"

// Adding two objects with identical values as keys
const map = HashMap.empty().pipe(
  HashMap.set(Data.struct({ name: "Alice", age: 30 }), 1),
  HashMap.set(Data.struct({ name: "Alice", age: 30 }), 2)
)

console.log(HashMap.size(map))
// Output: 1

// Retrieve the value associated with a key
console.log(HashMap.get(map, Data.struct({ name: "Alice", age: 30 })))
/*
Output:
{ _id: 'Option', _tag: 'Some', value: 2 }
*/
```

In this code snippet, `HashMap` is used to create a map where the keys are objects constructed with `Data.struct`. These objects contain identical values, which would usually create separate entries in a regular JavaScript `Map` because the default comparison is reference-based.

`HashMap`, however, uses value-based comparison, meaning the two objects with identical content are treated as the same key. Thus, when we add both objects, the second key-value pair overrides the first, resulting in a single entry in the map.
