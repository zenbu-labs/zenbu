---
title: Command
description: Learn how to create, run, and manage commands with custom arguments, environment variables, and input/output handling in Effect.
sidebar:
  order: 1
---

The `@effect/platform/Command` module provides a way to create and run commands with the specified process name and an optional list of arguments.

## Creating Commands

The `Command.make` function generates a command object, which includes details such as the process name, arguments, and environment.

**Example** (Defining a Command for Directory Listing)

```ts twoslash
import { Command } from "@effect/platform"

const command = Command.make("ls", "-al")
console.log(command)
/*
{
  _id: '@effect/platform/Command',
  _tag: 'StandardCommand',
  command: 'ls',
  args: [ '-al' ],
  env: {},
  cwd: { _id: 'Option', _tag: 'None' },
  shell: false,
  gid: { _id: 'Option', _tag: 'None' },
  uid: { _id: 'Option', _tag: 'None' }
}
*/
```

This command object does not execute until run by an executor.

## Running Commands

You need a `CommandExecutor` to run the command, which can capture output in various formats such as strings, lines, or streams.

**Example** (Running a Command and Printing Output)

```ts twoslash
import { Command } from "@effect/platform"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

const command = Command.make("ls", "-al")

// The program depends on a CommandExecutor
const program = Effect.gen(function* () {
  // Runs the command returning the output as a string
  const output = yield* Command.string(command)
  console.log(output)
})

// Provide the necessary CommandExecutor
NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)))
```

### Output Formats

You can choose different methods to handle command output:

| Method        | Description                                                                              |
| ------------- | ---------------------------------------------------------------------------------------- |
| `string`      | Runs the command returning the output as a string (with the specified encoding)          |
| `lines`       | Runs the command returning the output as an array of lines (with the specified encoding) |
| `stream`      | Runs the command returning the output as a stream of `Uint8Array` chunks                 |
| `streamLines` | Runs the command returning the output as a stream of lines (with the specified encoding) |

### exitCode

If you only need the exit code of a command, use `Command.exitCode`.

**Example** (Getting the Exit Code)

```ts twoslash
import { Command } from "@effect/platform"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

const command = Command.make("ls", "-al")

const program = Effect.gen(function* () {
  const exitCode = yield* Command.exitCode(command)
  console.log(exitCode)
})

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)))
// Output: 0
```

## Custom Environment Variables

You can customize environment variables in a command by using `Command.env`. This is useful when you need specific variables for the command's execution.

**Example** (Setting Environment Variables)

In this example, the command runs in a shell to ensure environment variables are correctly processed.

```ts twoslash
import { Command } from "@effect/platform"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

const command = Command.make("echo", "-n", "$MY_CUSTOM_VAR").pipe(
  Command.env({
    MY_CUSTOM_VAR: "Hello, this is a custom environment variable!"
  }),
  // Use shell to interpret variables correctly
  // on Windows and Unix-like systems
  Command.runInShell(true)
)

const program = Effect.gen(function* () {
  const output = yield* Command.string(command)
  console.log(output)
})

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)))
// Output: Hello, this is a custom environment variable!
```

## Feeding Input to a Command

You can send input directly to a command's standard input using the `Command.feed` function.

**Example** (Sending Input to a Command's Standard Input)

```ts twoslash
import { Command } from "@effect/platform"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

const command = Command.make("cat").pipe(Command.feed("Hello"))

const program = Effect.gen(function* () {
  console.log(yield* Command.string(command))
})

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)))
// Output: Hello
```

## Fetching Process Details

You can access details about a running process, such as `exitCode`, `stdout`, and `stderr`.

**Example** (Accessing Exit Code and Streams from a Running Process)

```ts twoslash
import { Command } from "@effect/platform"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect, Stream, String, pipe } from "effect"

// Helper function to collect stream output as a string
const runString = <E, R>(
  stream: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<string, E, R> =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(String.empty, String.concat)
  )

const program = Effect.gen(function* () {
  const command = Command.make("ls")

  const [exitCode, stdout, stderr] = yield* pipe(
    // Start running the command and return a handle to the running process
    Command.start(command),
    Effect.flatMap((process) =>
      Effect.all(
        [
          // Waits for the process to exit and returns
          // the ExitCode of the command that was run
          process.exitCode,
          // The standard output stream of the process
          runString(process.stdout),
          // The standard error stream of the process
          runString(process.stderr)
        ],
        { concurrency: 3 }
      )
    )
  )
  console.log({ exitCode, stdout, stderr })
})

NodeRuntime.runMain(
  Effect.scoped(program).pipe(Effect.provide(NodeContext.layer))
)
```

## Streaming stdout to process.stdout

To stream a command's `stdout` directly to `process.stdout`, you can use the following approach:

**Example** (Streaming Command Output Directly to Standard Output)

```ts twoslash
import { Command } from "@effect/platform"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"

// Create a command to run `cat` on a file and inherit stdout
const program = Command.make("cat", "./some-file.txt").pipe(
  Command.stdout("inherit"), // Stream stdout to process.stdout
  Command.exitCode // Get the exit code
)

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)))
```
