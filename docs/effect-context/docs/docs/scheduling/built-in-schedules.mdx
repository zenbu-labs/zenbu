---
title: Built-In Schedules
description: Explore built-in scheduling patterns in Effect for efficient timed repetitions and delays.
sidebar:
  order: 2
---

import { Aside } from "@astrojs/starlight/components"

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

## Infinite and Fixed Repeats

### forever

A schedule that repeats indefinitely, producing the number of recurrences each time it runs.

**Example** (Indefinitely Recurring Schedule)

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

const schedule = Schedule.forever

log(schedule)
/*
Output:
#1: 0ms < forever
#2: 0ms
#3: 0ms
#4: 0ms
#5: 0ms
#6: 0ms
#7: 0ms
#8: 0ms
#9: 0ms
#10: 0ms
...
*/
```

### once

A schedule that recurs only once.

**Example** (Single Recurrence Schedule)

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

const schedule = Schedule.once

log(schedule)
/*
Output:
#1: 0ms < once
(end)
*/
```

### recurs

A schedule that repeats a specified number of times, producing the number of recurrences each time it runs.

**Example** (Fixed Number of Recurrences)

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

const schedule = Schedule.recurs(5)

log(schedule)
/*
Output:
#1: 0ms < recurs
#2: 0ms
#3: 0ms
#4: 0ms
#5: 0ms
(end)
*/
```

## Recurring at specific intervals

You can define schedules that control the time between executions. The difference between `spaced` and `fixed` schedules lies in how the interval is measured:

- `spaced` delays each repetition from the **end** of the previous one.
- `fixed` ensures repetitions occur at **regular intervals**, regardless of execution time.

### spaced

A schedule that repeats indefinitely, each repetition spaced the specified duration from the last run.
It returns the number of recurrences each time it runs.

**Example** (Recurring with Delay Between Executions)

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

const schedule = Schedule.spaced("200 millis")

//               ┌─── Simulating an effect that takes
//               │    100 milliseconds to complete
//               ▼
log(schedule, "100 millis")
/*
Output:
#1: 300ms < spaced
#2: 300ms
#3: 300ms
#4: 300ms
#5: 300ms
#6: 300ms
#7: 300ms
#8: 300ms
#9: 300ms
#10: 300ms
...
*/
```

The first delay is approximately 100 milliseconds, as the initial execution is not affected by the schedule. Subsequent delays are approximately 200 milliseconds apart, demonstrating the effect of the `spaced` schedule.

### fixed

A schedule that recurs at fixed intervals. It returns the number of recurrences each time it runs.
If the action run between updates takes longer than the interval, then the action will be run immediately, but re-runs will not "pile up".

```text showLineNumbers=false
|-----interval-----|-----interval-----|-----interval-----|
|---------action--------|action-------|action------------|
```

**Example** (Fixed Interval Recurrence)

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

const schedule = Schedule.fixed("200 millis")

//               ┌─── Simulating an effect that takes
//               │    100 milliseconds to complete
//               ▼
log(schedule, "100 millis")
/*
Output:
#1: 300ms < fixed
#2: 200ms
#3: 200ms
#4: 200ms
#5: 200ms
#6: 200ms
#7: 200ms
#8: 200ms
#9: 200ms
#10: 200ms
...
*/
```

## Increasing Delays Between Executions

### exponential

A schedule that recurs using exponential backoff, with each delay increasing exponentially.
Returns the current duration between recurrences.

**Example** (Exponential Backoff Schedule)

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

const schedule = Schedule.exponential("10 millis")

log(schedule)
/*
Output:
#1: 10ms < exponential
#2: 20ms
#3: 40ms
#4: 80ms
#5: 160ms
#6: 320ms
#7: 640ms
#8: 1280ms
#9: 2560ms
#10: 5120ms
...
*/
```

### fibonacci

A schedule that always recurs, increasing delays by summing the preceding two delays (similar to the fibonacci sequence). Returns the current duration between recurrences.

**Example** (Fibonacci Delay Schedule)

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

const schedule = Schedule.fibonacci("10 millis")

log(schedule)
/*
Output:
#1: 10ms < fibonacci
#2: 10ms
#3: 20ms
#4: 30ms
#5: 50ms
#6: 80ms
#7: 130ms
#8: 210ms
#9: 340ms
#10: 550ms
...
*/
```
