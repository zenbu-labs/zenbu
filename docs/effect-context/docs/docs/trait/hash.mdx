---
title: Hash
description: Optimize equality checks with efficient hashing for faster comparisons in collections like hash sets and maps.
sidebar:
  order: 1
---

The `Hash` interface is closely tied to the [Equal](/docs/trait/equal/) interface and serves a supportive role in optimizing equality checks by providing a mechanism for hashing. Hashing is an important step in the efficient determination of equality between two values, particularly when used with data structures like hash tables.

## Role of Hash in Equality Checking

The primary purpose of the `Hash` interface is to provide a quick and efficient way to determine if two values are definitely not equal, thereby complementing the [Equal](/docs/trait/equal/) interface. When two values implement the [Equal](/docs/trait/equal/) interface, their hash values (computed using the `Hash` interface) are compared first:

- **Different Hash Values**: If the hash values are different, it is guaranteed that the values themselves are different. This quick check allows the system to avoid a potentially expensive equality check.
- **Same Hash Values**: If the hash values are the same, it does not guarantee that the values are equal, only that they might be. In this case, a more thorough comparison using the [Equal](/docs/trait/equal/) interface is performed to determine actual equality.

This method dramatically speeds up the equality checking process, especially in collections where quick look-up and insertion times are crucial, such as in hash sets or hash maps.

## Implementing the Hash Interface

Consider a scenario where you have a custom `Person` class, and you want to check if two instances are equal based on their properties.
By implementing both the `Equal` and `Hash` interfaces, you can efficiently manage these checks:

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

const alice = new Person(1, "Alice", 30)
console.log(Equal.equals(alice, new Person(1, "Alice", 30)))
// Output: true

const bob = new Person(2, "Bob", 40)
console.log(Equal.equals(alice, bob))
// Output: false
```

Explanation:

- The `[Equal.symbol]` method determines equality by comparing the `id`, `name`, and `age` fields of `Person` instances. This approach ensures that the equality check is comprehensive and considers all relevant attributes.
- The `[Hash.symbol]` method computes a hash code using the `id` of the person. This value is used to quickly differentiate between instances in hashing operations, optimizing the performance of data structures that utilize hashing.
- The equality check returns `true` when comparing `alice` to a new `Person` object with identical property values and `false` when comparing `alice` to `bob` due to their differing property values.
