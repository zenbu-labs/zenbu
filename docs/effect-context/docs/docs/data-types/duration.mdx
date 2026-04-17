---
title: Duration
description: Work with precise time spans using Effect's Duration, supporting creation, comparison, and arithmetic operations for efficient time handling.
sidebar:
  order: 6
---

The `Duration` data type data type is used to represent specific non-negative spans of time. It is commonly used to represent time intervals or durations in various operations, such as timeouts, delays, or scheduling. The `Duration` type provides a convenient way to work with time units and perform calculations on durations.

## Creating Durations

The Duration module includes several constructors to create durations in different units.

**Example** (Creating Durations in Various Units)

```ts twoslash
import { Duration } from "effect"

// Create a duration of 100 milliseconds
const duration1 = Duration.millis(100)

// Create a duration of 2 seconds
const duration2 = Duration.seconds(2)

// Create a duration of 5 minutes
const duration3 = Duration.minutes(5)
```

You can create durations using units such as nanoseconds, microsecond, milliseconds, seconds, minutes, hours, days, and weeks.

For an infinite duration, use `Duration.infinity`.

**Example** (Creating an Infinite Duration)

```ts twoslash
import { Duration } from "effect"

console.log(String(Duration.infinity))
/*
Output:
Duration(Infinity)
*/
```

Another option for creating durations is using the `Duration.decode` helper:

- `number` values are treated as milliseconds.
- `bigint` values are treated as nanoseconds.
- Strings must follow the format `"${number} ${unit}"`.

**Example** (Decoding Values into Durations)

```ts twoslash
import { Duration } from "effect"

Duration.decode(10n) // same as Duration.nanos(10)
Duration.decode(100) // same as Duration.millis(100)
Duration.decode(Infinity) // same as Duration.infinity

Duration.decode("10 nanos") // same as Duration.nanos(10)
Duration.decode("20 micros") // same as Duration.micros(20)
Duration.decode("100 millis") // same as Duration.millis(100)
Duration.decode("2 seconds") // same as Duration.seconds(2)
Duration.decode("5 minutes") // same as Duration.minutes(5)
Duration.decode("7 hours") // same as Duration.hours(7)
Duration.decode("3 weeks") // same as Duration.weeks(3)
```

## Getting the Duration Value

You can retrieve the value of a duration in milliseconds using `Duration.toMillis`.

**Example** (Getting Duration in Milliseconds)

```ts twoslash
import { Duration } from "effect"

console.log(Duration.toMillis(Duration.seconds(30)))
// Output: 30000
```

To get the value of a duration in nanoseconds, use `Duration.toNanos`. Note that `toNanos` returns an `Option<bigint>` because the duration might be infinite.

**Example** (Getting Duration in Nanoseconds)

```ts twoslash
import { Duration } from "effect"

console.log(Duration.toNanos(Duration.millis(100)))
/*
Output:
{ _id: 'Option', _tag: 'Some', value: 100000000n }
*/
```

To get a `bigint` value without `Option`, use `Duration.unsafeToNanos`. However, it will throw an error for infinite durations.

**Example** (Retrieving Nanoseconds Unsafely)

```ts twoslash
import { Duration } from "effect"

console.log(Duration.unsafeToNanos(Duration.millis(100)))
// Output: 100000000n

console.log(Duration.unsafeToNanos(Duration.infinity))
/*
throws:
Error: Cannot convert infinite duration to nanos
  ...stack trace...
*/
```

## Comparing Durations

Use the following functions to compare two durations:

| API                    | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `lessThan`             | Returns `true` if the first duration is less than the second.                |
| `lessThanOrEqualTo`    | Returns `true` if the first duration is less than or equal to the second.    |
| `greaterThan`          | Returns `true` if the first duration is greater than the second.             |
| `greaterThanOrEqualTo` | Returns `true` if the first duration is greater than or equal to the second. |

**Example** (Comparing Two Durations)

```ts twoslash
import { Duration } from "effect"

const duration1 = Duration.seconds(30)
const duration2 = Duration.minutes(1)

console.log(Duration.lessThan(duration1, duration2))
// Output: true

console.log(Duration.lessThanOrEqualTo(duration1, duration2))
// Output: true

console.log(Duration.greaterThan(duration1, duration2))
// Output: false

console.log(Duration.greaterThanOrEqualTo(duration1, duration2))
// Output: false
```

## Performing Arithmetic Operations

You can perform arithmetic operations on durations, like addition and multiplication.

**Example** (Adding and Multiplying Durations)

```ts twoslash
import { Duration } from "effect"

const duration1 = Duration.seconds(30)
const duration2 = Duration.minutes(1)

// Add two durations
console.log(String(Duration.sum(duration1, duration2)))
/*
Output:
Duration(1m 30s)
*/

// Multiply a duration by a factor
console.log(String(Duration.times(duration1, 2)))
/*
Output:
Duration(1m)
*/
```

## Conversions

Converts a `Duration` to a human readable string.

**Example** 

```ts twoslash
import { Duration } from "effect"

Duration.format(Duration.millis(1000)) // "1s"
Duration.format(Duration.millis(1001)) // "1s 1ms"
```




