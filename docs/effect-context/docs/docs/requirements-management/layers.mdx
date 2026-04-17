---
title: Managing Layers
description: Learn how to use layers in Effect to manage service dependencies and build efficient, clean dependency graphs for your applications.
sidebar:
  order: 2
---

import { Aside } from "@astrojs/starlight/components"

In the [Managing Services](/docs/requirements-management/services/) page, you learned how to create effects which depend on some service to be provided in order to execute, as well as how to provide that service to an effect.

However, what if we have a service within our effect program that has dependencies on other services in order to be built? We want to avoid leaking these implementation details into the service interface.

To represent the "dependency graph" of our program and manage these dependencies more effectively, we can utilize a powerful abstraction called "Layer".

Layers act as **constructors for creating services**, allowing us to manage dependencies during construction rather than at the service level. This approach helps to keep our service interfaces clean and focused.

Let's review some key concepts before diving into the details:

| Concept     | Description                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| **service** | A reusable component providing specific functionality, used across different parts of an application.                     |
| **tag**     | A unique identifier representing a **service**, allowing Effect to locate and use it.                                     |
| **context** | A collection storing services, functioning like a map with **tags** as keys and **services** as values.                   |
| **layer**   | An abstraction for constructing **services**, managing dependencies during construction rather than at the service level. |

## Designing the Dependency Graph

Let's imagine that we are building a web application. We could imagine that the dependency graph for an application where we need to manage configuration, logging, and database access might look something like this:

- The `Config` service provides application configuration.
- The `Logger` service depends on the `Config` service.
- The `Database` service depends on both the `Config` and `Logger` services.

Our goal is to build the `Database` service along with its direct and indirect dependencies. This means we need to ensure that the `Config` service is available for both `Logger` and `Database`, and then provide these dependencies to the `Database` service.

## Avoiding Requirement Leakage

When constructing the `Database` service, it's important to avoid exposing the dependencies on `Config` and `Logger` within the `Database` interface.

You might be tempted to define the `Database` service as follows:

**Example** (Leaking Dependencies in the Service Interface)

```ts twoslash "Config | Logger"
import { Effect, Context } from "effect"

// Declaring a tag for the Config service
class Config extends Context.Tag("Config")<Config, {}>() {}

// Declaring a tag for the Logger service
class Logger extends Context.Tag("Logger")<Logger, {}>() {}

// Declaring a tag for the Database service
class Database extends Context.Tag("Database")<
  Database,
  {
    // ❌ Avoid exposing Config and Logger as a requirement
    readonly query: (
      sql: string
    ) => Effect.Effect<unknown, never, Config | Logger>
  }
>() {}
```

Here, the `query` function of the `Database` service requires both `Config` and `Logger`. This design leaks implementation details, making the `Database` service aware of its dependencies, which complicates testing and makes it difficult to mock.

<Aside type="tip" title="Keep Service Interfaces Simple">
  Service functions should avoid requiring dependencies directly. In practice, service operations should have the `Requirements` parameter set to `never`:

```text showLineNumbers=false "never"
                         ┌─── No dependencies required
                         ▼
Effect<Success, Error, never>
```

</Aside>

To demonstrate the problem, let's create a test instance of the `Database` service:

**Example** (Creating a Test Instance with Leaked Dependencies)

```ts twoslash collapse={3-17}
import { Effect, Context } from "effect"

// Declaring a tag for the Config service
class Config extends Context.Tag("Config")<Config, {}>() {}

// Declaring a tag for the Logger service
class Logger extends Context.Tag("Logger")<Logger, {}>() {}

// Declaring a tag for the Database service
class Database extends Context.Tag("Database")<
  Database,
  {
    readonly query: (
      sql: string
    ) => Effect.Effect<unknown, never, Config | Logger>
  }
>() {}

// Declaring a test instance of the Database service
const DatabaseTest = Database.of({
  // Simulating a simple response
  query: (sql: string) => Effect.succeed([])
})

import * as assert from "node:assert"

// A test that uses the Database service
const test = Effect.gen(function* () {
  const database = yield* Database
  const result = yield* database.query("SELECT * FROM users")
  assert.deepStrictEqual(result, [])
})

//      ┌─── Effect<unknown, never, Config | Logger>
//      ▼
const incompleteTestSetup = test.pipe(
  // Attempt to provide only the Database service without Config and Logger
  Effect.provideService(Database, DatabaseTest)
)
```

Because the `Database` service interface directly includes dependencies on `Config` and `Logger`, it forces any test setup to include these services, even if they're irrelevant to the test. This adds unnecessary complexity and makes it difficult to write simple, isolated unit tests.

Instead of directly tying dependencies to the `Database` service interface, dependencies should be managed at the construction phase.

We can use **layers** to properly construct the `Database` service and manage its dependencies without leaking details into the interface.

<Aside type="tip" title="Use Layers for Dependencies">
  When a service has its own requirements, it's best to separate
  implementation details into layers. Layers act as **constructors for
  creating the service**, allowing us to handle dependencies at the
  construction level rather than the service level.
</Aside>

## Creating Layers

The `Layer` type is structured as follows:

```text showLineNumbers=false
        ┌─── The service to be created
        │                ┌─── The possible error
        │                │      ┌─── The required dependencies
        ▼                ▼      ▼
Layer<RequirementsOut, Error, RequirementsIn>
```

A `Layer` represents a blueprint for constructing a `RequirementsOut` (the service). It requires a `RequirementsIn` (dependencies) as input and may result in an error of type `Error` during the construction process.

| Parameter         | Description                                                                |
| ----------------- | -------------------------------------------------------------------------- |
| `RequirementsOut` | The service or resource to be created.                                     |
| `Error`           | The type of error that might occur during the construction of the service. |
| `RequirementsIn`  | The dependencies required to construct the service.                        |

By using layers, you can better organize your services, ensuring that their dependencies are clearly defined and separated from their implementation details.

For simplicity, let's assume that we won't encounter any errors during the value construction (meaning `Error = never`).

Now, let's determine how many layers we need to implement our dependency graph:

| Layer          | Dependencies                                               | Type                                       |
| -------------- | ---------------------------------------------------------- | ------------------------------------------ |
| `ConfigLive`   | The `Config` service does not depend on any other services | `Layer<Config>`                            |
| `LoggerLive`   | The `Logger` service depends on the `Config` service       | `Layer<Logger, never, Config>`             |
| `DatabaseLive` | The `Database` service depends on `Config` and `Logger`    | `Layer<Database, never, Config \| Logger>` |

<Aside type="tip" title="Naming Conventions">
  A common convention when naming the `Layer` for a particular service is
  to add a `Live` suffix for the "live" implementation and a `Test` suffix
  for the "test" implementation. For example, for a `Database` service,
  the `DatabaseLive` would be the layer you provide in your application
  and the `DatabaseTest` would be the layer you provide in your tests.
</Aside>

When a service has multiple dependencies, they are represented as a **union type**. In our case, the `Database` service depends on both the `Config` and `Logger` services. Therefore, the type for the `DatabaseLive` layer will be:

```ts showLineNumbers=false "Config | Logger"
Layer<Database, never, Config | Logger>
```

### Config

The `Config` service does not depend on any other services, so `ConfigLive` will be the simplest layer to implement. Just like in the [Managing Services](/docs/requirements-management/services/) page, we must create a tag for the service. And because the service has no dependencies, we can create the layer directly using the `Layer.succeed` constructor:

```ts twoslash
import { Effect, Context, Layer } from "effect"

// Declaring a tag for the Config service
class Config extends Context.Tag("Config")<
  Config,
  {
    readonly getConfig: Effect.Effect<{
      readonly logLevel: string
      readonly connection: string
    }>
  }
>() {}

// Layer<Config, never, never>
const ConfigLive = Layer.succeed(
  Config,
  Config.of({
    getConfig: Effect.succeed({
      logLevel: "INFO",
      connection: "mysql://username:password@hostname:port/database_name"
    })
  })
)
```

Looking at the type of `ConfigLive` we can observe:

- `RequirementsOut` is `Config`, indicating that constructing the layer will produce a `Config` service
- `Error` is `never`, indicating that layer construction cannot fail
- `RequirementsIn` is `never`, indicating that the layer has no dependencies

Note that, to construct `ConfigLive`, we used the `Config.of`
constructor. However, this is merely a helper to ensure correct type inference
for the implementation. It's possible to skip this helper and construct the
implementation directly as a simple object:

```ts twoslash collapse={4-12}
import { Effect, Context, Layer } from "effect"

// Declaring a tag for the Config service
class Config extends Context.Tag("Config")<
  Config,
  {
    readonly getConfig: Effect.Effect<{
      readonly logLevel: string
      readonly connection: string
    }>
  }
>() {}

// Layer<Config, never, never>
const ConfigLive = Layer.succeed(Config, {
  getConfig: Effect.succeed({
    logLevel: "INFO",
    connection: "mysql://username:password@hostname:port/database_name"
  })
})
```

### Logger

Now we can move on to the implementation of the `Logger` service, which depends on the `Config` service to retrieve some configuration.

Just like we did in the [Managing Services](/docs/requirements-management/services/#using-the-service) page, we can yield the `Config` tag to "extract" the service from the context.

Given that using the `Config` tag is an effectful operation, we use `Layer.effect` to create a layer from the resulting effect.

```ts twoslash collapse={4-20}
import { Effect, Context, Layer } from "effect"

// Declaring a tag for the Config service
class Config extends Context.Tag("Config")<
  Config,
  {
    readonly getConfig: Effect.Effect<{
      readonly logLevel: string
      readonly connection: string
    }>
  }
>() {}

// Layer<Config, never, never>
const ConfigLive = Layer.succeed(Config, {
  getConfig: Effect.succeed({
    logLevel: "INFO",
    connection: "mysql://username:password@hostname:port/database_name"
  })
})

// Declaring a tag for the Logger service
class Logger extends Context.Tag("Logger")<
  Logger,
  { readonly log: (message: string) => Effect.Effect<void> }
>() {}

// Layer<Logger, never, Config>
const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    const config = yield* Config
    return {
      log: (message) =>
        Effect.gen(function* () {
          const { logLevel } = yield* config.getConfig
          console.log(`[${logLevel}] ${message}`)
        })
    }
  })
)
```

Looking at the type of `LoggerLive`:

```ts showLineNumbers=false
Layer<Logger, never, Config>
```

we can observe that:

- `RequirementsOut` is `Logger`
- `Error` is `never`, indicating that layer construction cannot fail
- `RequirementsIn` is `Config`, indicating that the layer has a requirement

### Database

Finally, we can use our `Config` and `Logger` services to implement the `Database` service.

```ts twoslash collapse={4-20,23-41}
import { Effect, Context, Layer } from "effect"

// Declaring a tag for the Config service
class Config extends Context.Tag("Config")<
  Config,
  {
    readonly getConfig: Effect.Effect<{
      readonly logLevel: string
      readonly connection: string
    }>
  }
>() {}

// Layer<Config, never, never>
const ConfigLive = Layer.succeed(Config, {
  getConfig: Effect.succeed({
    logLevel: "INFO",
    connection: "mysql://username:password@hostname:port/database_name"
  })
})

// Declaring a tag for the Logger service
class Logger extends Context.Tag("Logger")<
  Logger,
  { readonly log: (message: string) => Effect.Effect<void> }
>() {}

// Layer<Logger, never, Config>
const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    const config = yield* Config
    return {
      log: (message) =>
        Effect.gen(function* () {
          const { logLevel } = yield* config.getConfig
          console.log(`[${logLevel}] ${message}`)
        })
    }
  })
)

// Declaring a tag for the Database service
class Database extends Context.Tag("Database")<
  Database,
  { readonly query: (sql: string) => Effect.Effect<unknown> }
>() {}

// Layer<Database, never, Config | Logger>
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config
    const logger = yield* Logger
    return {
      query: (sql: string) =>
        Effect.gen(function* () {
          yield* logger.log(`Executing query: ${sql}`)
          const { connection } = yield* config.getConfig
          return { result: `Results from ${connection}` }
        })
    }
  })
)
```

Looking at the type of `DatabaseLive`:

```ts showLineNumbers=false
Layer<Database, never, Config | Logger>
```

we can observe that the `RequirementsIn` type is `Config | Logger`, i.e., the `Database` service requires both `Config` and `Logger` services.

## Combining Layers

Layers can be combined in two primary ways: **merging** and **composing**.

### Merging Layers

Layers can be combined through merging using the `Layer.merge` function:

```ts twoslash
import { Layer } from "effect"

declare const layer1: Layer.Layer<"Out1", never, "In1">
declare const layer2: Layer.Layer<"Out2", never, "In2">

// Layer<"Out1" | "Out2", never, "In1" | "In2">
const merging = Layer.merge(layer1, layer2)
```

When we merge two layers, the resulting layer:

- requires all the services that both of them require (`"In1" | "In2"`).
- produces all services that both of them produce (`"Out1" | "Out2"`).

For example, in our web application above, we can merge our `ConfigLive` and `LoggerLive` layers into a single `AppConfigLive` layer, which retains the requirements of both layers (`never | Config = Config`) and the outputs of both layers (`Config | Logger`):

```ts twoslash collapse={4-20,23-41}
import { Effect, Context, Layer } from "effect"

// Declaring a tag for the Config service
class Config extends Context.Tag("Config")<
  Config,
  {
    readonly getConfig: Effect.Effect<{
      readonly logLevel: string
      readonly connection: string
    }>
  }
>() {}

// Layer<Config, never, never>
const ConfigLive = Layer.succeed(Config, {
  getConfig: Effect.succeed({
    logLevel: "INFO",
    connection: "mysql://username:password@hostname:port/database_name"
  })
})

// Declaring a tag for the Logger service
class Logger extends Context.Tag("Logger")<
  Logger,
  { readonly log: (message: string) => Effect.Effect<void> }
>() {}

// Layer<Logger, never, Config>
const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    const config = yield* Config
    return {
      log: (message) =>
        Effect.gen(function* () {
          const { logLevel } = yield* config.getConfig
          console.log(`[${logLevel}] ${message}`)
        })
    }
  })
)

// Layer<Config | Logger, never, Config>
const AppConfigLive = Layer.merge(ConfigLive, LoggerLive)
```

### Composing Layers

Layers can be composed using the `Layer.provide` function:

```ts twoslash
import { Layer } from "effect"

declare const inner: Layer.Layer<"OutInner", never, "InInner">
declare const outer: Layer.Layer<"InInner", never, "InOuter">

// Layer<"OutInner", never, "InOuter">
const composition = Layer.provide(inner, outer)
```

Sequential composition of layers implies that the output of one layer is supplied as the input for the inner layer,
resulting in a single layer with the requirements of the outer layer and the output of the inner.

Now we can compose the `AppConfigLive` layer with the `DatabaseLive` layer:

```ts twoslash collapse={4-20,23-41,44-64}
import { Effect, Context, Layer } from "effect"

// Declaring a tag for the Config service
class Config extends Context.Tag("Config")<
  Config,
  {
    readonly getConfig: Effect.Effect<{
      readonly logLevel: string
      readonly connection: string
    }>
  }
>() {}

// Layer<Config, never, never>
const ConfigLive = Layer.succeed(Config, {
  getConfig: Effect.succeed({
    logLevel: "INFO",
    connection: "mysql://username:password@hostname:port/database_name"
  })
})

// Declaring a tag for the Logger service
class Logger extends Context.Tag("Logger")<
  Logger,
  { readonly log: (message: string) => Effect.Effect<void> }
>() {}

// Layer<Logger, never, Config>
const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    const config = yield* Config
    return {
      log: (message) =>
        Effect.gen(function* () {
          const { logLevel } = yield* config.getConfig
          console.log(`[${logLevel}] ${message}`)
        })
    }
  })
)

// Declaring a tag for the Database service
class Database extends Context.Tag("Database")<
  Database,
  { readonly query: (sql: string) => Effect.Effect<unknown> }
>() {}

// Layer<Database, never, Config | Logger>
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config
    const logger = yield* Logger
    return {
      query: (sql: string) =>
        Effect.gen(function* () {
          yield* logger.log(`Executing query: ${sql}`)
          const { connection } = yield* config.getConfig
          return { result: `Results from ${connection}` }
        })
    }
  })
)

// Layer<Config | Logger, never, Config>
const AppConfigLive = Layer.merge(ConfigLive, LoggerLive)

// Layer<Database, never, never>
const MainLive = DatabaseLive.pipe(
  // provides the config and logger to the database
  Layer.provide(AppConfigLive),
  // provides the config to AppConfigLive
  Layer.provide(ConfigLive)
)
```

We obtained a `MainLive` layer that produces the `Database` service:

```ts showLineNumbers=false
Layer<Database, never, never>
```

This layer is the fully resolved layer for our application.

### Merging and Composing Layers

Let's say we want our `MainLive` layer to return both the `Config` and `Database` services. We can achieve this with `Layer.provideMerge`:

```ts twoslash collapse={4-19,22-39,42-61}
import { Effect, Context, Layer } from "effect"

// Declaring a tag for the Config service
class Config extends Context.Tag("Config")<
  Config,
  {
    readonly getConfig: Effect.Effect<{
      readonly logLevel: string
      readonly connection: string
    }>
  }
>() {}

const ConfigLive = Layer.succeed(Config, {
  getConfig: Effect.succeed({
    logLevel: "INFO",
    connection: "mysql://username:password@hostname:port/database_name"
  })
})

// Declaring a tag for the Logger service
class Logger extends Context.Tag("Logger")<
  Logger,
  { readonly log: (message: string) => Effect.Effect<void> }
>() {}

const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    const config = yield* Config
    return {
      log: (message) =>
        Effect.gen(function* () {
          const { logLevel } = yield* config.getConfig
          console.log(`[${logLevel}] ${message}`)
        })
    }
  })
)

// Declaring a tag for the Database service
class Database extends Context.Tag("Database")<
  Database,
  { readonly query: (sql: string) => Effect.Effect<unknown> }
>() {}

const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config
    const logger = yield* Logger
    return {
      query: (sql: string) =>
        Effect.gen(function* () {
          yield* logger.log(`Executing query: ${sql}`)
          const { connection } = yield* config.getConfig
          return { result: `Results from ${connection}` }
        })
    }
  })
)

// Layer<Config | Logger, never, Config>
const AppConfigLive = Layer.merge(ConfigLive, LoggerLive)

// Layer<Config | Database, never, never>
const MainLive = DatabaseLive.pipe(
  Layer.provide(AppConfigLive),
  Layer.provideMerge(ConfigLive)
)
```

## Providing a Layer to an Effect

Now that we have assembled the fully resolved `MainLive` for our application,
we can provide it to our program to satisfy the program's requirements using `Effect.provide`:

```ts twoslash collapse={3-65}
import { Effect, Context, Layer } from "effect"

class Config extends Context.Tag("Config")<
  Config,
  {
    readonly getConfig: Effect.Effect<{
      readonly logLevel: string
      readonly connection: string
    }>
  }
>() {}

const ConfigLive = Layer.succeed(Config, {
  getConfig: Effect.succeed({
    logLevel: "INFO",
    connection: "mysql://username:password@hostname:port/database_name"
  })
})

class Logger extends Context.Tag("Logger")<
  Logger,
  { readonly log: (message: string) => Effect.Effect<void> }
>() {}

const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    const config = yield* Config
    return {
      log: (message) =>
        Effect.gen(function* () {
          const { logLevel } = yield* config.getConfig
          console.log(`[${logLevel}] ${message}`)
        })
    }
  })
)

class Database extends Context.Tag("Database")<
  Database,
  { readonly query: (sql: string) => Effect.Effect<unknown> }
>() {}

const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config
    const logger = yield* Logger
    return {
      query: (sql: string) =>
        Effect.gen(function* () {
          yield* logger.log(`Executing query: ${sql}`)
          const { connection } = yield* config.getConfig
          return { result: `Results from ${connection}` }
        })
    }
  })
)

const AppConfigLive = Layer.merge(ConfigLive, LoggerLive)

const MainLive = DatabaseLive.pipe(
  Layer.provide(AppConfigLive),
  Layer.provide(ConfigLive)
)

//      ┌─── Effect<unknown, never, Database>
//      ▼
const program = Effect.gen(function* () {
  const database = yield* Database
  const result = yield* database.query("SELECT * FROM users")
  return result
})

//      ┌─── Effect<unknown, never, never>
//      ▼
const runnable = Effect.provide(program, MainLive)

Effect.runPromise(runnable).then(console.log)
/*
Output:
[INFO] Executing query: SELECT * FROM users
{
  result: 'Results from mysql://username:password@hostname:port/database_name'
}
*/
```

Note that the `runnable` requirements type is `never`, indicating that the program does not require any additional services to run.

## Converting a Layer to an Effect

Sometimes your entire application might be a Layer, for example, an HTTP server. You can convert that layer to an effect with `Layer.launch`. It constructs the layer and keeps it alive until interrupted.

**Example** (Launching an HTTP Server Layer)

```ts twoslash
import { Console, Context, Effect, Layer } from "effect"

class HTTPServer extends Context.Tag("HTTPServer")<HTTPServer, void>() {}

// Simulating an HTTP server
const server = Layer.effect(
  HTTPServer,
  // Log a message to simulate a server starting
  Console.log("Listening on http://localhost:3000")
)

// Converts the layer to an effect and runs it
Effect.runFork(Layer.launch(server))
/*
Output:
Listening on http://localhost:3000
...
*/
```

## Tapping

The `Layer.tap` and `Layer.tapError` functions allow you to perform additional effects based on the success or failure of a layer. These operations do not modify the layer's signature but are useful for logging or performing side effects during layer construction.

- `Layer.tap`: Executes a specified effect when the layer is successfully acquired.
- `Layer.tapError`: Executes a specified effect when the layer fails to acquire.

**Example** (Logging Success and Failure During Layer Acquisition)

```ts twoslash
import { Config, Context, Effect, Layer, Console } from "effect"

class HTTPServer extends Context.Tag("HTTPServer")<HTTPServer, void>() {}

// Simulating an HTTP server
const server = Layer.effect(
  HTTPServer,
  Effect.gen(function* () {
    const host = yield* Config.string("HOST")
    console.log(`Listening on http://localhost:${host}`)
  })
).pipe(
  // Log a message if the layer acquisition succeeds
  Layer.tap((ctx) =>
    Console.log(`layer acquisition succeeded with:\n${ctx}`)
  ),
  // Log a message if the layer acquisition fails
  Layer.tapError((err) =>
    Console.log(`layer acquisition failed with:\n${err}`)
  )
)

Effect.runFork(Layer.launch(server))
/*
Output:
layer acquisition failed with:
(Missing data at HOST: "Expected HOST to exist in the process context")
*/
```

## Error Handling

When constructing layers, it is important to handle potential errors. The Effect library provides tools like `Layer.catchAll` and `Layer.orElse` to manage errors and define fallback layers in case of failure.

### catchAll

The `Layer.catchAll` function allows you to recover from errors during layer construction by specifying a fallback layer. This can be useful for handling specific error cases and ensuring the application can continue with an alternative setup.

**Example** (Recovering from Errors During Layer Construction)

```ts twoslash
import { Config, Context, Effect, Layer } from "effect"

class HTTPServer extends Context.Tag("HTTPServer")<HTTPServer, void>() {}

// Simulating an HTTP server
const server = Layer.effect(
  HTTPServer,
  Effect.gen(function* () {
    const host = yield* Config.string("HOST")
    console.log(`Listening on http://localhost:${host}`)
  })
).pipe(
  // Recover from errors during layer construction
  Layer.catchAll((configError) =>
    Layer.effect(
      HTTPServer,
      Effect.gen(function* () {
        console.log(`Recovering from error:\n${configError}`)
        console.log(`Listening on http://localhost:3000`)
      })
    )
  )
)

Effect.runFork(Layer.launch(server))
/*
Output:
Recovering from error:
(Missing data at HOST: "Expected HOST to exist in the process context")
Listening on http://localhost:3000
...
*/
```

### orElse

The `Layer.orElse` function provides a simpler way to fall back to an alternative layer if the initial layer fails. Unlike `Layer.catchAll`, it does not receive the error as input. Use this when you only need to provide a default layer without reacting to specific errors.

**Example** (Fallback to an Alternative Layer)

```ts twoslash
import { Config, Context, Effect, Layer } from "effect"

class Database extends Context.Tag("Database")<Database, void>() {}

// Simulating a database connection
const postgresDatabaseLayer = Layer.effect(
  Database,
  Effect.gen(function* () {
    const databaseConnectionString = yield* Config.string(
      "CONNECTION_STRING"
    )
    console.log(
      `Connecting to database with: ${databaseConnectionString}`
    )
  })
)

// Simulating an in-memory database connection
const inMemoryDatabaseLayer = Layer.effect(
  Database,
  Effect.gen(function* () {
    console.log(`Connecting to in-memory database`)
  })
)

// Fallback to in-memory database if PostgreSQL connection fails
const database = postgresDatabaseLayer.pipe(
  Layer.orElse(() => inMemoryDatabaseLayer)
)

Effect.runFork(Layer.launch(database))
/*
Output:
Connecting to in-memory database
...
*/
```

## Simplifying Service Definitions with Effect.Service

The `Effect.Service` API provides a way to define a service in a single step, including its tag and layer.
It also allows specifying dependencies upfront, making service construction more straightforward.

### Defining a Service with Dependencies

The following example defines a `Cache` service that depends on a file system.

**Example** (Defining a Cache Service)

```ts twoslash
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Effect } from "effect"

// Define a Cache service
class Cache extends Effect.Service<Cache>()("app/Cache", {
  // Define how to create the service
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const lookup = (key: string) => fs.readFileString(`cache/${key}`)
    return { lookup } as const
  }),
  // Specify dependencies
  dependencies: [NodeFileSystem.layer]
}) {}
```

### Using the Generated Layers

The `Effect.Service` API automatically generates layers for the service.

| Layer                              | Description                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `Cache.Default`                    | Provides the `Cache` service with its dependencies already included.              |
| `Cache.DefaultWithoutDependencies` | Provides the `Cache` service but requires dependencies to be provided separately. |

```ts twoslash collapse={6-13}
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Effect } from "effect"

// Define a Cache service
class Cache extends Effect.Service<Cache>()("app/Cache", {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const lookup = (key: string) => fs.readFileString(`cache/${key}`)
    return { lookup } as const
  }),
  dependencies: [NodeFileSystem.layer]
}) {}

// Layer that includes all required dependencies
//
//      ┌─── Layer<Cache>
//      ▼
const layer = Cache.Default

// Layer without dependencies, requiring them to be provided externally
//
//      ┌─── Layer.Layer<Cache, never, FileSystem>
//      ▼
const layerNoDeps = Cache.DefaultWithoutDependencies
```

### Accessing the Service

A service created with `Effect.Service` can be accessed like any other Effect service.

**Example** (Accessing the Cache Service)

```ts twoslash collapse={6-13}
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Effect, Console } from "effect"

// Define a Cache service
class Cache extends Effect.Service<Cache>()("app/Cache", {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const lookup = (key: string) => fs.readFileString(`cache/${key}`)
    return { lookup } as const
  }),
  dependencies: [NodeFileSystem.layer]
}) {}

// Accessing the Cache Service
const program = Effect.gen(function* () {
  const cache = yield* Cache
  const data = yield* cache.lookup("my-key")
  console.log(data)
}).pipe(Effect.catchAllCause((cause) => Console.log(cause)))

const runnable = program.pipe(Effect.provide(Cache.Default))

Effect.runFork(runnable)
/*
{
  _id: 'Cause',
  _tag: 'Fail',
  failure: {
    _tag: 'SystemError',
    reason: 'NotFound',
    module: 'FileSystem',
    method: 'readFile',
    pathOrDescriptor: 'cache/my-key',
    syscall: 'open',
    message: "ENOENT: no such file or directory, open 'cache/my-key'",
    [Symbol(@effect/platform/Error/PlatformErrorTypeId)]: Symbol(@effect/platform/Error/PlatformErrorTypeId)
  }
}
*/
```

Since this example uses `Cache.Default`, it interacts with the real file system. If the file does not exist, it results in an error.

### Injecting Test Dependencies

To test the program without depending on the real file system, we can inject a test file system using the `Cache.DefaultWithoutDependencies` layer.

**Example** (Using a Test File System)

```ts twoslash collapse={6-13,16-20}
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Effect, Console } from "effect"

// Define a Cache service
class Cache extends Effect.Service<Cache>()("app/Cache", {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const lookup = (key: string) => fs.readFileString(`cache/${key}`)
    return { lookup } as const
  }),
  dependencies: [NodeFileSystem.layer]
}) {}

// Accessing the Cache Service
const program = Effect.gen(function* () {
  const cache = yield* Cache
  const data = yield* cache.lookup("my-key")
  console.log(data)
}).pipe(Effect.catchAllCause((cause) => Console.log(cause)))

// Create a test file system that always returns a fixed value
const FileSystemTest = FileSystem.layerNoop({
  readFileString: () => Effect.succeed("File Content...")
})

const runnable = program.pipe(
  Effect.provide(Cache.DefaultWithoutDependencies),
  // Provide the mock file system
  Effect.provide(FileSystemTest)
)

Effect.runFork(runnable)
// Output: File Content...
```

### Mocking the Service Directly

Alternatively, you can mock the `Cache` service itself instead of replacing its dependencies.

**Example** (Mocking the Cache Service)

```ts twoslash collapse={6-13,16-20}
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Effect, Console } from "effect"

// Define a Cache service
class Cache extends Effect.Service<Cache>()("app/Cache", {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const lookup = (key: string) => fs.readFileString(`cache/${key}`)
    return { lookup } as const
  }),
  dependencies: [NodeFileSystem.layer]
}) {}

// Accessing the Cache Service
const program = Effect.gen(function* () {
  const cache = yield* Cache
  const data = yield* cache.lookup("my-key")
  console.log(data)
}).pipe(Effect.catchAllCause((cause) => Console.log(cause)))

// Create a mock implementation of Cache
const cache = new Cache({
  lookup: () => Effect.succeed("Cache Content...")
})

// Provide the mock Cache service
const runnable = program.pipe(Effect.provideService(Cache, cache))

Effect.runFork(runnable)
// Output: File Content...
```

### Alternative Ways to Define a Service

The `Effect.Service` API supports multiple ways to define a service:

| Method    | Description                                        |
| --------- | -------------------------------------------------- |
| `succeed` | Provides a static implementation of the service.   |
| `sync`    | Defines a service using a synchronous constructor. |
| `effect`  | Defines a service with an effectful constructor.   |
| `scoped`  | Creates a service with lifecycle management.       |

**Example** (Defining a Service with a Static Implementation)

This is the simplest way to define a service. It is useful when you want to provide a constant value for the service.

```ts twoslash
import { Effect } from "effect"

class MagicNumber extends Effect.Service<MagicNumber>()("MagicNumber", {
  succeed: { value: 42 }
}) {}

//      ┌─── Effect<void, never, MagicNumber>
//      ▼
const program = Effect.gen(function* () {
  const magicNumber = yield* MagicNumber
  console.log(`The magic number is ${magicNumber.value}`)
})

Effect.runPromise(program.pipe(Effect.provide(MagicNumber.Default)))
// The magic number is 42
```

**Example** (Defining a Service with a Synchronous Constructor)

```ts twoslash
import { Effect, Random } from "effect"

class Sync extends Effect.Service<Sync>()("Sync", {
  sync: () => ({
    next: Random.nextInt
  })
}) {}

//      ┌─── Effect<void, never, Sync>
//      ▼
const program = Effect.gen(function* () {
  const sync = yield* Sync
  const n = yield* sync.next
  console.log(`The number is ${n}`)
})

Effect.runPromise(program.pipe(Effect.provide(Sync.Default)))
// Example Output: The number is 3858843290019673
```

**Example** (Managing a Service with Lifecycle Control)

```ts twoslash
import { Effect, Console } from "effect"

class Scoped extends Effect.Service<Scoped>()("Scoped", {
  scoped: Effect.gen(function* () {
    // Acquire the resource and ensure it is properly released
    const resource = yield* Effect.acquireRelease(
      Console.log("Aquiring...").pipe(Effect.as("foo")),
      () => Console.log("Releasing...")
    )
    // Register a finalizer to run when the effect is completed
    yield* Effect.addFinalizer(() => Console.log("Shutting down"))
    return { resource }
  })
}) {}

//      ┌─── Effect<void, never, Scoped>
//      ▼
const program = Effect.gen(function* () {
  const resource = (yield* Scoped).resource
  console.log(`The resource is ${resource}`)
})

Effect.runPromise(
  program.pipe(
    Effect.provide(
      //       ┌─── Layer<Scoped, never, never>
      //       ▼
      Scoped.Default
    )
  )
)
/*
Aquiring...
The resource is foo
Shutting down
Releasing...
*/
```

The `Scoped.Default` layer does not require `Scope` as a dependency, since `Scoped` itself manages its lifecycle.

### Enabling Direct Method Access

By setting `accessors: true`, you can call service methods directly using the service tag instead of first extracting the service.

**Example** (Defining a Service with Direct Method Access)

```ts twoslash del={11-12} ins={13}
import { Effect, Random } from "effect"

class Sync extends Effect.Service<Sync>()("Sync", {
  sync: () => ({
    next: Random.nextInt
  }),
  accessors: true // Enables direct method access via the tag
}) {}

const program = Effect.gen(function* () {
  // const sync = yield* Sync
  // const n = yield* sync.next
  const n = yield* Sync.next // No need to extract the service first
  console.log(`The number is ${n}`)
})

Effect.runPromise(program.pipe(Effect.provide(Sync.Default)))
// Example Output: The number is 3858843290019673
```

<Aside type="caution" title="Limitation of Direct Method Access">
  Direct method access does not work with generic methods.
</Aside>

### Effect.Service vs Context.Tag

Both `Effect.Service` and `Context.Tag` are ways to model services in the Effect ecosystem. They serve similar purposes but target different use-cases.

| Feature                             | Effect.Service                                          | Context.Tag                               |
| ----------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| Tag creation                        | Generated for you (the class name acts as the tag)      | You declare the tag manually              |
| Default implementation              | **Required** - supplied inline (`effect`, `sync`, etc.) | **Optional** - can be supplied later      |
| Ready-made layers (`.Default`, ...) | Automatically generated                                 | You build layers yourself                 |
| Best suited for                     | Application code with a clear runtime implementation    | Library code or dynamically-scoped values |
| When no sensible default exists     | Not ideal; you would still have to invent one           | Preferred                                 |

**Key points**

- **Less boilerplate:** `Effect.Service` is syntactic sugar over `Context.Tag` plus the accompanying layer and helpers.
- **Default required:**
  A class that extends `Effect.Service` must declare **one** of the built-in constructors (`effect`, `sync`, `succeed`, or `scoped`). This baseline implementation becomes part of `MyService.Default`, so any code that imports the service can run without providing extra layers.
  That is handy for app-level services where a sensible runtime implementation exists (logging, HTTP clients, real databases, and so on).
  If your service is inherently contextual (for example, a per-request database handle) or you are writing a library that should not assume an implementation, prefer `Context.Tag`: you publish only the tag and let callers supply the layer that makes sense in their environment.
- **The class _is_ the tag:** When you create a class with `extends Effect.Service`, the class constructor itself acts as the tag. You can provide alternate implementations by supplying a value for that class when wiring layers:

  ```ts
  const mock = new MyService({
    /* mocked methods */
  })
  program.pipe(Effect.provideService(MyService, mock))
  ```
