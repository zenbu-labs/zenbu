---
title: Order
description: Compare, sort, and manage value ordering with customizable tools for TypeScript.
sidebar:
  order: 2
---

The Order module provides a way to compare values and determine their order.
It defines an interface `Order<A>` which represents a single function for comparing two values of type `A`.
The function returns `-1`, `0`, or `1`, indicating whether the first value is less than, equal to, or greater than the second value.

Here's the basic structure of an `Order`:

```ts showLineNumbers=false
interface Order<A> {
  (first: A, second: A): -1 | 0 | 1
}
```

## Using the Built-in Orders

The Order module comes with several built-in comparators for common data types:

| Order    | Description                        |
| -------- | ---------------------------------- |
| `string` | Used for comparing strings.        |
| `number` | Used for comparing numbers.        |
| `bigint` | Used for comparing big integers.   |
| `Date`   | Used for comparing `Date` objects. |

**Example** (Using Built-in Comparators)

```ts twoslash
import { Order } from "effect"

console.log(Order.string("apple", "banana"))
// Output: -1, as "apple" < "banana"

console.log(Order.number(1, 1))
// Output: 0, as 1 = 1

console.log(Order.bigint(2n, 1n))
// Output: 1, as 2n > 1n
```

## Sorting Arrays

You can sort arrays using these comparators. The `Array` module offers a `sort` function that sorts arrays without altering the original one.

**Example** (Sorting Arrays with `Order`)

```ts twoslash
import { Order, Array } from "effect"

const strings = ["b", "a", "d", "c"]

const result = Array.sort(strings, Order.string)

console.log(strings) // Original array remains unchanged
// Output: [ 'b', 'a', 'd', 'c' ]

console.log(result) // Sorted array
// Output: [ 'a', 'b', 'c', 'd' ]
```

You can also use an `Order` as a comparator with JavaScript's native `Array.sort` method, but keep in mind that this will modify the original array.

**Example** (Using `Order` with Native `Array.prototype.sort`)

```ts twoslash
import { Order } from "effect"

const strings = ["b", "a", "d", "c"]

strings.sort(Order.string) // Modifies the original array

console.log(strings)
// Output: [ 'a', 'b', 'c', 'd' ]
```

## Deriving Orders

For more complex data structures, you may need custom sorting rules. The Order module lets you derive new `Order` instances from existing ones with the `Order.mapInput` function.

**Example** (Creating a Custom Order for Objects)

Imagine you have a list of `Person` objects, and you want to sort them by their names in ascending order.
To achieve this, you can create a custom `Order`.

```ts twoslash
import { Order } from "effect"

// Define the Person interface
interface Person {
  readonly name: string
  readonly age: number
}

// Create a custom order to sort Person objects by name in ascending order
//
//      ┌─── Order<Person>
//      ▼
const byName = Order.mapInput(
  Order.string,
  (person: Person) => person.name
)
```

The `Order.mapInput` function takes two arguments:

1. The existing `Order` you want to use as a base (`Order.string` in this case, for comparing strings).
2. A function that extracts the value you want to use for sorting from your data structure (`(person: Person) => person.name` in this case).

Once you have defined your custom `Order`, you can apply it to sort an array of `Person` objects:

**Example** (Sorting Objects Using a Custom Order)

```ts twoslash collapse={3-13}
import { Order, Array } from "effect"

// Define the Person interface
interface Person {
  readonly name: string
  readonly age: number
}

// Create a custom order to sort Person objects by name in ascending order
const byName = Order.mapInput(
  Order.string,
  (person: Person) => person.name
)

const persons: ReadonlyArray<Person> = [
  { name: "Charlie", age: 22 },
  { name: "Alice", age: 25 },
  { name: "Bob", age: 30 }
]

// Sort persons array using the custom order
const sortedPersons = Array.sort(persons, byName)

console.log(sortedPersons)
/*
Output:
[
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 30 },
  { name: 'Charlie', age: 22 }
]
*/
```

## Combining Orders

The Order module lets you combine multiple `Order` instances to create complex sorting rules. This is useful when sorting by multiple properties.

**Example** (Sorting by Multiple Criteria)

Imagine you have a list of people, each represented by an object with a `name` and an `age`. You want to sort this list first by name and then, for individuals with the same name, by age.

```ts twoslash
import { Order, Array } from "effect"

// Define the Person interface
interface Person {
  readonly name: string
  readonly age: number
}

// Create an Order to sort people by their names in ascending order
const byName = Order.mapInput(
  Order.string,
  (person: Person) => person.name
)

// Create an Order to sort people by their ages in ascending order
const byAge = Order.mapInput(Order.number, (person: Person) => person.age)

// Combine orders to sort by name, then by age
const byNameAge = Order.combine(byName, byAge)

const result = Array.sort(
  [
    { name: "Bob", age: 20 },
    { name: "Alice", age: 18 },
    { name: "Bob", age: 18 }
  ],
  byNameAge
)

console.log(result)
/*
Output:
[
  { name: 'Alice', age: 18 }, // Sorted by name
  { name: 'Bob', age: 18 },   // Sorted by age within the same name
  { name: 'Bob', age: 20 }
]
*/
```

## Additional Useful Functions

The Order module provides additional functions for common comparison operations, making it easier to work with ordered values.

### Reversing Order

`Order.reverse` inverts the order of comparison. If you have an `Order` for ascending values, reversing it makes it descending.

**Example** (Reversing an Order)

```ts twoslash
import { Order } from "effect"

const ascendingOrder = Order.number

const descendingOrder = Order.reverse(ascendingOrder)

console.log(ascendingOrder(1, 3))
// Output: -1 (1 < 3 in ascending order)
console.log(descendingOrder(1, 3))
// Output: 1 (1 > 3 in descending order)
```

### Comparing Values

These functions allow you to perform simple comparisons between values:

| API                    | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `lessThan`             | Checks if one value is strictly less than another.       |
| `greaterThan`          | Checks if one value is strictly greater than another.    |
| `lessThanOrEqualTo`    | Checks if one value is less than or equal to another.    |
| `greaterThanOrEqualTo` | Checks if one value is greater than or equal to another. |

**Example** (Using Comparison Functions)

```ts twoslash
import { Order } from "effect"

console.log(Order.lessThan(Order.number)(1, 2))
// Output: true (1 < 2)

console.log(Order.greaterThan(Order.number)(5, 3))
// Output: true (5 > 3)

console.log(Order.lessThanOrEqualTo(Order.number)(2, 2))
// Output: true (2 <= 2)

console.log(Order.greaterThanOrEqualTo(Order.number)(4, 4))
// Output: true (4 >= 4)
```

### Finding Minimum and Maximum

The `Order.min` and `Order.max` functions return the minimum or maximum value between two values, considering the order.

**Example** (Finding Minimum and Maximum Numbers)

```ts twoslash
import { Order } from "effect"

console.log(Order.min(Order.number)(3, 1))
// Output: 1 (1 is the minimum)

console.log(Order.max(Order.number)(5, 8))
// Output: 8 (8 is the maximum)
```

### Clamping Values

`Order.clamp` restricts a value within a given range. If the value is outside the range, it is adjusted to the nearest bound.

**Example** (Clamping Numbers to a Range)

```ts twoslash
import { Order } from "effect"

// Define a function to clamp numbers between 20 and 30
const clampNumbers = Order.clamp(Order.number)({
  minimum: 20,
  maximum: 30
})

// Value 26 is within the range [20, 30], so it remains unchanged
console.log(clampNumbers(26))
// Output: 26

// Value 10 is below the minimum bound, so it is clamped to 20
console.log(clampNumbers(10))
// Output: 20

// Value 40 is above the maximum bound, so it is clamped to 30
console.log(clampNumbers(40))
// Output: 30
```

### Checking Value Range

`Order.between` checks if a value falls within a specified inclusive range.

**Example** (Checking if Numbers Fall Within a Range)

```ts twoslash
import { Order } from "effect"

// Create a function to check if numbers are between 20 and 30
const betweenNumbers = Order.between(Order.number)({
  minimum: 20,
  maximum: 30
})

// Value 26 falls within the range [20, 30], so it returns true
console.log(betweenNumbers(26))
// Output: true

// Value 10 is below the minimum bound, so it returns false
console.log(betweenNumbers(10))
// Output: false

// Value 40 is above the maximum bound, so it returns false
console.log(betweenNumbers(40))
// Output: false
```
