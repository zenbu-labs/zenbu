---
title: BigDecimal
description: The BigDecimal data type represents arbitrary-precision decimal numbers.
sidebar:
  order: 1
---

import { Aside } from "@astrojs/starlight/components"

In JavaScript, numbers are typically stored as 64-bit floating-point values. While floating-point numbers are fast and versatile, they can introduce small rounding errors. These are often hard to notice in everyday usage but can become problematic in areas like finance or statistics, where small inaccuracies may lead to larger discrepancies over time.

By using the BigDecimal module, you can avoid these issues and perform calculations with a higher degree of precision.

The `BigDecimal` data type can represent real numbers with a large number of decimal places, preventing the common errors of floating-point math (for example, 0.1 + 0.2 ≠ 0.3).

## How BigDecimal Works

A `BigDecimal` represents a number using two components:

1. `value`: A `BigInt` that stores the digits of the number.
2. `scale`: A 64-bit integer that determines the position of the decimal point.

The number represented by a `BigDecimal` is calculated as: value x 10<sup>-scale</sup>.

- If `scale` is zero or positive, it specifies the number of digits to the right of the decimal point.
- If `scale` is negative, the `value` is multiplied by 10 raised to the power of the negated scale.

For example:

- A `BigDecimal` with `value = 12345n` and `scale = 2` represents `123.45`.
- A `BigDecimal` with `value = 12345n` and `scale = -2` represents `1234500`.

The maximum precision is large but not infinite, limited to 2<sup>63</sup> decimal places.

## Creating a BigDecimal

### make

The `make` function creates a `BigDecimal` by specifying a `BigInt` value and a scale. The `scale` determines the number of digits to the right of the decimal point.

**Example** (Creating a BigDecimal with a Specified Scale)

```ts twoslash
import { BigDecimal } from "effect"

// Create a BigDecimal from a BigInt (1n) with a scale of 2
const decimal = BigDecimal.make(1n, 2)

console.log(decimal)
// Output: { _id: 'BigDecimal', value: '1', scale: 2 }

// Convert the BigDecimal to a string
console.log(String(decimal))
// Output: BigDecimal(0.01)

// Format the BigDecimal as a standard decimal string
console.log(BigDecimal.format(decimal))
// Output: 0.01

// Convert the BigDecimal to exponential notation
console.log(BigDecimal.toExponential(decimal))
// Output: 1e-2
```

### fromBigInt

The `fromBigInt` function creates a `BigDecimal` from a `bigint`. The `scale` defaults to `0`, meaning the number has no fractional part.

**Example** (Creating a BigDecimal from a BigInt)

```ts twoslash
import { BigDecimal } from "effect"

const decimal = BigDecimal.fromBigInt(10n)

console.log(decimal)
// Output: { _id: 'BigDecimal', value: '10', scale: 0 }
```

### fromString

Parses a numerical string into a `BigDecimal`. Returns an `Option<BigDecimal>`:

- `Some(BigDecimal)` if the string is valid.
- `None` if the string is invalid.

**Example** (Parsing a String into a BigDecimal)

```ts twoslash
import { BigDecimal } from "effect"

const decimal = BigDecimal.fromString("0.02")

console.log(decimal)
/*
Output:
{
  _id: 'Option',
  _tag: 'Some',
  value: { _id: 'BigDecimal', value: '2', scale: 2 }
}
*/
```

### unsafeFromString

The `unsafeFromString` function is a variant of `fromString` that throws an error if the input string is invalid. Use this only when you are confident that the input will always be valid.

**Example** (Unsafe Parsing of a String)

```ts twoslash
import { BigDecimal } from "effect"

const decimal = BigDecimal.unsafeFromString("0.02")

console.log(decimal)
// Output: { _id: 'BigDecimal', value: '2', scale: 2 }
```

### unsafeFromNumber

Creates a `BigDecimal` from a JavaScript `number`. Throws a `RangeError` for non-finite numbers (`NaN`, `+Infinity`, or `-Infinity`).

**Example** (Unsafe Parsing of a Number)

```ts twoslash
import { BigDecimal } from "effect"

console.log(BigDecimal.unsafeFromNumber(123.456))
// Output: { _id: 'BigDecimal', value: '123456', scale: 3 }
```

<Aside type="caution" title="Avoid Direct Conversion">
  Avoid converting floating-point numbers directly to `BigDecimal`, as
  their representation may already introduce precision issues.
</Aside>

## Basic Arithmetic Operations

The BigDecimal module supports a variety of arithmetic operations that provide precision and avoid the rounding errors common in standard JavaScript arithmetic. Below is a list of supported operations:

| Function          | Description                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `sum`             | Adds two `BigDecimal` values.                                                                                  |
| `subtract`        | Subtracts one `BigDecimal` value from another.                                                                 |
| `multiply`        | Multiplies two `BigDecimal` values.                                                                            |
| `divide`          | Divides one `BigDecimal` value by another, returning an `Option<BigDecimal>`.                                  |
| `unsafeDivide`    | Divides one `BigDecimal` value by another, throwing an error if the divisor is zero.                           |
| `negate`          | Negates a `BigDecimal` value (i.e., changes its sign).                                                         |
| `remainder`       | Returns the remainder of dividing one `BigDecimal` value by another, returning an `Option<BigDecimal>`.        |
| `unsafeRemainder` | Returns the remainder of dividing one `BigDecimal` value by another, throwing an error if the divisor is zero. |
| `sign`            | Returns the sign of a `BigDecimal` value (`-1`, `0`, or `1`).                                                  |
| `abs`             | Returns the absolute value of a `BigDecimal`.                                                                  |

**Example** (Performing Basic Arithmetic with BigDecimal)

```ts twoslash
import { BigDecimal } from "effect"

const dec1 = BigDecimal.unsafeFromString("1.05")
const dec2 = BigDecimal.unsafeFromString("2.10")

// Addition
console.log(String(BigDecimal.sum(dec1, dec2)))
// Output: BigDecimal(3.15)

// Multiplication
console.log(String(BigDecimal.multiply(dec1, dec2)))
// Output: BigDecimal(2.205)

// Subtraction
console.log(String(BigDecimal.subtract(dec2, dec1)))
// Output: BigDecimal(1.05)

// Division (safe, returns Option<BigDecimal>)
console.log(BigDecimal.divide(dec2, dec1))
/*
Output:
{
  _id: 'Option',
  _tag: 'Some',
  value: { _id: 'BigDecimal', value: '2', scale: 0 }
}
*/

// Division (unsafe, throws if divisor is zero)
console.log(String(BigDecimal.unsafeDivide(dec2, dec1)))
// Output: BigDecimal(2)

// Negation
console.log(String(BigDecimal.negate(dec1)))
// Output: BigDecimal(-1.05)

// Modulus (unsafe, throws if divisor is zero)
console.log(
  String(
    BigDecimal.unsafeRemainder(dec2, BigDecimal.unsafeFromString("0.6"))
  )
)
// Output: BigDecimal(0.3)
```

Using `BigDecimal` for arithmetic operations helps to avoid the inaccuracies commonly encountered with floating-point numbers in JavaScript. For example:

**Example** (Avoiding Floating-Point Errors)

```ts twoslash
const dec1 = 1.05
const dec2 = 2.1

console.log(String(dec1 + dec2))
// Output: 3.1500000000000004
```

## Comparison Operations

The `BigDecimal` module provides several functions for comparing decimal values. These allow you to determine the relative order of two values, find the minimum or maximum, and check specific properties like positivity or integer status.

### Comparison Functions

| Function               | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `lessThan`             | Checks if the first `BigDecimal` is smaller than the second.             |
| `lessThanOrEqualTo`    | Checks if the first `BigDecimal` is smaller than or equal to the second. |
| `greaterThan`          | Checks if the first `BigDecimal` is larger than the second.              |
| `greaterThanOrEqualTo` | Checks if the first `BigDecimal` is larger than or equal to the second.  |
| `min`                  | Returns the smaller of two `BigDecimal` values.                          |
| `max`                  | Returns the larger of two `BigDecimal` values.                           |

**Example** (Comparing Two BigDecimal Values)

```ts twoslash
import { BigDecimal } from "effect"

const dec1 = BigDecimal.unsafeFromString("1.05")
const dec2 = BigDecimal.unsafeFromString("2.10")

console.log(BigDecimal.lessThan(dec1, dec2))
// Output: true

console.log(BigDecimal.lessThanOrEqualTo(dec1, dec2))
// Output: true

console.log(BigDecimal.greaterThan(dec1, dec2))
// Output: false

console.log(BigDecimal.greaterThanOrEqualTo(dec1, dec2))
// Output: false

console.log(BigDecimal.min(dec1, dec2))
// Output: { _id: 'BigDecimal', value: '105', scale: 2 }

console.log(BigDecimal.max(dec1, dec2))
// Output: { _id: 'BigDecimal', value: '210', scale: 2 }
```

### Predicates for Comparison

The module also includes predicates to check specific properties of a `BigDecimal`:

| Predicate    | Description                                                    |
| ------------ | -------------------------------------------------------------- |
| `isZero`     | Checks if the value is exactly zero.                           |
| `isPositive` | Checks if the value is positive.                               |
| `isNegative` | Checks if the value is negative.                               |
| `between`    | Checks if the value lies within a specified range (inclusive). |
| `isInteger`  | Checks if the value is an integer (i.e., no fractional part).  |

**Example** (Checking the Sign and Properties of BigDecimal Values)

```ts twoslash
import { BigDecimal } from "effect"

const dec1 = BigDecimal.unsafeFromString("1.05")
const dec2 = BigDecimal.unsafeFromString("-2.10")

console.log(BigDecimal.isZero(BigDecimal.unsafeFromString("0")))
// Output: true

console.log(BigDecimal.isPositive(dec1))
// Output: true

console.log(BigDecimal.isNegative(dec2))
// Output: true

console.log(
  BigDecimal.between({
    minimum: BigDecimal.unsafeFromString("1"),
    maximum: BigDecimal.unsafeFromString("2")
  })(dec1)
)
// Output: true

console.log(
  BigDecimal.isInteger(dec2),
  BigDecimal.isInteger(BigDecimal.fromBigInt(3n))
)
// Output: false true
```

## Normalization and Equality

In some cases, two `BigDecimal` values can have different internal representations but still represent the same number.

For example, `1.05` could be internally represented with different scales, such as:

- `105n` with a scale of `2`
- `1050n` with a scale of `3`

To ensure consistency, you can normalize a `BigDecimal` to adjust the scale and remove trailing zeros.

### Normalization

The `BigDecimal.normalize` function adjusts the scale of a `BigDecimal` and eliminates any unnecessary trailing zeros in its internal representation.

**Example** (Normalizing a BigDecimal)

```ts twoslash
import { BigDecimal } from "effect"

const dec = BigDecimal.make(1050n, 3)

console.log(BigDecimal.normalize(dec))
// Output: { _id: 'BigDecimal', value: '105', scale: 2 }
```

### Equality

To check if two `BigDecimal` values are numerically equal, regardless of their internal representation, use the `BigDecimal.equals` function.

**Example** (Checking Equality)

```ts twoslash
import { BigDecimal } from "effect"

const dec1 = BigDecimal.make(105n, 2)
const dec2 = BigDecimal.make(1050n, 3)

console.log(BigDecimal.equals(dec1, dec2))
// Output: true
```
