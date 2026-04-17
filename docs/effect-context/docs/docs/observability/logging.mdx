---
title: Logging
description: Discover Effect's logging utilities for dynamic log levels, custom outputs, and fine-grained control over logs.
sidebar:
  order: 0
---

import { Aside } from "@astrojs/starlight/components"

Logging is an important aspect of software development, especially for debugging and monitoring the behavior of your applications. In this section, we'll explore Effect's logging utilities and see how they compare to traditional logging methods.

## Advantages Over Traditional Logging

Effect's logging utilities provide several benefits over conventional logging approaches:

1. **Dynamic Log Level Control**: With Effect's logging, you have the ability to change the log level dynamically. This means you can control which log messages get displayed based on their severity. For example, you can configure your application to log only warnings or errors, which can be extremely helpful in production environments to reduce noise.

2. **Custom Logging Output**: Effect's logging utilities allow you to change how logs are handled. You can direct log messages to various destinations, such as a service or a file, using a [custom logger](#custom-loggers). This flexibility ensures that logs are stored and processed in a way that best suits your application's requirements.

3. **Fine-Grained Logging**: Effect enables fine-grained control over logging on a per-part basis of your program. You can set different log levels for different parts of your application, tailoring the level of detail to each specific component. This can be invaluable for debugging and troubleshooting, as you can focus on the information that matters most.

4. **Environment-Based Logging**: Effect's logging utilities can be combined with deployment environments to achieve granular logging strategies. For instance, during development, you might choose to log everything at a trace level and above for detailed debugging. In contrast, your production version could be configured to log only errors or critical issues, minimizing the impact on performance and noise in production logs.

5. **Additional Features**: Effect's logging utilities come with additional features such as the ability to measure time spans, alter log levels on a per-effect basis, and integrate spans for performance monitoring.

## log

The `Effect.log` function allows you to log a message at the default `INFO` level.

**Example** (Logging a Simple Message)

```ts twoslash
import { Effect } from "effect"

const program = Effect.log("Application started")

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#0 message="Application started"
*/
```

The default logger in Effect adds several useful details to each log entry:

| Annotation  | Description                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `timestamp` | The timestamp when the log message was generated.                                                   |
| `level`     | The log level at which the message is logged (e.g., `INFO`, `ERROR`).                               |
| `fiber`     | The identifier of the [fiber](/docs/concurrency/fibers/) executing the program.                     |
| `message`   | The log message content, which can include multiple strings or values.                              |
| `span`      | (Optional) The duration of a span in milliseconds, providing insight into the timing of operations. |

<Aside type="tip" title="Customizing Loggers">
  For information on how to tailor the logging setup to meet specific
  needs, such as integrating a custom logging framework or adjusting log
  formats, please consult the section on [Custom
  Loggers](#custom-loggers).
</Aside>

You can also log multiple messages at once.

**Example** (Logging Multiple Messages)

```ts twoslash
import { Effect } from "effect"

const program = Effect.log("message1", "message2", "message3")

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#0 message=message1 message=message2 message=message3
*/
```

For added context, you can also include one or more [Cause](/docs/data-types/cause/) instances in your logs,
which provide detailed error information under an additional `cause` annotation:

**Example** (Logging with Causes)

```ts twoslash "cause"
import { Effect, Cause } from "effect"

const program = Effect.log(
  "message1",
  "message2",
  Cause.die("Oh no!"),
  Cause.die("Oh uh!")
)

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#0 message=message1 message=message2 cause="Error: Oh no!
Error: Oh uh!"
*/
```

## Log Levels

### logDebug

By default, `DEBUG` messages **are not displayed**. To enable `DEBUG` logs, you can adjust the logging configuration using `Logger.withMinimumLogLevel`, setting the minimum level to `LogLevel.Debug`.

**Example** (Enabling Debug Logs)

```ts twoslash
import { Effect, Logger, LogLevel } from "effect"

const task1 = Effect.gen(function* () {
  yield* Effect.sleep("2 seconds")
  yield* Effect.logDebug("task1 done") // Log a debug message
}).pipe(Logger.withMinimumLogLevel(LogLevel.Debug)) // Enable DEBUG level

const task2 = Effect.gen(function* () {
  yield* Effect.sleep("1 second")
  yield* Effect.logDebug("task2 done") // This message won't be logged
})

const program = Effect.gen(function* () {
  yield* Effect.log("start")
  yield* task1
  yield* task2
  yield* Effect.log("done")
})

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO message=start
timestamp=... level=DEBUG message="task1 done" <-- 2 seconds later
timestamp=... level=INFO message=done <-- 1 second later
*/
```

<Aside type="tip" title="Controlling Log Levels Per Effect">
  By using `Logger.withMinimumLogLevel(effect, level)`, you can enable
  different log levels for specific parts of your program, providing
  fine-grained control over logging behavior.
</Aside>

### logInfo

The `INFO` log level is displayed by default. This level is typically used for general application events or progress updates.

**Example** (Logging at the Info Level)

```ts twoslash
import { Effect } from "effect"

const program = Effect.gen(function* () {
  yield* Effect.logInfo("start")
  yield* Effect.sleep("2 seconds")
  yield* Effect.sleep("1 second")
  yield* Effect.logInfo("done")
})

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO message=start
timestamp=... level=INFO message=done <-- 3 seconds later
*/
```

### logWarning

The `WARN` log level is displayed by default. This level is intended for potential issues or warnings that do not immediately disrupt the flow of the program but should be monitored.

**Example** (Logging at the Warning Level)

```ts twoslash
import { Effect, Either } from "effect"

const task = Effect.fail("Oh uh!").pipe(Effect.as(2))

const program = Effect.gen(function* () {
  const failureOrSuccess = yield* Effect.either(task)
  if (Either.isLeft(failureOrSuccess)) {
    yield* Effect.logWarning(failureOrSuccess.left)
    return 0
  } else {
    return failureOrSuccess.right
  }
})

Effect.runFork(program)
/*
Output:
timestamp=... level=WARN fiber=#0 message="Oh uh!"
*/
```

### logError

The `ERROR` log level is displayed by default. These messages represent issues that need to be addressed.

**Example** (Logging at the Error Level)

```ts twoslash
import { Effect, Either } from "effect"

const task = Effect.fail("Oh uh!").pipe(Effect.as(2))

const program = Effect.gen(function* () {
  const failureOrSuccess = yield* Effect.either(task)
  if (Either.isLeft(failureOrSuccess)) {
    yield* Effect.logError(failureOrSuccess.left)
    return 0
  } else {
    return failureOrSuccess.right
  }
})

Effect.runFork(program)
/*
Output:
timestamp=... level=ERROR fiber=#0 message="Oh uh!"
*/
```

### logFatal

The `FATAL` log level is displayed by default. This log level is typically reserved for unrecoverable errors.

**Example** (Logging at the Fatal Level)

```ts twoslash
import { Effect, Either } from "effect"

const task = Effect.fail("Oh uh!").pipe(Effect.as(2))

const program = Effect.gen(function* () {
  const failureOrSuccess = yield* Effect.either(task)
  if (Either.isLeft(failureOrSuccess)) {
    yield* Effect.logFatal(failureOrSuccess.left)
    return 0
  } else {
    return failureOrSuccess.right
  }
})

Effect.runFork(program)
/*
Output:
timestamp=... level=FATAL fiber=#0 message="Oh uh!"
*/
```

## Custom Annotations

You can enhance your log outputs by adding custom annotations using the `Effect.annotateLogs` function.
This allows you to attach extra metadata to each log entry, improving traceability and providing additional context.

### Adding a Single Annotation

You can apply a single annotation as a key/value pair to all log entries within an effect.

**Example** (Single Key/Value Annotation)

```ts twoslash
import { Effect } from "effect"

const program = Effect.gen(function* () {
  yield* Effect.log("message1")
  yield* Effect.log("message2")
}).pipe(
  // Annotation as key/value pair
  Effect.annotateLogs("key", "value")
)

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#0 message=message1 key=value
timestamp=... level=INFO fiber=#0 message=message2 key=value
*/
```

In this example, all logs generated within the `program` will include the annotation `key=value`.

<Aside type="tip" title="Scope of Annotations">
  Annotations applied with `Effect.annotateLogs` are automatically added
  to all logs generated within the annotated effect's scope, including
  logs from nested effects.
</Aside>

### Annotations with Nested Effects

Annotations propagate to all logs generated within nested or downstream effects. This ensures that logs from any child effects inherit the parent effect's annotations.

**Example** (Propagating Annotations to Nested Effects)

In this example, the annotation `key=value` is included in all logs, even those from the nested `anotherProgram` effect.

```ts twoslash
import { Effect } from "effect"

// Define a child program that logs an error
const anotherProgram = Effect.gen(function* () {
  yield* Effect.logError("error1")
})

// Define the main program
const program = Effect.gen(function* () {
  yield* Effect.log("message1")
  yield* Effect.log("message2")
  yield* anotherProgram // Call the nested program
}).pipe(
  // Attach an annotation to all logs in the scope
  Effect.annotateLogs("key", "value")
)

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#0 message=message1 key=value
timestamp=... level=INFO fiber=#0 message=message2 key=value
timestamp=... level=ERROR fiber=#0 message=error1 key=value
*/
```

### Adding Multiple Annotations

You can also apply multiple annotations at once by passing an object with key/value pairs. Each key/value pair will be added to every log entry within the effect.

**Example** (Multiple Annotations)

```ts twoslash
import { Effect } from "effect"

const program = Effect.gen(function* () {
  yield* Effect.log("message1")
  yield* Effect.log("message2")
}).pipe(
  // Add multiple annotations
  Effect.annotateLogs({ key1: "value1", key2: "value2" })
)

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#0 message=message1 key2=value2 key1=value1
timestamp=... level=INFO fiber=#0 message=message2 key2=value2 key1=value1
*/
```

In this case, each log will contain both `key1=value1` and `key2=value2`.

### Scoped Annotations

If you want to limit the scope of your annotations so that they only apply to certain log entries, you can use `Effect.annotateLogsScoped`. This function confines the annotations to logs produced within a specific scope.

**Example** (Scoped Annotations)

```ts twoslash
import { Effect } from "effect"

const program = Effect.gen(function* () {
  yield* Effect.log("no annotations") // No annotations
  yield* Effect.annotateLogsScoped({ key: "value" }) // Scoped annotation
  yield* Effect.log("message1") // Annotation applied
  yield* Effect.log("message2") // Annotation applied
}).pipe(
  Effect.scoped,
  // Outside scope, no annotations
  Effect.andThen(Effect.log("no annotations again"))
)

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#0 message="no annotations"
timestamp=... level=INFO fiber=#0 message=message1 key=value
timestamp=... level=INFO fiber=#0 message=message2 key=value
timestamp=... level=INFO fiber=#0 message="no annotations again"
*/
```

## Log Spans

Effect provides built-in support for log spans, which allow you to measure and log the duration of specific tasks or sections of your code. This feature is helpful for tracking how long certain operations take, giving you better insights into the performance of your application.

**Example** (Measuring Task Duration with a Log Span)

```ts twoslash
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // Simulate a delay to represent a task taking time
  yield* Effect.sleep("1 second")
  // Log a message indicating the job is done
  yield* Effect.log("The job is finished!")
}).pipe(
  // Apply a log span labeled "myspan" to measure
  // the duration of this operation
  Effect.withLogSpan("myspan")
)

Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#0 message="The job is finished!" myspan=1011ms
*/
```

## Disabling Default Logging

Sometimes, perhaps during test execution, you might want to disable default logging in your application. Effect provides several ways to turn off logging when needed. In this section, we'll look at different methods to disable logging in the Effect framework.

**Example** (Using `Logger.withMinimumLogLevel`)

One convenient way to disable logging is by using the `Logger.withMinimumLogLevel` function. This allows you to set the minimum log level to `None`, effectively turning off all log output.

```ts twoslash
import { Effect, Logger, LogLevel } from "effect"

const program = Effect.gen(function* () {
  yield* Effect.log("Executing task...")
  yield* Effect.sleep("100 millis")
  console.log("task done")
})

// Default behavior: logging enabled
Effect.runFork(program)
/*
Output:
timestamp=... level=INFO fiber=#0 message="Executing task..."
task done
*/

// Disable logging by setting minimum log level to 'None'
Effect.runFork(program.pipe(Logger.withMinimumLogLevel(LogLevel.None)))
/*
Output:
task done
*/
```

**Example** (Using a Layer)

Another approach to disable logging is by creating a layer that sets the minimum log level to `LogLevel.None`, effectively turning off all log output.

```ts twoslash
import { Effect, Logger, LogLevel } from "effect"

const program = Effect.gen(function* () {
  yield* Effect.log("Executing task...")
  yield* Effect.sleep("100 millis")
  console.log("task done")
})

// Create a layer that disables logging
const layer = Logger.minimumLogLevel(LogLevel.None)

// Apply the layer to disable logging
Effect.runFork(program.pipe(Effect.provide(layer)))
/*
Output:
task done
*/
```

**Example** (Using a Custom Runtime)

You can also disable logging by creating a custom runtime that includes the configuration to turn off logging:

```ts twoslash
import { Effect, Logger, LogLevel, ManagedRuntime } from "effect"

const program = Effect.gen(function* () {
  yield* Effect.log("Executing task...")
  yield* Effect.sleep("100 millis")
  console.log("task done")
})

// Create a custom runtime that disables logging
const customRuntime = ManagedRuntime.make(
  Logger.minimumLogLevel(LogLevel.None)
)

// Run the program using the custom runtime
customRuntime.runFork(program)
/*
Output:
task done
*/
```

## Loading the Log Level from Configuration

To dynamically load the log level from a [configuration](/docs/configuration/) and apply it to your program, you can use the `Logger.minimumLogLevel` layer. This allows your application to adjust its logging behavior based on external configuration.

**Example** (Loading Log Level from Configuration)

```ts twoslash
import {
  Effect,
  Config,
  Logger,
  Layer,
  ConfigProvider,
  LogLevel
} from "effect"

// Simulate a program with logs
const program = Effect.gen(function* () {
  yield* Effect.logError("ERROR!")
  yield* Effect.logWarning("WARNING!")
  yield* Effect.logInfo("INFO!")
  yield* Effect.logDebug("DEBUG!")
})

// Load the log level from the configuration and apply it as a layer
const LogLevelLive = Config.logLevel("LOG_LEVEL").pipe(
  Effect.andThen((level) =>
    // Set the minimum log level
    Logger.minimumLogLevel(level)
  ),
  Layer.unwrapEffect // Convert the effect into a layer
)

// Provide the loaded log level to the program
const configured = Effect.provide(program, LogLevelLive)

// Test the program using a mock configuration provider
const test = Effect.provide(
  configured,
  Layer.setConfigProvider(
    ConfigProvider.fromMap(
      new Map([["LOG_LEVEL", LogLevel.Warning.label]])
    )
  )
)

Effect.runFork(test)
/*
Output:
... level=ERROR fiber=#0 message=ERROR!
... level=WARN fiber=#0 message=WARNING!
*/
```

<Aside type="tip" title="Using ConfigProvider for Testing">
  The `ConfigProvider.fromMap` function is useful for testing by
  simulating configuration values. You can also refer to [Mocking
  Configurations in
  Tests](/docs/configuration/#mocking-configurations-in-tests) for more
  details on using mock configuration during tests.
</Aside>

## Custom loggers

In this section, you'll learn how to define a custom logger and set it as the default logger in your application. Custom loggers give you control over how log messages are handled, such as routing them to external services, writing to files, or formatting logs in a specific way.

### Defining a Custom Logger

You can define your own logger using the `Logger.make` function. This function allows you to specify how log messages should be processed.

**Example** (Defining a Simple Custom Logger)

```ts twoslash
import { Logger } from "effect"

// Custom logger that outputs log messages to the console
const logger = Logger.make(({ logLevel, message }) => {
  globalThis.console.log(`[${logLevel.label}] ${message}`)
})
```

In this example, the custom logger logs messages to the console with the log level and message formatted as `[LogLevel] Message`.

### Using a Custom Logger in a Program

Let's assume you have the following tasks and a program where you log some messages:

```ts twoslash collapse={3-6}
import { Effect, Logger } from "effect"

// Custom logger that outputs log messages to the console
const logger = Logger.make(({ logLevel, message }) => {
  globalThis.console.log(`[${logLevel.label}] ${message}`)
})

const task1 = Effect.gen(function* () {
  yield* Effect.sleep("2 seconds")
  yield* Effect.logDebug("task1 done")
})

const task2 = Effect.gen(function* () {
  yield* Effect.sleep("1 second")
  yield* Effect.logDebug("task2 done")
})

const program = Effect.gen(function* () {
  yield* Effect.log("start")
  yield* task1
  yield* task2
  yield* Effect.log("done")
})
```

To replace the default logger with your custom logger, you can use the `Logger.replace` function. After creating a layer that replaces the default logger, you provide it to your program using `Effect.provide`.

**Example** (Replacing the Default Logger with a Custom Logger)

```ts twoslash collapse={3-23}
import { Effect, Logger, LogLevel } from "effect"

// Custom logger that outputs log messages to the console
const logger = Logger.make(({ logLevel, message }) => {
  globalThis.console.log(`[${logLevel.label}] ${message}`)
})

const task1 = Effect.gen(function* () {
  yield* Effect.sleep("2 seconds")
  yield* Effect.logDebug("task1 done")
})

const task2 = Effect.gen(function* () {
  yield* Effect.sleep("1 second")
  yield* Effect.logDebug("task2 done")
})

const program = Effect.gen(function* () {
  yield* Effect.log("start")
  yield* task1
  yield* task2
  yield* Effect.log("done")
})

// Replace the default logger with the custom logger
const layer = Logger.replace(Logger.defaultLogger, logger)

Effect.runFork(
  program.pipe(
    Logger.withMinimumLogLevel(LogLevel.Debug),
    Effect.provide(layer)
  )
)
```

When you run the above program, the following log messages are printed to the console:

```ansi showLineNumbers=false
[INFO] start
[DEBUG] task1 done
[DEBUG] task2 done
[INFO] done
```

## Built-in Loggers

Effect provides several built-in loggers that you can use depending on your logging needs. These loggers offer different formats, each suited for different environments or purposes, such as development, production, or integration with external logging services.

Each logger is available in two forms: the logger itself, and a layer that uses the logger and sends its output to the `Console` [default service](/docs/requirements-management/default-services/). For example, the `structuredLogger` logger generates logs in a detailed object-based format, while the `structured` layer uses the same logger and writes the output to the `Console` service.

### stringLogger (default)

The `stringLogger` logger produces logs in a human-readable key-value style. This format is commonly used in development and production because it is simple and easy to read in the console.

This logger does not have a corresponding layer because it is the default logger.

```ts twoslash
import { Effect } from "effect"

const program = Effect.log("msg1", "msg2", ["msg3", "msg4"]).pipe(
  Effect.delay("100 millis"),
  Effect.annotateLogs({ key1: "value1", key2: "value2" }),
  Effect.withLogSpan("myspan")
)

Effect.runFork(program)
```

Output:

```ansi showLineNumbers=false
timestamp=2024-12-28T10:44:31.281Z level=INFO fiber=#0 message=msg1 message=msg2 message="[
  \"msg3\",
  \"msg4\"
]" myspan=102ms key2=value2 key1=value1
```

### logfmtLogger

The `logfmtLogger` logger produces logs in a human-readable key-value format, similar to the [stringLogger](#stringlogger-default) logger. The main difference is that `logfmtLogger` removes extra spaces to make logs more compact.

```ts twoslash
import { Effect, Logger } from "effect"

const program = Effect.log("msg1", "msg2", ["msg3", "msg4"]).pipe(
  Effect.delay("100 millis"),
  Effect.annotateLogs({ key1: "value1", key2: "value2" }),
  Effect.withLogSpan("myspan")
)

Effect.runFork(program.pipe(Effect.provide(Logger.logFmt)))
```

Output:

```ansi showLineNumbers=false
timestamp=2024-12-28T10:44:31.281Z level=INFO fiber=#0 message=msg1 message=msg2 message="[\"msg3\",\"msg4\"]" myspan=102ms key2=value2 key1=value1
```

### prettyLogger

The `prettyLogger` logger enhances log output by using color and indentation for better readability, making it particularly useful during development when visually scanning logs in the console.

```ts twoslash
import { Effect, Logger } from "effect"

const program = Effect.log("msg1", "msg2", ["msg3", "msg4"]).pipe(
  Effect.delay("100 millis"),
  Effect.annotateLogs({ key1: "value1", key2: "value2" }),
  Effect.withLogSpan("myspan")
)

Effect.runFork(program.pipe(Effect.provide(Logger.pretty)))
```

Output:

```ansi showLineNumbers=false
[11:37:14.265] [32mINFO[0m (#0) myspan=101ms: [1;36mmsg1[0m
  msg2
  [ [32m'msg3'[0m, [32m'msg4'[0m ]
  key2: value2
  key1: value1
```

### structuredLogger

The `structuredLogger` logger produces logs in a detailed object-based format. This format is helpful when you need more traceable logs, especially if other systems analyze them or store them for later review.

```ts twoslash
import { Effect, Logger } from "effect"

const program = Effect.log("msg1", "msg2", ["msg3", "msg4"]).pipe(
  Effect.delay("100 millis"),
  Effect.annotateLogs({ key1: "value1", key2: "value2" }),
  Effect.withLogSpan("myspan")
)

Effect.runFork(program.pipe(Effect.provide(Logger.structured)))
```

Output:

```ansi showLineNumbers=false
{
  message: [ 'msg1', 'msg2', [ 'msg3', 'msg4' ] ],
  logLevel: 'INFO',
  timestamp: '2024-12-28T10:44:31.281Z',
  cause: undefined,
  annotations: { key2: 'value2', key1: 'value1' },
  spans: { myspan: 102 },
  fiberId: '#0'
}
```

| Field         | Description                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `message`     | Either a single processed value or an array of processed values, depending on how many messages are logged.                                                              |
| `logLevel`    | A string that indicates the log level label (for example, "INFO" or "DEBUG").                                                                                            |
| `timestamp`   | An ISO 8601 timestamp for when the log was generated (for example, "2024-01-01T00:00:00.000Z").                                                                          |
| `cause`       | A string that shows detailed error information, or `undefined` if no cause was provided.                                                                                 |
| `annotations` | An object where each key is an annotation label and the corresponding value is parsed into a structured format (for instance, `{"key": "value"}`).                       |
| `spans`       | An object mapping each span label to its duration in milliseconds, measured from its start time until the moment the logger was called (for example, `{"myspan": 102}`). |
| `fiberId`     | The identifier of the fiber that generated this log (for example, "#0").                                                                                                 |

### jsonLogger

The `jsonLogger` logger produces logs in JSON format. This can be useful for tools or services that parse and store JSON logs.
It calls `JSON.stringify` on the object created by the [structuredLogger](#structuredlogger) logger.

```ts twoslash
import { Effect, Logger } from "effect"

const program = Effect.log("msg1", "msg2", ["msg3", "msg4"]).pipe(
  Effect.delay("100 millis"),
  Effect.annotateLogs({ key1: "value1", key2: "value2" }),
  Effect.withLogSpan("myspan")
)

Effect.runFork(program.pipe(Effect.provide(Logger.json)))
```

Output:

```ansi showLineNumbers=false
{"message":["msg1","msg2",["msg3","msg4"]],"logLevel":"INFO","timestamp":"2024-12-28T10:44:31.281Z","annotations":{"key2":"value2","key1":"value1"},"spans":{"myspan":102},"fiberId":"#0"}
```

## Combine Loggers

### zip

The `Logger.zip` function combines two loggers into a new logger. This new logger forwards log messages to both the original loggers.

**Example** (Combining Two Loggers)

```ts
import { Effect, Logger } from "effect"

// Define a custom logger that logs to the console
const logger = Logger.make(({ logLevel, message }) => {
  globalThis.console.log(`[${logLevel.label}] ${message}`)
})

// Combine the default logger and the custom logger
//
//      ┌─── Logger<unknown, [void, void]>
//      ▼
const combined = Logger.zip(Logger.defaultLogger, logger)

const program = Effect.log("something")

Effect.runFork(
  program.pipe(
    // Replace the default logger with the combined logger
    Effect.provide(Logger.replace(Logger.defaultLogger, combined))
  )
)
/*
Output:
timestamp=2025-01-09T13:50:58.655Z level=INFO fiber=#0 message=something
[INFO] something
*/
```
