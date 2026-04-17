---
title: HashSet
description: Learn about HashSet data structures - both immutable and mutable variants.
sidebar:
  order: 9
---

import { Aside } from "@astrojs/starlight/components"

A HashSet represents an **unordered** collection of **unique** values with efficient lookup, insertion and removal operations.

The Effect library provides two versions of this structure:

- [HashSet](/docs/data-types/hash-set/#hashset) - Immutable
- [MutableHashSet](/docs/data-types/hash-set/#mutablehashset) - Mutable

Both versions provide constant-time operations on average. The main difference is how they handle changes: one returns new sets, the other modifies the original.

### Why use HashSet?

HashSet solves the problem of maintaining an **unsorted collection where each value appears exactly once**, with fast operations for checking membership and adding/removing values.

Some common use cases include:

- Tracking unique items (e.g., users who have completed an action)
- Efficiently testing for membership in a collection
- Performing set operations like union, intersection, and difference
- Eliminating duplicates from a collection

### When to use HashSet Instead of other collections

Choose HashSet (either variant) over other collections when:

- You need to ensure elements are unique
- You frequently need to check if an element exists in the collection
- You need to perform set operations like union, intersection, and difference
- The order of elements doesn't matter to your use case

Choose other collections when:

- You need to maintain insertion order (use `List` or `Array`)
- You need key-value associations (use `HashMap` or `MutableHashMap`)
- You need to frequently access elements by index (use `Array`)

### Choosing between immutable and mutable variants

Effect offers both immutable and mutable versions to support different coding styles and performance needs.

**HashSet**

This version never modifies the original set. Instead, it returns a new set for every change.

Characteristics:

- Operations return new instances instead of modifying the original
- Previous states are preserved
- Thread-safe by design
- Ideal for functional programming patterns
- Suitable for sharing across different parts of your application

**MutableHashSet**

This version allows direct updates: adding and removing values changes the set in place.

Characteristics:

- Operations modify the original set directly
- More efficient when building sets incrementally
- Requires careful handling to avoid unexpected side effects
- Better performance in scenarios with many modifications
- Ideal for localized use where mutations won't cause issues elsewhere

### When to use each variant

Use **HashSet** when:

- You need predictable behavior with no side effects
- You want to preserve previous states of your data
- You're sharing sets across different parts of your application
- You prefer functional programming patterns
- You need fiber safety in concurrent environments

Use **MutableHashSet** when:

- Performance is critical, and you need to avoid creating new instances
- You're building a collection incrementally with many additions/removals
- You're working in a controlled scope where mutation is safe
- You need to optimize memory usage in performance-critical code

### Hybrid approach

You can apply multiple updates to a `HashSet` in a temporary mutable context using `HashSet.mutate`. This allows you to perform several changes at once without modifying the original set.

**Example** (Batching changes without mutating the original)

```ts twoslash
import { HashSet } from "effect"

// Create an immutable HashSet
const original = HashSet.make(1, 2, 3)

// Apply several updates inside a temporary mutable draft
const modified = HashSet.mutate(original, (draft) => {
  HashSet.add(draft, 4)
  HashSet.add(draft, 5)
  HashSet.remove(draft, 1)
})

console.log(HashSet.toValues(original))
// Output: [1, 2, 3] - original remains unchanged

console.log(HashSet.toValues(modified))
// Output: [2, 3, 4, 5] - changes applied to a new version
```

## Performance characteristics

Both `HashSet` and `MutableHashSet` offer similar average-time performance for core operations:

| Operation      | HashSet      | MutableHashSet | Description                     |
| -------------- | ------------ | -------------- | ------------------------------- |
| Lookup         | O(1) average | O(1) average   | Check if a value exists         |
| Insertion      | O(1) average | O(1) average   | Add a value                     |
| Removal        | O(1) average | O(1) average   | Remove a value                  |
| Iteration      | O(n)         | O(n)           | Iterate over all values         |
| Set operations | O(n)         | O(n)           | Union, intersection, difference |

The main difference is how updates are handled:

- **HashSet** returns a new set for each change. This can be slower if many changes are made in a row.
- **MutableHashSet** updates the same set in place. This is usually faster when performing many changes.

## Equality and uniqueness

Both `HashSet` and `MutableHashSet` use Effect's [`Equal`](/docs/trait/equal/) trait to determine if two elements are the same. This ensures that each value appears only once in the set.

- **Primitive values** (like numbers or strings) are compared by value, similar to the `===` operator.
- **Objects and custom types** must implement the `Equal` interface to define what it means for two instances to be equal. If no implementation is provided, equality falls back to reference comparison.

**Example** (Using custom equality and hashing)

```ts twoslash
import { Equal, Hash, HashSet } from "effect"

// Define a custom class that implements the Equal interface
class Person implements Equal.Equal {
  constructor(
    readonly id: number,
    readonly name: string,
    readonly age: number
  ) {}

  // Two Person instances are equal if their id, name, and age match
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

  // Hash code is based on the id (must match the equality logic)
  [Hash.symbol](): number {
    return Hash.hash(this.id)
  }
}

// Add two different instances with the same content
const set = HashSet.empty().pipe(
  HashSet.add(new Person(1, "Alice", 30)),
  HashSet.add(new Person(1, "Alice", 30))
)

// Only one instance is kept
console.log(HashSet.size(set))
// Output: 1
```

### Simplifying Equality with Data and Schema

Effect's [`Data`](/docs/data-types/data/) and [`Schema.Data`](/docs/schema/effect-data-types/#interop-with-data) modules implement `Equal` for you automatically, based on structural equality.

**Example** (Using `Data.struct`)

```ts twoslash
import { Data, Equal, HashSet, pipe } from "effect"

// Define two records with the same content
const person1 = Data.struct({ id: 1, name: "Alice", age: 30 })
const person2 = Data.struct({ id: 1, name: "Alice", age: 30 })

// They are different object references
console.log(Object.is(person1, person2))
// Output: false

// But they are equal in value (based on content)
console.log(Equal.equals(person1, person2))
// Output: true

// Add both to a HashSet — only one will be stored
const set = pipe(
  HashSet.empty(),
  HashSet.add(person1),
  HashSet.add(person2)
)

console.log(HashSet.size(set))
// Output: 1
```

**Example** (Using `Schema.Data`)

```ts twoslash
import { Equal, MutableHashSet, Schema } from "effect"

// Define a schema that describes the structure of a Person
const PersonSchema = Schema.Data(
  Schema.Struct({
    id: Schema.Number,
    name: Schema.String,
    age: Schema.Number
  })
)

// Decode values from plain objects
const Person = Schema.decodeSync(PersonSchema)

const person1 = Person({ id: 1, name: "Alice", age: 30 })
const person2 = Person({ id: 1, name: "Alice", age: 30 })

// person1 and person2 are different instances but equal in value
console.log(Equal.equals(person1, person2))
// Output: true

// Add both to a MutableHashSet — only one will be stored
const set = MutableHashSet.empty().pipe(
  MutableHashSet.add(person1),
  MutableHashSet.add(person2)
)

console.log(MutableHashSet.size(set))
// Output: 1
```

## HashSet

A `HashSet<A>` is an **immutable**, **unordered** collection of **unique** values.
It guarantees that each value appears only once and supports fast operations like lookup, insertion, and removal.

Any operation that would modify the set (like adding or removing a value) returns a new `HashSet`, leaving the original unchanged.

### Operations

| Category     | Operation                                                                              | Description                                 | Time Complexity |
| ------------ | -------------------------------------------------------------------------------------- | ------------------------------------------- | --------------- |
| constructors | [empty](https://effect-ts.github.io/effect/effect/HashSet.ts.html#empty)               | Creates an empty HashSet                    | O(1)            |
| constructors | [fromIterable](https://effect-ts.github.io/effect/effect/HashSet.ts.html#fromiterable) | Creates a HashSet from an iterable          | O(n)            |
| constructors | [make](https://effect-ts.github.io/effect/effect/HashSet.ts.html#make)                 | Creates a HashSet from multiple values      | O(n)            |
| elements     | [has](https://effect-ts.github.io/effect/effect/HashSet.ts.html#has)                   | Checks if a value exists in the set         | O(1) avg        |
| elements     | [some](https://effect-ts.github.io/effect/effect/HashSet.ts.html#some)                 | Checks if any element satisfies a predicate | O(n)            |
| elements     | [every](https://effect-ts.github.io/effect/effect/HashSet.ts.html#every)               | Checks if all elements satisfy a predicate  | O(n)            |
| elements     | [isSubset](https://effect-ts.github.io/effect/effect/HashSet.ts.html#issubset)         | Checks if a set is a subset of another      | O(n)            |
| getters      | [values](https://effect-ts.github.io/effect/effect/HashSet.ts.html#values)             | Gets an `Iterator` of all values            | O(1)            |
| getters      | [toValues](https://effect-ts.github.io/effect/effect/HashSet.ts.html#tovalues)         | Gets an `Array` of all values               | O(n)            |
| getters      | [size](https://effect-ts.github.io/effect/effect/HashSet.ts.html#size)                 | Gets the number of elements                 | O(1)            |
| mutations    | [add](https://effect-ts.github.io/effect/effect/HashSet.ts.html#add)                   | Adds a value to the set                     | O(1) avg        |
| mutations    | [remove](https://effect-ts.github.io/effect/effect/HashSet.ts.html#remove)             | Removes a value from the set                | O(1) avg        |
| mutations    | [toggle](https://effect-ts.github.io/effect/effect/HashSet.ts.html#toggle)             | Toggles a value's presence                  | O(1) avg        |
| operations   | [difference](https://effect-ts.github.io/effect/effect/HashSet.ts.html#difference)     | Computes set difference (A - B)             | O(n)            |
| operations   | [intersection](https://effect-ts.github.io/effect/effect/HashSet.ts.html#intersection) | Computes set intersection (A ∩ B)           | O(n)            |
| operations   | [union](https://effect-ts.github.io/effect/effect/HashSet.ts.html#union)               | Computes set union (A ∪ B)                  | O(n)            |
| mapping      | [map](https://effect-ts.github.io/effect/effect/HashSet.ts.html#map)                   | Transforms each element                     | O(n)            |
| sequencing   | [flatMap](https://effect-ts.github.io/effect/effect/HashSet.ts.html#flatmap)           | Transforms and flattens elements            | O(n)            |
| traversing   | [forEach](https://effect-ts.github.io/effect/effect/HashSet.ts.html#foreach)           | Applies a function to each element          | O(n)            |
| folding      | [reduce](https://effect-ts.github.io/effect/effect/HashSet.ts.html#reduce)             | Reduces the set to a single value           | O(n)            |
| filtering    | [filter](https://effect-ts.github.io/effect/effect/HashSet.ts.html#filter)             | Keeps elements that satisfy a predicate     | O(n)            |
| partitioning | [partition](https://effect-ts.github.io/effect/effect/HashSet.ts.html#partition)       | Splits into two sets by a predicate         | O(n)            |

**Example** (Basic creation and operations)

```ts twoslash
import { HashSet } from "effect"

// Create an initial set with 3 values
const set1 = HashSet.make(1, 2, 3)

// Add a value (returns a new set)
const set2 = HashSet.add(set1, 4)

// The original set is unchanged
console.log(HashSet.toValues(set1))
// Output: [1, 2, 3]

console.log(HashSet.toValues(set2))
// Output: [1, 2, 3, 4]

// Perform set operations with another set
const set3 = HashSet.make(3, 4, 5)

// Combine both sets
const union = HashSet.union(set2, set3)

console.log(HashSet.toValues(union))
// Output: [1, 2, 3, 4, 5]

// Shared values
const intersection = HashSet.intersection(set2, set3)

console.log(HashSet.toValues(intersection))
// Output: [3, 4]

// Values only in set2
const difference = HashSet.difference(set2, set3)

console.log(HashSet.toValues(difference))
// Output: [1, 2]
```

**Example** (Chaining with `pipe`)

```ts twoslash
import { HashSet, pipe } from "effect"

const result = pipe(
  // Duplicates are ignored
  HashSet.make(1, 2, 2, 3, 4, 5, 5),
  // Keep even numbers
  HashSet.filter((n) => n % 2 === 0),
  // Double each value
  HashSet.map((n) => n * 2),
  // Convert to array
  HashSet.toValues
)

console.log(result)
// Output: [4, 8]
```

## MutableHashSet

A `MutableHashSet<A>` is a **mutable**, **unordered** collection of **unique** values.
Unlike `HashSet`, it allows direct modifications, operations like `add`, `remove`, and `clear` update the original set instead of returning a new one.

This mutability can improve performance when you need to build or update a set repeatedly, especially within a local or isolated scope.

### Operations

| Category     | Operation                                                                                     | Description                         | Complexity |
| ------------ | --------------------------------------------------------------------------------------------- | ----------------------------------- | ---------- |
| constructors | [empty](https://effect-ts.github.io/effect/effect/MutableHashSet.ts.html#empty)               | Creates an empty MutableHashSet     | O(1)       |
| constructors | [fromIterable](https://effect-ts.github.io/effect/effect/MutableHashSet.ts.html#fromiterable) | Creates a set from an iterable      | O(n)       |
| constructors | [make](https://effect-ts.github.io/effect/effect/MutableHashSet.ts.html#make)                 | Creates a set from multiple values  | O(n)       |
| elements     | [has](https://effect-ts.github.io/effect/effect/MutableHashSet.ts.html#has)                   | Checks if a value exists in the set | O(1) avg   |
| elements     | [add](https://effect-ts.github.io/effect/effect/MutableHashSet.ts.html#add)                   | Adds a value to the set             | O(1) avg   |
| elements     | [remove](https://effect-ts.github.io/effect/effect/MutableHashSet.ts.html#remove)             | Removes a value from the set        | O(1) avg   |
| getters      | [size](https://effect-ts.github.io/effect/effect/MutableHashSet.ts.html#size)                 | Gets the number of elements         | O(1)       |
| mutations    | [clear](https://effect-ts.github.io/effect/effect/MutableHashSet.ts.html#clear)               | Removes all values from the set     | O(1)       |

**Example** (Working with a mutable set)

```ts twoslash
import { MutableHashSet } from "effect"

// Create a mutable set with initial values
const set = MutableHashSet.make(1, 2, 3)

// Add a new element (updates the set in place)
MutableHashSet.add(set, 4)

// Check current contents
console.log([...set])
// Output: [1, 2, 3, 4]

// Remove an element (modifies in place)
MutableHashSet.remove(set, 1)

console.log([...set])
// Output: [2, 3, 4]

// Clear the set entirely
MutableHashSet.clear(set)

console.log(MutableHashSet.size(set))
// Output: 0
```

## Interoperability with JavaScript

Both `HashSet` and `MutableHashSet` implement the `Iterable` interface, so you can use them with JavaScript features like:

- the spread operator (`...`)
- `for...of` loops
- `Array.from`

You can also extract values as an array using `.toValues`.

**Example** (Using HashSet values in JS-native ways)

```ts twoslash
import { HashSet, MutableHashSet } from "effect"

// Immutable HashSet
const hashSet = HashSet.make(1, 2, 3)

// Mutable variant
const mutableSet = MutableHashSet.make(4, 5, 6)

// Convert HashSet to an iterator
//
//      ┌─── IterableIterator<number>
//      ▼
const iterable = HashSet.values(hashSet)

// Spread into console.log
console.log(...iterable)
// Output: 1 2 3

// Use in a for...of loop
for (const value of mutableSet) {
  console.log(value)
}
// Output: 4 5 6

// Convert to array with Array.from
console.log(Array.from(mutableSet))
// Output: [ 4, 5, 6 ]

// Convert immutable HashSet to array using toValues
//
//      ┌─── Array<number>
//      ▼
const array = HashSet.toValues(hashSet)

console.log(array)
// Output: [ 1, 2, 3 ]
```

<Aside type="caution" title="Performance considerations">
  Avoid repeatedly converting between `HashSet` and JavaScript arrays in
  hot paths or large collections. These operations involve copying data
  and can impact memory and speed.
</Aside>
