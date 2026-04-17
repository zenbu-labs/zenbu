---
title: Guidelines
description: Best practices for running Effect applications and ensuring safe, explicit coding styles.
sidebar:
  order: 1
---

import { Aside } from "@astrojs/starlight/components"

## Using runMain

In Effect, `runMain` is the primary entry point for executing an Effect application on Node.js.

**Example** (Running an Effect Application with Graceful Teardown)

```ts
import { Effect, Console, Schedule, pipe } from "effect"
import { NodeRuntime } from "@effect/platform-node"

const program = pipe(
  Effect.addFinalizer(() => Console.log("Application is about to exit!")),
  Effect.andThen(Console.log("Application started!")),
  Effect.andThen(
    Effect.repeat(Console.log("still alive..."), {
      schedule: Schedule.spaced("1 second")
    })
  ),
  Effect.scoped
)

// No graceful teardown on CTRL+C
// Effect.runPromise(program)

// Use NodeRuntime.runMain for graceful teardown on CTRL+C
NodeRuntime.runMain(program)
/*
Output:
Application started!
still alive...
still alive...
still alive...
still alive...
^C <-- CTRL+C
Application is about to exit!
*/
```

The `runMain` function handles finding and interrupting all fibers. Internally, it observes the fiber and listens for `sigint` signals, ensuring a graceful shutdown of the application when interrupted (e.g., using CTRL+C).

<Aside type="tip" title="Graceful Teardown">
  Ensure the teardown logic is placed in the main effect. If the fiber
  running the application or server is interrupted, `runMain` ensures that
  all resources are properly released.
</Aside>

### Versions for Different Platforms

Effect provides versions of `runMain` tailored for different platforms:

| Platform | Runtime Version          | Import Path                |
| -------- | ------------------------ | -------------------------- |
| Node.js  | `NodeRuntime.runMain`    | `@effect/platform-node`    |
| Bun      | `BunRuntime.runMain`     | `@effect/platform-bun`     |
| Browser  | `BrowserRuntime.runMain` | `@effect/platform-browser` |

## Avoid Tacit Usage

Avoid using tacit (point-free) function calls, such as `Effect.map(fn)`, or using `flow` from the `effect/Function` module.

In Effect, it's generally safer to write functions explicitly:

```ts showLineNumbers=false
Effect.map((x) => fn(x))
```

rather than in a point-free style:

```ts showLineNumbers=false
Effect.map(fn)
```

While tacit functions may be appealing for their brevity, they can introduce a number of problems:

- Using tacit functions, particularly when dealing with optional parameters, can be unsafe. For example, if a function has overloads, writing it in a tacit style may erase all generics, resulting in bugs. Check out this X thread for more details: [link to thread](https://twitter.com/MichaelArnaldi/status/1670715270845935616).

- Tacit usage can also compromise TypeScript's ability to infer types, potentially causing unexpected errors. This isn't just a matter of style but a way to avoid subtle mistakes that can arise from type inference issues.

- Additionally, stack traces might not be as clear when tacit usage is employed.

Avoiding tacit usage is a simple precaution that makes your code more reliable.
