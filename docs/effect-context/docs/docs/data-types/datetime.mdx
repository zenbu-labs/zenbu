---
title: DateTime
description: Work with precise points in time using Effect's DateTime, supporting creation, comparison, and arithmetic operations for efficient time handling.
sidebar:
  order: 5
---

import { Aside } from "@astrojs/starlight/components"

Working with dates and times in JavaScript can be challenging. The built-in `Date` object mutates its internal state, and time zone handling can be confusing. These design choices can lead to errors when working on applications that rely on date-time accuracy, such as scheduling systems, timestamping services, or logging utilities.

The DateTime module aims to address these limitations by offering:

- **Immutable Data**: Each `DateTime` is an immutable structure, reducing mistakes related to in-place mutations.
- **Time Zone Support**: `DateTime` provides robust support for time zones, including automatic daylight saving time adjustments.
- **Arithmetic Operations**: You can perform arithmetic operations on `DateTime` instances, such as adding or subtracting durations.

## The DateTime Type

A `DateTime` represents a moment in time. It can be stored as either a simple UTC value or as a value with an associated time zone. Storing time this way helps you manage both precise timestamps and the context for how that time should be displayed or interpreted.

There are two main variants of `DateTime`:

1. **Utc**: An immutable structure that uses `epochMillis` (milliseconds since the Unix epoch) to represent a point in time in Coordinated Universal Time (UTC).

2. **Zoned**: Includes `epochMillis` along with a `TimeZone`, allowing you to attach an offset or a named region (like "America/New_York") to the timestamp.

### Why Have Two Variants?

- **Utc** is straightforward if you only need a universal reference without relying on local time zones.
- **Zoned** is helpful when you need to keep track of time zone information for tasks such as converting to local times or adjusting for daylight saving time.

### TimeZone Variants

A `TimeZone` can be either:

- **Offset**: Represents a fixed offset from UTC (for example, UTC+2 or UTC-5).
- **Named**: Uses a named region (e.g., "Europe/London" or "America/New_York") that automatically accounts for region-specific rules like daylight saving time changes.

### TypeScript Definition

Below is the TypeScript definition for the `DateTime` type:

```ts showLineNumbers=false
type DateTime = Utc | Zoned

interface Utc {
  readonly _tag: "Utc"
  readonly epochMillis: number
}

interface Zoned {
  readonly _tag: "Zoned"
  readonly epochMillis: number
  readonly zone: TimeZone
}

type TimeZone = TimeZone.Offset | TimeZone.Named

declare namespace TimeZone {
  interface Offset {
    readonly _tag: "Offset"
    readonly offset: number
  }

  interface Named {
    readonly _tag: "Named"
    readonly id: string
  }
}
```

## The DateTime.Parts Type

The `DateTime.Parts` type defines the main components of a date, such as the year, month, day, hours, minutes, and seconds.

```ts showLineNumbers=false
namespace DateTime {
  interface Parts {
    readonly millis: number
    readonly seconds: number
    readonly minutes: number
    readonly hours: number
    readonly day: number
    readonly month: number
    readonly year: number
  }

  interface PartsWithWeekday extends Parts {
    readonly weekDay: number
  }
}
```

## The DateTime.Input Type

The `DateTime.Input` type is a flexible input type that can be used to create a `DateTime` instance. It can be one of the following:

- A `DateTime` instance
- A JavaScript `Date` object
- A numeric value representing milliseconds since the Unix epoch
- An object with partial date [parts](#the-datetimeparts-type) (e.g., `{ year: 2024, month: 1, day: 1 }`)
- A string that can be parsed by JavaScript's [Date.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse)

```ts showLineNumbers=false
namespace DateTime {
  type Input = DateTime | Partial<Parts> | Date | number | string
}
```

## Utc Constructors

`Utc` is an immutable structure that uses `epochMillis` (milliseconds since the Unix epoch) to represent a point in time in Coordinated Universal Time (UTC).

### unsafeFromDate

Creates a `Utc` from a JavaScript `Date`.
Throws an `IllegalArgumentException` if the provided `Date` is invalid.

When a `Date` object is passed, it is converted to a `Utc` instance. The time is interpreted as the local time of the system executing the code and then adjusted to UTC. This ensures a consistent, timezone-independent representation of the date and time.

**Example** (Converting Local Time to UTC in Italy)

The following example assumes the code is executed on a system in Italy (CET timezone):

```ts twoslash
import { DateTime } from "effect"

// Create a Utc instance from a local JavaScript Date
//
//     ┌─── Utc
//     ▼
const utc = DateTime.unsafeFromDate(new Date("2025-01-01 04:00:00"))

console.log(utc)
// Output: DateTime.Utc(2025-01-01T03:00:00.000Z)

console.log(utc.epochMillis)
// Output: 1735700400000
```

**Explanation**:

- The local time **2025-01-01 04:00:00** (in Italy, CET) is converted to **UTC** by subtracting the timezone offset (UTC+1 in January).
- As a result, the UTC time becomes **2025-01-01 03:00:00.000Z**.
- `epochMillis` provides the same time as milliseconds since the Unix Epoch, ensuring a precise numeric representation of the UTC timestamp.

### unsafeMake

Creates a `Utc` from a [DateTime.Input](#the-datetimeinput-type).

**Example** (Creating a DateTime with unsafeMake)

The following example assumes the code is executed on a system in Italy (CET timezone):

```ts twoslash
import { DateTime } from "effect"

// From a JavaScript Date
const utc1 = DateTime.unsafeMake(new Date("2025-01-01 04:00:00"))
console.log(utc1)
// Output: DateTime.Utc(2025-01-01T03:00:00.000Z)

// From partial date parts
const utc2 = DateTime.unsafeMake({ year: 2025 })
console.log(utc2)
// Output: DateTime.Utc(2025-01-01T00:00:00.000Z)

// From a string
const utc3 = DateTime.unsafeMake("2025-01-01")
console.log(utc3)
// Output: DateTime.Utc(2025-01-01T00:00:00.000Z)
```

**Explanation**:

- The local time **2025-01-01 04:00:00** (in Italy, CET) is converted to **UTC** by subtracting the timezone offset (UTC+1 in January).
- As a result, the UTC time becomes **2025-01-01 03:00:00.000Z**.

### make

Similar to [unsafeMake](#unsafemake), but returns an [Option](/docs/data-types/option/) instead of throwing an error if the input is invalid.
If the input is invalid, it returns `None`. If valid, it returns `Some` containing the `Utc`.

**Example** (Creating a DateTime Safely)

The following example assumes the code is executed on a system in Italy (CET timezone):

```ts twoslash
import { DateTime } from "effect"

// From a JavaScript Date
const maybeUtc1 = DateTime.make(new Date("2025-01-01 04:00:00"))
console.log(maybeUtc1)
/*
Output:
{ _id: 'Option', _tag: 'Some', value: '2025-01-01T03:00:00.000Z' }
*/

// From partial date parts
const maybeUtc2 = DateTime.make({ year: 2025 })
console.log(maybeUtc2)
/*
Output:
{ _id: 'Option', _tag: 'Some', value: '2025-01-01T00:00:00.000Z' }
*/

// From a string
const maybeUtc3 = DateTime.make("2025-01-01")
console.log(maybeUtc3)
/*
Output:
{ _id: 'Option', _tag: 'Some', value: '2025-01-01T00:00:00.000Z' }
*/
```

**Explanation**:

- The local time **2025-01-01 04:00:00** (in Italy, CET) is converted to **UTC** by subtracting the timezone offset (UTC+1 in January).
- As a result, the UTC time becomes **2025-01-01 03:00:00.000Z**.

## Zoned Constructors

A `Zoned` includes `epochMillis` along with a `TimeZone`, allowing you to attach an offset or a named region (like "America/New_York") to the timestamp.

### unsafeMakeZoned

Creates a `Zoned` by combining a [DateTime.Input](#the-datetimeinput-type) with an optional `TimeZone`.
This allows you to represent a specific point in time with an associated time zone.

The time zone can be provided in several ways:

- As a `TimeZone` object
- A string identifier (e.g., `"Europe/London"`)
- A numeric offset in milliseconds

If the input or time zone is invalid, an `IllegalArgumentException` is thrown.

**Example** (Creating a Zoned DateTime Without Specifying a Time Zone)

The following example assumes the code is executed on a system in Italy (CET timezone):

```ts twoslash
import { DateTime } from "effect"

// Create a Zoned DateTime based on the system's local time zone
const zoned = DateTime.unsafeMakeZoned(new Date("2025-01-01 04:00:00"))

console.log(zoned)
// Output: DateTime.Zoned(2025-01-01T04:00:00.000+01:00)

console.log(zoned.zone)
// Output: TimeZone.Offset(+01:00)
```

Here, the system's time zone (CET, which is UTC+1 in January) is used to create the `Zoned` instance.

**Example** (Specifying a Named Time Zone)

The following example assumes the code is executed on a system in Italy (CET timezone):

```ts twoslash
import { DateTime } from "effect"

// Create a Zoned DateTime with a specified named time zone
const zoned = DateTime.unsafeMakeZoned(new Date("2025-01-01 04:00:00"), {
  timeZone: "Europe/Rome"
})

console.log(zoned)
// Output: DateTime.Zoned(2025-01-01T04:00:00.000+01:00[Europe/Rome])

console.log(zoned.zone)
// Output: TimeZone.Named(Europe/Rome)
```

In this case, the `"Europe/Rome"` time zone is explicitly provided, resulting in the `Zoned` instance being tied to this named time zone.

By default, the input date is treated as a UTC value and then adjusted for the specified time zone. To interpret the input date as being in the specified time zone, you can use the `adjustForTimeZone` option.

**Example** (Adjusting for Time Zone Interpretation)

The following example assumes the code is executed on a system in Italy (CET timezone):

```ts twoslash
import { DateTime } from "effect"

// Interpret the input date as being in the specified time zone
const zoned = DateTime.unsafeMakeZoned(new Date("2025-01-01 04:00:00"), {
  timeZone: "Europe/Rome",
  adjustForTimeZone: true
})

console.log(zoned)
// Output: DateTime.Zoned(2025-01-01T03:00:00.000+01:00[Europe/Rome])

console.log(zoned.zone)
// Output: TimeZone.Named(Europe/Rome)
```

**Explanation**

- **Without `adjustForTimeZone`**: The input date is interpreted as UTC and then adjusted to the specified time zone. For instance, `2025-01-01 04:00:00` in UTC becomes `2025-01-01T04:00:00.000+01:00` in CET (UTC+1).
- **With `adjustForTimeZone: true`**: The input date is interpreted as being in the specified time zone. For example, `2025-01-01 04:00:00` in "Europe/Rome" (CET) is adjusted to its corresponding UTC time, resulting in `2025-01-01T03:00:00.000+01:00`.

### makeZoned

The `makeZoned` function works similarly to [unsafeMakeZoned](#unsafemakezoned) but provides a safer approach. Instead of throwing an error when the input is invalid, it returns an `Option<Zoned>`.
If the input is invalid, it returns `None`. If valid, it returns `Some` containing the `Zoned`.

**Example** (Safely Creating a Zoned DateTime)

```ts twoslash
import { DateTime, Option } from "effect"

//      ┌─── Option<Zoned>
//      ▼
const zoned = DateTime.makeZoned(new Date("2025-01-01 04:00:00"), {
  timeZone: "Europe/Rome"
})

if (Option.isSome(zoned)) {
  console.log("The DateTime is valid")
}
```

### makeZonedFromString

Creates a `Zoned` by parsing a string in the format `YYYY-MM-DDTHH:mm:ss.sss+HH:MM[IANA timezone identifier]`.

If the input string is valid, the function returns a `Some` containing the `Zoned`. If the input is invalid, it returns `None`.

**Example** (Parsing a Zoned DateTime from a String)

```ts twoslash
import { DateTime, Option } from "effect"

//      ┌─── Option<Zoned>
//      ▼
const zoned = DateTime.makeZonedFromString(
  "2025-01-01T03:00:00.000+01:00[Europe/Rome]"
)

if (Option.isSome(zoned)) {
  console.log("The DateTime is valid")
}
```

## Current Time

### now

Provides the current UTC time as a `Effect<Utc>`, using the [Clock](/docs/requirements-management/default-services/) service.

**Example** (Retrieving the Current UTC Time)

```ts twoslash
import { DateTime, Effect } from "effect"

const program = Effect.gen(function* () {
  //      ┌─── Utc
  //      ▼
  const currentTime = yield* DateTime.now
})
```

<Aside type="tip" title="Why Use the Clock Service?">
  Using the `Clock` service ensures that time is consistent across your
  application, which is particularly useful in testing environments where
  you may need to control or mock the current time.
</Aside>

### unsafeNow

Retrieves the current UTC time immediately using `Date.now()`, without the [Clock](/docs/requirements-management/default-services/) service.

**Example** (Getting the Current UTC Time Immediately)

```ts twoslash
import { DateTime } from "effect"

//      ┌─── Utc
//      ▼
const currentTime = DateTime.unsafeNow()
```

## Guards

| Function           | Description                                    |
| ------------------ | ---------------------------------------------- |
| `isDateTime`       | Checks if a value is a `DateTime`.             |
| `isTimeZone`       | Checks if a value is a `TimeZone`.             |
| `isTimeZoneOffset` | Checks if a value is a `TimeZone.Offset`.      |
| `isTimeZoneNamed`  | Checks if a value is a `TimeZone.Named`.       |
| `isUtc`            | Checks if a `DateTime` is the `Utc` variant.   |
| `isZoned`          | Checks if a `DateTime` is the `Zoned` variant. |

**Example** (Validating a DateTime)

```ts twoslash
import { DateTime } from "effect"

function printDateTimeInfo(x: unknown) {
  if (DateTime.isDateTime(x)) {
    console.log("This is a valid DateTime")
  } else {
    console.log("Not a DateTime")
  }
}
```

## Time Zone Management

| Function              | Description                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `setZone`             | Creates a `Zoned` from `DateTime` by applying the given `TimeZone`.                                                                              |
| `setZoneOffset`       | Creates a `Zoned` from `DateTime` using a fixed offset (in ms).                                                                                  |
| `setZoneNamed`        | Creates a `Zoned` from `DateTime` from an IANA time zone identifier or returns `None` if invalid.                                                |
| `unsafeSetZoneNamed`  | Creates a `Zoned` from `DateTime` from an IANA time zone identifier or throws if invalid.                                                        |
| `zoneUnsafeMakeNamed` | Creates a `TimeZone.Named` from a IANA time zone identifier or throws if the identifier is invalid.                                              |
| `zoneMakeNamed`       | Creates a `TimeZone.Named` from a IANA time zone identifier or returns `None` if invalid.                                                        |
| `zoneMakeNamedEffect` | Creates a `Effect<TimeZone.Named, IllegalArgumentException>` from a IANA time zone identifier failing with `IllegalArgumentException` if invalid |
| `zoneMakeOffset`      | Creates a `TimeZone.Offset` from a numeric offset in milliseconds.                                                                               |
| `zoneMakeLocal`       | Creates a `TimeZone.Named` from the system's local time zone.                                                                                    |
| `zoneFromString`      | Attempts to parse a time zone from a string, returning `None` if invalid.                                                                        |
| `zoneToString`        | Returns a string representation of a `TimeZone`.                                                                                                 |

**Example** (Applying a Time Zone to a DateTime)

```ts twoslash
import { DateTime } from "effect"

// Create a UTC DateTime
//
//     ┌─── Utc
//     ▼
const utc = DateTime.unsafeMake("2024-01-01")

// Create a named time zone for New York
//
//      ┌─── TimeZone.Named
//      ▼
const zoneNY = DateTime.zoneUnsafeMakeNamed("America/New_York")

// Apply it to the DateTime
//
//      ┌─── Zoned
//      ▼
const zoned = DateTime.setZone(utc, zoneNY)

console.log(zoned)
// Output: DateTime.Zoned(2023-12-31T19:00:00.000-05:00[America/New_York])
```

### zoneFromString

Parses a string to create a `DateTime.TimeZone`.

This function attempts to interpret the input string as either:

- A numeric time zone offset (e.g., "GMT", "+01:00")
- An IANA time zone identifier (e.g., "Europe/London")

If the string matches an offset format, it is converted into a `TimeZone.Offset`.
Otherwise, it attempts to create a `TimeZone.Named` using the input.

If the input string is invalid, `Option.none()` is returned.

**Example** (Parsing a Time Zone from a String)

```ts twoslash
import { DateTime, Option } from "effect"

// Attempt to parse a numeric offset
const offsetZone = DateTime.zoneFromString("+01:00")
console.log(Option.isSome(offsetZone))
// Output: true

// Attempt to parse an IANA time zone
const namedZone = DateTime.zoneFromString("Europe/London")
console.log(Option.isSome(namedZone))
// Output: true

// Invalid input
const invalidZone = DateTime.zoneFromString("Invalid/Zone")
console.log(Option.isSome(invalidZone))
// Output: false
```

## Comparisons

| Function                                     | Description                                                  |
| -------------------------------------------- | ------------------------------------------------------------ |
| `distance`                                   | Returns the difference (in ms) between two `DateTime`s.      |
| `distanceDurationEither`                     | Returns a `Left` or `Right` `Duration` depending on order.   |
| `distanceDuration`                           | Returns a `Duration` indicating how far apart two times are. |
| `min`                                        | Returns the earlier of two `DateTime` values.                |
| `max`                                        | Returns the later of two `DateTime` values.                  |
| `greaterThan`, `greaterThanOrEqualTo`, etc.  | Checks ordering between two `DateTime` values.               |
| `between`                                    | Checks if a `DateTime` lies within the given bounds.         |
| `isFuture`, `isPast`, `unsafeIsFuture`, etc. | Checks if a `DateTime` is in the future or past.             |

**Example** (Finding the Distance Between Two DateTimes)

```ts twoslash
import { DateTime } from "effect"

const utc1 = DateTime.unsafeMake("2025-01-01T00:00:00Z")
const utc2 = DateTime.add(utc1, { days: 1 })

console.log(DateTime.distance(utc1, utc2))
// Output: 86400000 (one day)

console.log(DateTime.distanceDurationEither(utc1, utc2))
/*
Output:
{
  _id: 'Either',
  _tag: 'Right',
  right: { _id: 'Duration', _tag: 'Millis', millis: 86400000 }
}
*/

console.log(DateTime.distanceDuration(utc1, utc2))
// Output: { _id: 'Duration', _tag: 'Millis', millis: 86400000 }
```

## Conversions

| Function         | Description                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| `toDateUtc`      | Returns a JavaScript `Date` in UTC.                                     |
| `toDate`         | Applies the time zone (if present) and converts to a JavaScript `Date`. |
| `zonedOffset`    | For a `Zoned` DateTime, returns the time zone offset in ms.             |
| `zonedOffsetIso` | For a `Zoned` DateTime, returns an ISO offset string like "+01:00".     |
| `toEpochMillis`  | Returns the Unix epoch time in milliseconds.                            |
| `removeTime`     | Returns a `Utc` with the time cleared (only date remains).              |

## Parts

| Function                   | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| `toParts`                  | Returns time zone adjusted date parts (including weekday).             |
| `toPartsUtc`               | Returns UTC date parts (including weekday).                            |
| `getPart` / `getPartUtc`   | Retrieves a specific part (e.g., `"year"` or `"month"`) from the date. |
| `setParts` / `setPartsUtc` | Updates certain parts of a date, preserving or ignoring the time zone. |

**Example** (Extracting Parts from a DateTime)

```ts twoslash
import { DateTime } from "effect"

const zoned = DateTime.setZone(
  DateTime.unsafeMake("2024-01-01"),
  DateTime.zoneUnsafeMakeNamed("Europe/Rome")
)

console.log(DateTime.getPart(zoned, "month"))
// Output: 1
```

## Math

| Function           | Description                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `addDuration`      | Adds the given `Duration` to a `DateTime`.                                                 |
| `subtractDuration` | Subtracts the given `Duration` from a `DateTime`.                                          |
| `add`              | Adds numeric parts (e.g., `{ hours: 2 }`) to a `DateTime`.                                 |
| `subtract`         | Subtracts numeric parts.                                                                   |
| `startOf`          | Moves a `DateTime` to the start of the given unit (e.g., the beginning of a day or month). |
| `endOf`            | Moves a `DateTime` to the end of the given unit.                                           |
| `nearest`          | Rounds a `DateTime` to the nearest specified unit.                                         |

## Formatting

| Function           | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `format`           | Formats a `DateTime` as a string using the `DateTimeFormat` API.     |
| `formatLocal`      | Uses the system's local time zone and locale for formatting.         |
| `formatUtc`        | Forces UTC formatting.                                               |
| `formatIntl`       | Uses a provided `Intl.DateTimeFormat`.                               |
| `formatIso`        | Returns an ISO 8601 string in UTC.                                   |
| `formatIsoDate`    | Returns an ISO date string, adjusted for the time zone.              |
| `formatIsoDateUtc` | Returns an ISO date string in UTC.                                   |
| `formatIsoOffset`  | Formats a `Zoned` as a string with an offset like "+01:00".          |
| `formatIsoZoned`   | Formats a `Zoned` in the form `YYYY-MM-DDTHH:mm:ss.sss+HH:MM[Zone]`. |

## Layers for Current Time Zone

| Function                 | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| `CurrentTimeZone`        | A service tag for the current time zone.                             |
| `setZoneCurrent`         | Sets a `DateTime` to use the current time zone.                      |
| `withCurrentZone`        | Provides an effect with a specified time zone.                       |
| `withCurrentZoneLocal`   | Uses the system's local time zone for the effect.                    |
| `withCurrentZoneOffset`  | Uses a fixed offset (in ms) for the effect.                          |
| `withCurrentZoneNamed`   | Uses a named time zone identifier (e.g., "Europe/London").           |
| `nowInCurrentZone`       | Retrieves the current time as a `Zoned` in the configured time zone. |
| `layerCurrentZone`       | Creates a Layer providing the `CurrentTimeZone` service.             |
| `layerCurrentZoneOffset` | Creates a Layer from a fixed offset.                                 |
| `layerCurrentZoneNamed`  | Creates a Layer from a named time zone, failing if invalid.          |
| `layerCurrentZoneLocal`  | Creates a Layer from the system's local time zone.                   |

**Example** (Using the Current Time Zone in an Effect)

```ts twoslash
import { DateTime, Effect } from "effect"

// Retrieve the current time in the "Europe/London" time zone
const program = Effect.gen(function* () {
  const zonedNow = yield* DateTime.nowInCurrentZone
  console.log(zonedNow)
}).pipe(DateTime.withCurrentZoneNamed("Europe/London"))

Effect.runFork(program)
/*
Example Output:
DateTime.Zoned(2025-01-06T18:36:38.573+00:00[Europe/London])
*/
```
