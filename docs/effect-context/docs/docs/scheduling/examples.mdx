---
title: Examples
description: Explore practical examples for scheduling, retries, timeouts, and periodic task execution in Effect.
sidebar:
  order: 5
---

These examples demonstrate different approaches to handling timeouts, retries, and periodic execution using Effect. Each scenario ensures that the application remains responsive and resilient to failures while adapting dynamically to various conditions.

## Handling Timeouts and Retries for API Calls

When calling third-party APIs, it is often necessary to enforce timeouts and implement retry mechanisms to handle transient failures. In this example, the API call retries up to two times in case of failure and will be interrupted if it takes longer than 4 seconds.

**Example** (Retrying an API Call with a Timeout)

```ts twoslash
import { Console, Effect } from "effect"

// Function to make the API call
const getJson = (url: string) =>
  Effect.tryPromise(() =>
    fetch(url).then((res) => {
      if (!res.ok) {
        console.log("error")
        throw new Error(res.statusText)
      }
      console.log("ok")
      return res.json() as unknown
    })
  )

// Program that retries the API call twice, times out after 4 seconds,
// and logs errors
const program = (url: string) =>
  getJson(url).pipe(
    Effect.retry({ times: 2 }),
    Effect.timeout("4 seconds"),
    Effect.catchAll(Console.error)
  )

// Test case: successful API response
Effect.runFork(program("https://dummyjson.com/products/1?delay=1000"))
/*
Output:
ok
*/

// Test case: API call exceeding timeout limit
Effect.runFork(program("https://dummyjson.com/products/1?delay=5000"))
/*
Output:
TimeoutException: Operation timed out before the specified duration of '4s' elapsed
*/

// Test case: API returning an error response
Effect.runFork(program("https://dummyjson.com/auth/products/1?delay=500"))
/*
Output:
error
error
error
UnknownException: An unknown error occurred
*/
```

## Retrying API Calls Based on Specific Errors

Sometimes, retries should only happen for certain error conditions. For example, if an API call fails with a `401 Unauthorized` response, retrying might make sense, while a `404 Not Found` error should not trigger a retry.

**Example** (Retrying Only on Specific Error Codes)

```ts twoslash
import { Console, Effect, Data } from "effect"

// Custom error class for handling status codes
class Err extends Data.TaggedError("Err")<{
  readonly message: string
  readonly status: number
}> {}

// Function to make the API call
const getJson = (url: string) =>
  Effect.tryPromise({
    try: () =>
      fetch(url).then((res) => {
        if (!res.ok) {
          console.log(res.status)
          throw new Err({ message: res.statusText, status: res.status })
        }
        return res.json() as unknown
      }),
    catch: (e) => e as Err
  })

// Program that retries only when the error status is 401 (Unauthorized)
const program = (url: string) =>
  getJson(url).pipe(
    Effect.retry({ while: (err) => err.status === 401 }),
    Effect.catchAll(Console.error)
  )

// Test case: API returns 401 (triggers multiple retries)
Effect.runFork(
  program("https://dummyjson.com/auth/products/1?delay=1000")
)
/*
Output:
401
401
401
401
...
*/

// Test case: API returns 404 (no retries)
Effect.runFork(program("https://dummyjson.com/-"))
/*
Output:
404
Err [Error]: Not Found
*/
```

## Retrying with Dynamic Delays Based on Error Information

Some API errors, such as `429 Too Many Requests`, include a `Retry-After` header that specifies how long to wait before retrying. Instead of using a fixed delay, we can dynamically adjust the retry interval based on this value.

**Example** (Using the `Retry-After` Header for Retry Delays)

This approach ensures that the retry delay adapts dynamically to the server's response, preventing unnecessary retries while respecting the provided `Retry-After` value.

```ts twoslash
import { Duration, Effect, Schedule, Data } from "effect"

// Custom error class representing a "Too Many Requests" response
class TooManyRequestsError extends Data.TaggedError(
  "TooManyRequestsError"
)<{ readonly retryAfter: number }> {}

let n = 1
const request = Effect.gen(function* () {
  // Simulate failing a particular number of times
  if (n < 3) {
    const retryAfter = n * 500
    console.log(`Attempt #${n++}, retry after ${retryAfter} millis...`)
    // Simulate retrieving the retry-after header
    return yield* Effect.fail(new TooManyRequestsError({ retryAfter }))
  }
  console.log("Done")
  return "some result"
})

// Retry policy that extracts the retry delay from the error
const policy = Schedule.identity<TooManyRequestsError>().pipe(
  Schedule.addDelay((error) =>
    error._tag === "TooManyRequestsError"
      ? // Wait for the specified retry-after duration
        Duration.millis(error.retryAfter)
      : Duration.zero
  ),
  // Limit retries to 5 attempts
  Schedule.intersect(Schedule.recurs(5))
)

const program = request.pipe(Effect.retry(policy))

Effect.runFork(program)
/*
Output:
Attempt #1, retry after 500 millis...
Attempt #2, retry after 1000 millis...
Done
*/
```

## Running Periodic Tasks Until Another Task Completes

There are cases where we need to repeatedly perform an action at fixed intervals until another longer-running task finishes. This pattern is common in polling mechanisms or periodic logging.

**Example** (Running a Scheduled Task Until Completion)

```ts twoslash
import { Effect, Console, Schedule } from "effect"

// Define a long-running effect
// (e.g., a task that takes 5 seconds to complete)
const longRunningEffect = Console.log("done").pipe(
  Effect.delay("5 seconds")
)

// Define an action to run periodically
const action = Console.log("action...")

// Define a fixed interval schedule
const schedule = Schedule.fixed("1.5 seconds")

// Run the action repeatedly until the long-running task completes
const program = Effect.race(
  Effect.repeat(action, schedule),
  longRunningEffect
)

Effect.runPromise(program)
/*
Output:
action...
action...
action...
action...
done
*/
```
