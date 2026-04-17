---
title: Schedule Combinators
description: Learn how to combine and customize schedules in Effect to create complex recurrence patterns, including union, intersection, sequencing, and more.
sidebar:
  order: 3
---

import { Aside } from "@astrojs/starlight/components"

Schedules define stateful, possibly effectful, recurring schedules of events, and compose in a variety of ways. Combinators allow us to take schedules and combine them together to get other schedules.

To demonstrate the functionality of different schedules, we will use the following helper function
that logs each repetition along with the corresponding delay in milliseconds, formatted as:

```text showLineNumbers=false
#<repetition>: <delay in ms>
```

**Helper** (Logging Execution Delays)

```ts twoslash
import { Array, Chunk, Duration, Effect, Schedule } from "effect"

const log = (
  schedule: Schedule.Schedule<unknown>,
  delay: Duration.DurationInput = 0
): void => {
  const maxRecurs = 10 // Limit the number of executions
  const delays = Chunk.toArray(
    Effect.runSync(
      Schedule.run(
        Schedule.delays(Schedule.addDelay(schedule, () => delay)),
        Date.now(),
        Array.range(0, maxRecurs)
      )
    )
  )
  delays.forEach((duration, i) => {
    console.log(
      i === maxRecurs
        ? "..." // Indicate truncation if there are more executions
        : i === delays.length - 1
        ? "(end)" // Mark the last execution
        : `#${i + 1}: ${Duration.toMillis(duration)}ms`
    )
  })
}
```

## Composition

Schedules can be composed in different ways:

| Mode             | Description                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **Union**        | Combines two schedules and recurs if either schedule wants to continue, using the shorter delay.   |
| **Intersection** | Combines two schedules and recurs only if both schedules want to continue, using the longer delay. |
| **Sequencing**   | Combines two schedules by running the first one fully, then switching to the second.               |

### Union

Combines two schedules and recurs if either schedule wants to continue, using the shorter delay.

**Example** (Combining Exponential and Spaced Intervals)

```ts twoslash collapse={3-26}
import { Array, Chunk, Duration, Effect, Schedule } from "effect"

const log = (
  schedule: Schedule.Schedule<unknown>,
  delay: Duration.DurationInput = 0
): void => {
  const maxRecurs = 10
  const delays = Chunk.toArray(
    Effect.runSync(
      Schedule.run(
        Schedule.delays(Schedule.addDelay(schedule, () => delay)),
        Date.now(),
        Array.range(0, maxRecurs)
      )
    )
  )
  delays.forEach((duration, i) => {
    console.log(
      i === maxRecurs
        ? "..."
        : i === delays.length - 1
        ? "(end)"
        : `#${i + 1}: ${Duration.toMillis(duration)}ms`
    )
  })
}

const schedule = Schedule.union(
  Schedule.exponential("100 millis"),
  Schedule.spaced("1 second")
)

log(schedule)
/*
Output:
#1: 100ms  < exponential
#2: 200ms
#3: 400ms
#4: 800ms
#5: 1000ms < spaced
#6: 1000ms
#7: 1000ms
#8: 1000ms
#9: 1000ms
#10: 1000ms
...
*/
```

The `Schedule.union` operator selects the shortest delay at each step, so when combining an exponential schedule with a spaced interval, the initial recurrences will follow the exponential backoff, then settle into the spaced interval once the delays exceed that value.

### Intersection

Combines two schedules and recurs only if both schedules want to continue, using the longer delay.

**Example** (Limiting Exponential Backoff with a Fixed Number of Retries)

```ts twoslash collapse={3-26}
import { Array, Chunk, Duration, Effect, Schedule } from "effect"

const log = (
  schedule: Schedule.Schedule<unknown>,
  delay: Duration.DurationInput = 0
): void => {
  const maxRecurs = 10
  const delays = Chunk.toArray(
    Effect.runSync(
      Schedule.run(
        Schedule.delays(Schedule.addDelay(schedule, () => delay)),
        Date.now(),
        Array.range(0, maxRecurs)
      )
    )
  )
  delays.forEach((duration, i) => {
    console.log(
      i === maxRecurs
        ? "..."
        : i === delays.length - 1
        ? "(end)"
        : `#${i + 1}: ${Duration.toMillis(duration)}ms`
    )
  })
}

const schedule = Schedule.intersect(
  Schedule.exponential("10 millis"),
  Schedule.recurs(5)
)

log(schedule)
/*
Output:
#1: 10ms  < exponential
#2: 20ms
#3: 40ms
#4: 80ms
#5: 160ms
(end)     < recurs
*/
```

The `Schedule.intersect` operator enforces both schedules' constraints. In this example, the schedule follows an exponential backoff but stops after 5 recurrences due to the `Schedule.recurs(5)` limit.

### Sequencing

Combines two schedules by running the first one fully, then switching to the second.

**Example** (Switching from Fixed Retries to Periodic Execution)

```ts twoslash collapse={3-26}
import { Array, Chunk, Duration, Effect, Schedule } from "effect"

const log = (
  schedule: Schedule.Schedule<unknown>,
  delay: Duration.DurationInput = 0
): void => {
  const maxRecurs = 10
  const delays = Chunk.toArray(
    Effect.runSync(
      Schedule.run(
        Schedule.delays(Schedule.addDelay(schedule, () => delay)),
        Date.now(),
        Array.range(0, maxRecurs)
      )
    )
  )
  delays.forEach((duration, i) => {
    console.log(
      i === maxRecurs
        ? "..."
        : i === delays.length - 1
        ? "(end)"
        : `#${i + 1}: ${Duration.toMillis(duration)}ms`
    )
  })
}

const schedule = Schedule.andThen(
  Schedule.recurs(5),
  Schedule.spaced("1 second")
)

log(schedule)
/*
Output:
#1: 0ms    < recurs
#2: 0ms
#3: 0ms
#4: 0ms
#5: 0ms
#6: 1000ms < spaced
#7: 1000ms
#8: 1000ms
#9: 1000ms
#10: 1000ms
...
*/
```

The first schedule runs until completion, after which the second schedule takes over. In this example, the effect initially executes 5 times with no delay, then continues every 1 second.

## Adding Randomness to Retry Delays

The `Schedule.jittered` combinator modifies a schedule by applying a random delay within a specified range.

When a resource is out of service due to overload or contention, retrying and backing off doesn't help us. If all failed API calls are backed off to the same point of time, they cause another overload or contention. Jitter adds some amount of randomness to the delay of the schedule. This helps us to avoid ending up accidentally synchronizing and taking the service down by accident.

[Research](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) suggests that `Schedule.jittered(0.0, 1.0)` is an effective way to introduce randomness in retries.

**Example** (Jittered Exponential Backoff)

```ts twoslash collapse={3-26}
import { Array, Chunk, Duration, Effect, Schedule } from "effect"

const log = (
  schedule: Schedule.Schedule<unknown>,
  delay: Duration.DurationInput = 0
): void => {
  const maxRecurs = 10
  const delays = Chunk.toArray(
    Effect.runSync(
      Schedule.run(
        Schedule.delays(Schedule.addDelay(schedule, () => delay)),
        Date.now(),
        Array.range(0, maxRecurs)
      )
    )
  )
  delays.forEach((duration, i) => {
    console.log(
      i === maxRecurs
        ? "..."
        : i === delays.length - 1
        ? "(end)"
        : `#${i + 1}: ${Duration.toMillis(duration)}ms`
    )
  })
}

const schedule = Schedule.jittered(Schedule.exponential("10 millis"))

log(schedule)
/*
Output:
#1: 10.448486ms
#2: 21.134521ms
#3: 47.245117ms
#4: 88.263184ms
#5: 163.651367ms
#6: 335.818848ms
#7: 719.126709ms
#8: 1266.18457ms
#9: 2931.252441ms
#10: 6121.593018ms
...
*/
```

The `Schedule.jittered` combinator introduces randomness to delays within a range. For example, applying jitter to an exponential backoff ensures that each retry occurs at a slightly different time, reducing the risk of overwhelming the system.

## Controlling Repetitions with Filters

You can use `Schedule.whileInput` or `Schedule.whileOutput` to limit how long a schedule continues based on conditions applied to its input or output.

**Example** (Stopping Based on Output)

```ts twoslash collapse={3-26}
import { Array, Chunk, Duration, Effect, Schedule } from "effect"

const log = (
  schedule: Schedule.Schedule<unknown>,
  delay: Duration.DurationInput = 0
): void => {
  const maxRecurs = 10
  const delays = Chunk.toArray(
    Effect.runSync(
      Schedule.run(
        Schedule.delays(Schedule.addDelay(schedule, () => delay)),
        Date.now(),
        Array.range(0, maxRecurs)
      )
    )
  )
  delays.forEach((duration, i) => {
    console.log(
      i === maxRecurs
        ? "..."
        : i === delays.length - 1
        ? "(end)"
        : `#${i + 1}: ${Duration.toMillis(duration)}ms`
    )
  })
}

const schedule = Schedule.whileOutput(Schedule.recurs(5), (n) => n <= 2)

log(schedule)
/*
Output:
#1: 0ms < recurs
#2: 0ms
#3: 0ms
(end)   < whileOutput
*/
```

`Schedule.whileOutput` filters repetitions based on the output of the schedule. In this example, the schedule stops once the output exceeds `2`, even though `Schedule.recurs(5)` allows up to 5 repetitions.

## Adjusting Delays Based on Output

The `Schedule.modifyDelay` combinator allows you to dynamically change the delay of a schedule based on the number of repetitions or other output conditions.

**Example** (Reducing Delay After a Certain Number of Repetitions)

```ts twoslash collapse={3-26}
import { Array, Chunk, Duration, Effect, Schedule } from "effect"

const log = (
  schedule: Schedule.Schedule<unknown>,
  delay: Duration.DurationInput = 0
): void => {
  const maxRecurs = 10
  const delays = Chunk.toArray(
    Effect.runSync(
      Schedule.run(
        Schedule.delays(Schedule.addDelay(schedule, () => delay)),
        Date.now(),
        Array.range(0, maxRecurs)
      )
    )
  )
  delays.forEach((duration, i) => {
    console.log(
      i === maxRecurs
        ? "..."
        : i === delays.length - 1
        ? "(end)"
        : `#${i + 1}: ${Duration.toMillis(duration)}ms`
    )
  })
}

const schedule = Schedule.modifyDelay(
  Schedule.spaced("1 second"),
  (out, duration) => (out > 2 ? "100 millis" : duration)
)

log(schedule)
/*
Output:
#1: 1000ms
#2: 1000ms
#3: 1000ms
#4: 100ms  < modifyDelay
#5: 100ms
#6: 100ms
#7: 100ms
#8: 100ms
#9: 100ms
#10: 100ms
...
*/
```

The delay modification applies dynamically during execution. In this example, the first three repetitions follow the original `1-second` spacing. After that, the delay drops to `100 milliseconds`, making subsequent repetitions occur more frequently.

## Tapping

`Schedule.tapInput` and `Schedule.tapOutput` allow you to perform additional effectful operations on a schedule's input or output without modifying its behavior.

**Example** (Logging Schedule Outputs)

```ts twoslash collapse={3-26}
import { Array, Chunk, Duration, Effect, Schedule, Console } from "effect"

const log = (
  schedule: Schedule.Schedule<unknown>,
  delay: Duration.DurationInput = 0
): void => {
  const maxRecurs = 10
  const delays = Chunk.toArray(
    Effect.runSync(
      Schedule.run(
        Schedule.delays(Schedule.addDelay(schedule, () => delay)),
        Date.now(),
        Array.range(0, maxRecurs)
      )
    )
  )
  delays.forEach((duration, i) => {
    console.log(
      i === maxRecurs
        ? "..."
        : i === delays.length - 1
        ? "(end)"
        : `#${i + 1}: ${Duration.toMillis(duration)}ms`
    )
  })
}

const schedule = Schedule.tapOutput(Schedule.recurs(2), (n) =>
  Console.log(`Schedule Output: ${n}`)
)

log(schedule)
/*
Output:
Schedule Output: 0
Schedule Output: 1
Schedule Output: 2
#1: 0ms
#2: 0ms
(end)
*/
```

`Schedule.tapOutput` runs an effect before each recurrence, using the schedule's current output as input. This can be useful for logging, debugging, or triggering side effects.
