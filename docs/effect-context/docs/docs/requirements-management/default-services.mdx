---
title: Default Services
description: Learn about the default services in Effect, including Clock, Console, Random, ConfigProvider, and Tracer, and how they are automatically provided for your programs.
sidebar:
  order: 1
---

Effect comes equipped with five pre-built services:

```ts showLineNumbers=false
type DefaultServices = Clock | ConfigProvider | Console | Random | Tracer
```

When we employ these services, there's no need to explicitly provide their implementations. Effect automatically supplies live versions of these services to our effects, sparing us from manual setup.

**Example** (Using Clock and Console)

```ts twoslash
import { Effect, Clock, Console } from "effect"

//      ┌─── Effect<void, never, never>
//      ▼
const program = Effect.gen(function* () {
  const now = yield* Clock.currentTimeMillis
  yield* Console.log(`Application started at ${new Date(now)}`)
})

Effect.runFork(program)
// Output: Application started at <current time>
```

As you can observe, even if our program utilizes both `Clock` and `Console`, the `Requirements` parameter, representing the services required for the effect to execute, remains set to `never`.
Effect takes care of handling these services seamlessly for us.

## Overriding Default Services

Sometimes, you might need to replace the default services with custom implementations. Effect provides built-in utilities to override these services using `Effect.with<service>` and `Effect.with<service>Scoped`.

- `Effect.with<service>`: Overrides a service for the duration of the effect.
- `Effect.with<service>Scoped`: Overrides a service within a scope and restores the original service afterward.

| Function                          | Description                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `Effect.withClock`                | Executes an effect using a specific `Clock` service.                           |
| `Effect.withClockScoped`          | Temporarily overrides the `Clock` service and restores it when the scope ends. |
| `Effect.withConfigProvider`       | Executes an effect using a specific `ConfigProvider` service.                  |
| `Effect.withConfigProviderScoped` | Temporarily overrides the `ConfigProvider` service within a scope.             |
| `Effect.withConsole`              | Executes an effect using a specific `Console` service.                         |
| `Effect.withConsoleScoped`        | Temporarily overrides the `Console` service within a scope.                    |
| `Effect.withRandom`               | Executes an effect using a specific `Random` service.                          |
| `Effect.withRandomScoped`         | Temporarily overrides the `Random` service within a scope.                     |
| `Effect.withTracer`               | Executes an effect using a specific `Tracer` service.                          |
| `Effect.withTracerScoped`         | Temporarily overrides the `Tracer` service within a scope.                     |

**Example** (Overriding Random Service)

```ts twoslash
import { Effect, Random } from "effect"

// A program that logs a random number
const program = Effect.gen(function* () {
  console.log(yield* Random.next)
})

Effect.runSync(program)
// Example Output: 0.23208633934454326 (varies each run)

// Override the Random service with a seeded generator
const override = program.pipe(Effect.withRandom(Random.make("myseed")))

Effect.runSync(override)
// Output: 0.6862142528438508 (consistent output with the seed)
```
