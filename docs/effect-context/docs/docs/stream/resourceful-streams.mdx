---
title: Resourceful Streams
description: Learn how to manage resources in streams with safe acquisition and release, finalization for cleanup tasks, and ensuring post-finalization actions for robust resource handling in streaming applications.
sidebar:
  order: 5
---

In the Stream module, you'll find that most of the constructors offer a special variant designed for lifting a scoped resource into a `Stream`. When you use these specific constructors, you're essentially creating streams that are inherently safe with regards to resource management. These constructors, before creating the stream, handle the resource acquisition, and after the stream's usage, they ensure its proper closure.

Stream also provides us with `Stream.acquireRelease` and `Stream.finalizer` constructors that share similarities with `Effect.acquireRelease` and `Effect.addFinalizer`. These tools empower us to perform cleanup or finalization tasks before the stream concludes its operation.

## Acquire Release

In this section, we'll explore an example that demonstrates the use of `Stream.acquireRelease` when working with file operations.

```ts twoslash
import { Stream, Console, Effect } from "effect"

// Simulating File operations
const open = (filename: string) =>
  Effect.gen(function* () {
    yield* Console.log(`Opening ${filename}`)
    return {
      getLines: Effect.succeed(["Line 1", "Line 2", "Line 3"]),
      close: Console.log(`Closing ${filename}`)
    }
  })

const stream = Stream.acquireRelease(
  open("file.txt"),
  (file) => file.close
).pipe(Stream.flatMap((file) => file.getLines))

Effect.runPromise(Stream.runCollect(stream)).then(console.log)
/*
Output:
Opening file.txt
Closing file.txt
{
  _id: "Chunk",
  values: [
    [ "Line 1", "Line 2", "Line 3" ]
  ]
}
*/
```

In this code snippet, we're simulating file operations using the `open` function. The `Stream.acquireRelease` function is employed to ensure that the file is correctly opened and closed, and we then process the lines of the file using the acquired resource.

## Finalization

In this section, we'll explore the concept of finalization in streams. Finalization allows us to execute a specific action before a stream ends. This can be particularly useful when we want to perform cleanup tasks or add final touches to a stream.

Imagine a scenario where our streaming application needs to clean up a temporary directory when it completes its execution. We can achieve this using the `Stream.finalizer` function:

```ts twoslash
import { Stream, Console, Effect } from "effect"

const application = Stream.fromEffect(Console.log("Application Logic."))

const deleteDir = (dir: string) => Console.log(`Deleting dir: ${dir}`)

const program = application.pipe(
  Stream.concat(
    Stream.finalizer(
      deleteDir("tmp").pipe(
        Effect.andThen(Console.log("Temporary directory was deleted."))
      )
    )
  )
)

Effect.runPromise(Stream.runCollect(program)).then(console.log)
/*
Output:
Application Logic.
Deleting dir: tmp
Temporary directory was deleted.
{
  _id: "Chunk",
  values: [ undefined, undefined ]
}
*/
```

In this code example, we start with our application logic represented by the `application` stream. We then use `Stream.finalizer` to define a finalization step, which deletes a temporary directory and logs a message. This ensures that the temporary directory is cleaned up properly when the application completes its execution.

## Ensuring

In this section, we'll explore a scenario where we need to perform actions after the finalization of a stream. To achieve this, we can utilize the `Stream.ensuring` operator.

Consider a situation where our application has completed its primary logic and finalized some resources, but we also need to perform additional actions afterward. We can use `Stream.ensuring` for this purpose:

```ts twoslash
import { Stream, Console, Effect } from "effect"

const program = Stream.fromEffect(Console.log("Application Logic.")).pipe(
  Stream.concat(Stream.finalizer(Console.log("Finalizing the stream"))),
  Stream.ensuring(
    Console.log("Doing some other works after stream's finalization")
  )
)

Effect.runPromise(Stream.runCollect(program)).then(console.log)
/*
Output:
Application Logic.
Finalizing the stream
Doing some other works after stream's finalization
{
  _id: "Chunk",
  values: [ undefined, undefined ]
}
*/
```

In this code example, we start with our application logic represented by the `Application Logic.` message. We then use `Stream.finalizer` to specify the finalization step, which logs `Finalizing the stream`. After that, we use `Stream.ensuring` to indicate that we want to perform additional tasks after the stream's finalization, resulting in the message `Performing additional tasks after stream's finalization`. This ensures that our post-finalization actions are executed as expected.
