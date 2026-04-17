---
title: Scope
description: Learn how Effect simplifies resource management with Scopes, ensuring efficient cleanup and safe resource handling in long-running applications.
sidebar:
  order: 1
---

import { Aside, Tabs, TabItem } from "@astrojs/starlight/components"

The `Scope` data type is a core construct in Effect for managing resources in a safe and composable way.

A scope represents the lifetime of one or more resources. When the scope is closed, all the resources within it are released, ensuring that no resources are leaked. Scopes also allow the addition of **finalizers**, which define how to release resources.

With the `Scope` data type, you can:

- **Add finalizers**: A finalizer specifies the cleanup logic for a resource.
- **Close the scope**: When the scope is closed, all resources are released, and the finalizers are executed.

**Example** (Managing a Scope)

```ts twoslash
import { Scope, Effect, Console, Exit } from "effect"

const program =
  // create a new scope
  Scope.make().pipe(
    // add finalizer 1
    Effect.tap((scope) =>
      Scope.addFinalizer(scope, Console.log("finalizer 1"))
    ),
    // add finalizer 2
    Effect.tap((scope) =>
      Scope.addFinalizer(scope, Console.log("finalizer 2"))
    ),
    // close the scope
    Effect.andThen((scope) =>
      Scope.close(scope, Exit.succeed("scope closed successfully"))
    )
  )

Effect.runPromise(program)
/*
Output:
finalizer 2 <-- finalizers are closed in reverse order
finalizer 1
*/
```

In the above example, finalizers are added to the scope, and when the scope is closed, the finalizers are **executed in the reverse order**.

This reverse order is important because it ensures that resources are released in the correct sequence.

For instance, if you acquire a network connection and then access a file on a remote server, the file must be closed before the network connection to avoid errors.

## addFinalizer

The `Effect.addFinalizer` function is a high-level API that allows you to add finalizers to the scope of an effect. A finalizer is a piece of code that is guaranteed to run when the associated scope is closed. The behavior of the finalizer can vary based on the [Exit](/docs/data-types/exit/) value, which represents how the scope was closed—whether successfully or with an error.

**Example** (Adding a Finalizer on Success)

<Tabs syncKey="pipe-vs-gen">

<TabItem label="Using Effect.gen">

```ts twoslash
import { Effect, Console } from "effect"

//      ┌─── Effect<string, never, Scope>
//      ▼
const program = Effect.gen(function* () {
  yield* Effect.addFinalizer((exit) =>
    Console.log(`Finalizer executed. Exit status: ${exit._tag}`)
  )
  return "some result"
})

// Wrapping the effect in a scope
//
//      ┌─── Effect<string, never, never>
//      ▼
const runnable = Effect.scoped(program)

Effect.runPromiseExit(runnable).then(console.log)
/*
Output:
Finalizer executed. Exit status: Success
{ _id: 'Exit', _tag: 'Success', value: 'some result' }
*/
```

</TabItem>

<TabItem label="Using pipe">

```ts twoslash
import { Effect, Console } from "effect"

//      ┌─── Effect<string, never, Scope>
//      ▼
const program = Effect.addFinalizer((exit) =>
  Console.log(`Finalizer executed. Exit status: ${exit._tag}`)
).pipe(Effect.andThen(Effect.succeed("some result")))

// Wrapping the effect in a scope
//
//      ┌─── Effect<string, never, never>
//      ▼
const runnable = Effect.scoped(program)

Effect.runPromiseExit(runnable).then(console.log)
/*
Output:
Finalizer executed. Exit status: Success
{ _id: 'Exit', _tag: 'Success', value: 'some result' }
*/
```

</TabItem>

</Tabs>

In this example, we use `Effect.addFinalizer` to add a finalizer that logs the exit state after the scope is closed. The finalizer will execute when the effect finishes, and it will log whether the effect completed successfully or failed.

The type signature:

```ts showLineNumbers=false "Scope"
const program: Effect<string, never, Scope>
```

shows that the workflow requires a `Scope` to run. You can provide this `Scope` using the `Effect.scoped` function, which creates a new scope, runs the effect within it, and ensures the finalizers are executed when the scope is closed.

<Aside type="note" title="Finalizer Execution Order">
  Finalizers are executed in reverse order of how they were added,
  ensuring that resources are released in the proper sequence, just like
  in stack unwinding.
</Aside>

**Example** (Adding a Finalizer on Failure)

<Tabs syncKey="pipe-vs-gen">

<TabItem label="Using Effect.gen">

```ts twoslash
import { Effect, Console } from "effect"

//      ┌─── Effect<never, string, Scope>
//      ▼
const program = Effect.gen(function* () {
  yield* Effect.addFinalizer((exit) =>
    Console.log(`Finalizer executed. Exit status: ${exit._tag}`)
  )
  return yield* Effect.fail("Uh oh!")
})

// Wrapping the effect in a scope
//
//      ┌─── Effect<never, string, never>
//      ▼
const runnable = Effect.scoped(program)

Effect.runPromiseExit(runnable).then(console.log)
/*
Output:
Finalizer executed. Exit status: Failure
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'Uh oh!' }
}
*/
```

</TabItem>

<TabItem label="Using pipe">

```ts twoslash
import { Effect, Console } from "effect"

//      ┌─── Effect<never, string, Scope>
//      ▼
const program = Effect.addFinalizer((exit) =>
  Console.log(`Finalizer executed. Exit status: ${exit._tag}`)
).pipe(Effect.andThen(Effect.fail("Uh oh!")))

// Wrapping the effect in a scope
//
//      ┌─── Effect<never, string, never>
//      ▼
const runnable = Effect.scoped(program)

Effect.runPromiseExit(runnable).then(console.log)
/*
Output:
Finalizer executed. Exit status: Failure
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'Uh oh!' }
}
*/
```

</TabItem>

</Tabs>

In this case, the finalizer is executed even when the effect fails. The log output reflects that the finalizer runs after the failure, and it logs the failure details.

**Example** (Adding a Finalizer on [Interruption](/docs/concurrency/basic-concurrency/#interruptions))

<Tabs syncKey="pipe-vs-gen">

<TabItem label="Using Effect.gen">

```ts twoslash
import { Effect, Console } from "effect"

//      ┌─── Effect<never, never, Scope>
//      ▼
const program = Effect.gen(function* () {
  yield* Effect.addFinalizer((exit) =>
    Console.log(`Finalizer executed. Exit status: ${exit._tag}`)
  )
  return yield* Effect.interrupt
})

// Wrapping the effect in a scope
//
//      ┌─── Effect<never, never, never>
//      ▼
const runnable = Effect.scoped(program)

Effect.runPromiseExit(runnable).then(console.log)
/*
Output:
Finalizer executed. Exit status: Failure
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Interrupt',
    fiberId: {
      _id: 'FiberId',
      _tag: 'Runtime',
      id: 0,
      startTimeMillis: ...
    }
  }
}
*/
```

</TabItem>

<TabItem label="Using pipe">

```ts twoslash
import { Effect, Console } from "effect"

//      ┌─── Effect<never, never, Scope>
//      ▼
const program = Effect.addFinalizer((exit) =>
  Console.log(`Finalizer executed. Exit status: ${exit._tag}`)
).pipe(Effect.andThen(Effect.interrupt))

// Wrapping the effect in a scope
//
//      ┌─── Effect<never, never, never>
//      ▼
const runnable = Effect.scoped(program)

Effect.runPromiseExit(runnable).then(console.log)
/*
Output:
Finalizer executed. Exit status: Failure
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: {
    _id: 'Cause',
    _tag: 'Interrupt',
    fiberId: {
      _id: 'FiberId',
      _tag: 'Runtime',
      id: 0,
      startTimeMillis: ...
    }
  }
}
*/
```

</TabItem>

</Tabs>

This example shows how a finalizer behaves when the effect is interrupted. The finalizer runs after the interruption, and the exit status reflects that the effect was stopped mid-execution.

## Manually Create and Close Scopes

When you're working with multiple scoped resources within a single operation, it's important to understand how their scopes interact.
By default, these scopes are merged into one, but you can have more fine-grained control over when each scope is closed by manually creating and closing them.

Let's start by looking at how scopes are merged by default:

**Example** (Merging Scopes)

```ts twoslash
import { Effect, Console } from "effect"

const task1 = Effect.gen(function* () {
  console.log("task 1")
  yield* Effect.addFinalizer(() => Console.log("finalizer after task 1"))
})

const task2 = Effect.gen(function* () {
  console.log("task 2")
  yield* Effect.addFinalizer(() => Console.log("finalizer after task 2"))
})

const program = Effect.gen(function* () {
  // The scopes of both tasks are merged into one
  yield* task1
  yield* task2
})

Effect.runPromise(Effect.scoped(program))
/*
Output:
task 1
task 2
finalizer after task 2
finalizer after task 1
*/
```

In this case, the scopes of `task1` and `task2` are merged into a single scope, and when the program is run, it outputs the tasks and their finalizers in a specific order.

If you want more control over when each scope is closed, you can manually create and close them:

**Example** (Manually Creating and Closing Scopes)

```ts twoslash
import { Console, Effect, Exit, Scope } from "effect"

const task1 = Effect.gen(function* () {
  console.log("task 1")
  yield* Effect.addFinalizer(() => Console.log("finalizer after task 1"))
})

const task2 = Effect.gen(function* () {
  console.log("task 2")
  yield* Effect.addFinalizer(() => Console.log("finalizer after task 2"))
})

const program = Effect.gen(function* () {
  const scope1 = yield* Scope.make()
  const scope2 = yield* Scope.make()

  // Extend the scope of task1 into scope1
  yield* task1.pipe(Scope.extend(scope1))

  // Extend the scope of task2 into scope2
  yield* task2.pipe(Scope.extend(scope2))

  // Manually close scope1 and scope2
  yield* Scope.close(scope1, Exit.void)
  yield* Console.log("doing something else")
  yield* Scope.close(scope2, Exit.void)
})

Effect.runPromise(program)
/*
Output:
task 1
task 2
finalizer after task 1
doing something else
finalizer after task 2
*/
```

In this example, we create two separate scopes, `scope1` and `scope2`, and extend the scope of each task into its respective scope. When you run the program, it outputs the tasks and their finalizers in a different order.

<Aside type="note" title="Extending a Scope">
  The `Scope.extend` function allows you to extend the scope of an effect
  workflow that requires a scope into another scope without closing the
  scope when the workflow finishes executing. This allows you to extend a
  scoped value into a larger scope.
</Aside>

You might wonder what happens when a scope is closed, but a task within that scope hasn't completed yet.
The key point to note is that the scope closing doesn't force the task to be interrupted.

**Example** (Closing a Scope with Pending Tasks)

```ts twoslash
import { Console, Effect, Exit, Scope } from "effect"

const task = Effect.gen(function* () {
  yield* Effect.sleep("1 second")
  console.log("Executed")
  yield* Effect.addFinalizer(() => Console.log("Task Finalizer"))
})

const program = Effect.gen(function* () {
  const scope = yield* Scope.make()

  // Close the scope immediately
  yield* Scope.close(scope, Exit.void)
  console.log("Scope closed")

  // This task will be executed even if the scope is closed
  yield* task.pipe(Scope.extend(scope))
})

Effect.runPromise(program)
/*
Output:
Scope closed
Executed <-- after 1 second
Task Finalizer
*/
```

## Defining Resources

### acquireRelease

The `Effect.acquireRelease(acquire, release)` function allows you to define resources that are acquired and safely released when they are no longer needed. This is useful for managing resources such as file handles, database connections, or network sockets.

To use `Effect.acquireRelease`, you need to define two actions:

1. **Acquiring the Resource**: An effect describing the acquisition of the resource, e.g., opening a file or establishing a database connection.
2. **Releasing the Resource**: The clean-up effect that ensures the resource is properly released, e.g., closing the file or the connection.

The acquisition process is **uninterruptible** to ensure that partial resource acquisition doesn't leave your system in an inconsistent state.

The `Effect.acquireRelease` function guarantees that once a resource is successfully acquired, its release step is always executed when the `Scope` is closed.

**Example** (Defining a Simple Resource)

```ts twoslash
import { Effect } from "effect"

// Define an interface for a resource
interface MyResource {
  readonly contents: string
  readonly close: () => Promise<void>
}

// Simulate resource acquisition
const getMyResource = (): Promise<MyResource> =>
  Promise.resolve({
    contents: "lorem ipsum",
    close: () =>
      new Promise((resolve) => {
        console.log("Resource released")
        resolve()
      })
  })

// Define how the resource is acquired
const acquire = Effect.tryPromise({
  try: () =>
    getMyResource().then((res) => {
      console.log("Resource acquired")
      return res
    }),
  catch: () => new Error("getMyResourceError")
})

// Define how the resource is released
const release = (res: MyResource) => Effect.promise(() => res.close())

// Create the resource management workflow
//
//      ┌─── Effect<MyResource, Error, Scope>
//      ▼
const resource = Effect.acquireRelease(acquire, release)
```

In the code above, the `Effect.acquireRelease` function creates a resource workflow that requires a `Scope`:

```ts showLineNumbers=false "Scope"
const resource: Effect<MyResource, Error, Scope>
```

This means that the workflow needs a `Scope` to run, and the resource will automatically be released when the scope is closed.

You can now use the resource by chaining operations using `Effect.andThen` or similar functions.

We can continue working with the resource for as long as we want by using `Effect.andThen` or other Effect operators. For example, here's how we can read the contents:

**Example** (Using the Resource)

```ts twoslash collapse={3-34}
import { Effect } from "effect"

// Define an interface for a resource
interface MyResource {
  readonly contents: string
  readonly close: () => Promise<void>
}

// Simulate resource acquisition
const getMyResource = (): Promise<MyResource> =>
  Promise.resolve({
    contents: "lorem ipsum",
    close: () =>
      new Promise((resolve) => {
        console.log("Resource released")
        resolve()
      })
  })

// Define how the resource is acquired
const acquire = Effect.tryPromise({
  try: () =>
    getMyResource().then((res) => {
      console.log("Resource acquired")
      return res
    }),
  catch: () => new Error("getMyResourceError")
})

// Define how the resource is released
const release = (res: MyResource) => Effect.promise(() => res.close())

// Create the resource management workflow
const resource = Effect.acquireRelease(acquire, release)

//      ┌─── Effect<void, Error, Scope>
//      ▼
const program = Effect.gen(function* () {
  const res = yield* resource
  console.log(`content is ${res.contents}`)
})
```

To ensure proper resource management, the `Scope` should be closed when you're done with the resource. The `Effect.scoped` function handles this for you by creating a `Scope`, running the effect, and then closing the `Scope` when the effect finishes.

**Example** (Providing the `Scope` with `Effect.scoped`)

```ts twoslash collapse={3-34}
import { Effect } from "effect"

// Define an interface for a resource
interface MyResource {
  readonly contents: string
  readonly close: () => Promise<void>
}

// Simulate resource acquisition
const getMyResource = (): Promise<MyResource> =>
  Promise.resolve({
    contents: "lorem ipsum",
    close: () =>
      new Promise((resolve) => {
        console.log("Resource released")
        resolve()
      })
  })

// Define how the resource is acquired
const acquire = Effect.tryPromise({
  try: () =>
    getMyResource().then((res) => {
      console.log("Resource acquired")
      return res
    }),
  catch: () => new Error("getMyResourceError")
})

// Define how the resource is released
const release = (res: MyResource) => Effect.promise(() => res.close())

// Create the resource management workflow
const resource = Effect.acquireRelease(acquire, release)

//      ┌─── Effect<void, Error, never>
//      ▼
const program = Effect.scoped(
  Effect.gen(function* () {
    const res = yield* resource
    console.log(`content is ${res.contents}`)
  })
)

// We now have a workflow that is ready to run
Effect.runPromise(program)
/*
Resource acquired
content is lorem ipsum
Resource released
*/
```

### Example Pattern: Sequencing Operations

In certain scenarios, you might need to perform a sequence of chained operations where the success of each operation depends on the previous one. However, if any of the operations fail, you would want to reverse the effects of all previous successful operations. This pattern is valuable when you need to ensure that either all operations succeed, or none of them have any effect at all.

Let's go through an example of implementing this pattern. Suppose we want to create a "Workspace" in our application, which involves creating an S3 bucket, an ElasticSearch index, and a Database entry that relies on the previous two.

To begin, we define the domain model for the required [services](/docs/requirements-management/services/):

- `S3`
- `ElasticSearch`
- `Database`

```ts twoslash
import { Effect, Context, Data } from "effect"

class S3Error extends Data.TaggedError("S3Error")<{}> {}

interface Bucket {
  readonly name: string
}

class S3 extends Context.Tag("S3")<
  S3,
  {
    readonly createBucket: Effect.Effect<Bucket, S3Error>
    readonly deleteBucket: (bucket: Bucket) => Effect.Effect<void>
  }
>() {}

class ElasticSearchError extends Data.TaggedError(
  "ElasticSearchError"
)<{}> {}

interface Index {
  readonly id: string
}

class ElasticSearch extends Context.Tag("ElasticSearch")<
  ElasticSearch,
  {
    readonly createIndex: Effect.Effect<Index, ElasticSearchError>
    readonly deleteIndex: (index: Index) => Effect.Effect<void>
  }
>() {}

class DatabaseError extends Data.TaggedError("DatabaseError")<{}> {}

interface Entry {
  readonly id: string
}

class Database extends Context.Tag("Database")<
  Database,
  {
    readonly createEntry: (
      bucket: Bucket,
      index: Index
    ) => Effect.Effect<Entry, DatabaseError>
    readonly deleteEntry: (entry: Entry) => Effect.Effect<void>
  }
>() {}
```

Next, we define the three create actions and the overall transaction (`make`) for the workspace.

```ts twoslash collapse={3-48}
import { Effect, Context, Exit, Data } from "effect"

class S3Error extends Data.TaggedError("S3Error")<{}> {}

interface Bucket {
  readonly name: string
}

class S3 extends Context.Tag("S3")<
  S3,
  {
    readonly createBucket: Effect.Effect<Bucket, S3Error>
    readonly deleteBucket: (bucket: Bucket) => Effect.Effect<void>
  }
>() {}

class ElasticSearchError extends Data.TaggedError(
  "ElasticSearchError"
)<{}> {}

interface Index {
  readonly id: string
}

class ElasticSearch extends Context.Tag("ElasticSearch")<
  ElasticSearch,
  {
    readonly createIndex: Effect.Effect<Index, ElasticSearchError>
    readonly deleteIndex: (index: Index) => Effect.Effect<void>
  }
>() {}

class DatabaseError extends Data.TaggedError("DatabaseError")<{}> {}

interface Entry {
  readonly id: string
}

class Database extends Context.Tag("Database")<
  Database,
  {
    readonly createEntry: (
      bucket: Bucket,
      index: Index
    ) => Effect.Effect<Entry, DatabaseError>
    readonly deleteEntry: (entry: Entry) => Effect.Effect<void>
  }
>() {}

// Create a bucket, and define the release function that deletes the
// bucket if the operation fails.
const createBucket = Effect.gen(function* () {
  const { createBucket, deleteBucket } = yield* S3
  return yield* Effect.acquireRelease(createBucket, (bucket, exit) =>
    // The release function for the Effect.acquireRelease operation is
    // responsible for handling the acquired resource (bucket) after the
    // main effect has completed. It is called regardless of whether the
    // main effect succeeded or failed. If the main effect failed,
    // Exit.isFailure(exit) will be true, and the function will perform
    // a rollback by calling deleteBucket(bucket). If the main effect
    // succeeded, Exit.isFailure(exit) will be false, and the function
    // will return Effect.void, representing a successful, but
    // do-nothing effect.
    Exit.isFailure(exit) ? deleteBucket(bucket) : Effect.void
  )
})

// Create an index, and define the release function that deletes the
// index if the operation fails.
const createIndex = Effect.gen(function* () {
  const { createIndex, deleteIndex } = yield* ElasticSearch
  return yield* Effect.acquireRelease(createIndex, (index, exit) =>
    Exit.isFailure(exit) ? deleteIndex(index) : Effect.void
  )
})

// Create an entry in the database, and define the release function that
// deletes the entry if the operation fails.
const createEntry = (bucket: Bucket, index: Index) =>
  Effect.gen(function* () {
    const { createEntry, deleteEntry } = yield* Database
    return yield* Effect.acquireRelease(
      createEntry(bucket, index),
      (entry, exit) =>
        Exit.isFailure(exit) ? deleteEntry(entry) : Effect.void
    )
  })

const make = Effect.scoped(
  Effect.gen(function* () {
    const bucket = yield* createBucket
    const index = yield* createIndex
    return yield* createEntry(bucket, index)
  })
)
```

We then create simple service implementations to test the behavior of our Workspace code.
To achieve this, we will utilize [layers](/docs/requirements-management/layers/) to construct test
These layers will be able to handle various scenarios, including errors, which we can control using the `FailureCase` type.

```ts twoslash collapse={3-95}
import { Effect, Context, Exit, Data, Layer, Console } from "effect"

class S3Error extends Data.TaggedError("S3Error")<{}> {}

interface Bucket {
  readonly name: string
}

class S3 extends Context.Tag("S3")<
  S3,
  {
    readonly createBucket: Effect.Effect<Bucket, S3Error>
    readonly deleteBucket: (bucket: Bucket) => Effect.Effect<void>
  }
>() {}

class ElasticSearchError extends Data.TaggedError(
  "ElasticSearchError"
)<{}> {}

interface Index {
  readonly id: string
}

class ElasticSearch extends Context.Tag("ElasticSearch")<
  ElasticSearch,
  {
    readonly createIndex: Effect.Effect<Index, ElasticSearchError>
    readonly deleteIndex: (index: Index) => Effect.Effect<void>
  }
>() {}

class DatabaseError extends Data.TaggedError("DatabaseError")<{}> {}

interface Entry {
  readonly id: string
}

class Database extends Context.Tag("Database")<
  Database,
  {
    readonly createEntry: (
      bucket: Bucket,
      index: Index
    ) => Effect.Effect<Entry, DatabaseError>
    readonly deleteEntry: (entry: Entry) => Effect.Effect<void>
  }
>() {}

// Create a bucket, and define the release function that deletes the
// bucket if the operation fails.
const createBucket = Effect.gen(function* () {
  const { createBucket, deleteBucket } = yield* S3
  return yield* Effect.acquireRelease(createBucket, (bucket, exit) =>
    // The release function for the Effect.acquireRelease operation is
    // responsible for handling the acquired resource (bucket) after the
    // main effect has completed. It is called regardless of whether the
    // main effect succeeded or failed. If the main effect failed,
    // Exit.isFailure(exit) will be true, and the function will perform
    // a rollback by calling deleteBucket(bucket). If the main effect
    // succeeded, Exit.isFailure(exit) will be false, and the function
    // will return Effect.void, representing a successful, but
    // do-nothing effect.
    Exit.isFailure(exit) ? deleteBucket(bucket) : Effect.void
  )
})

// Create an index, and define the release function that deletes the
// index if the operation fails.
const createIndex = Effect.gen(function* () {
  const { createIndex, deleteIndex } = yield* ElasticSearch
  return yield* Effect.acquireRelease(createIndex, (index, exit) =>
    Exit.isFailure(exit) ? deleteIndex(index) : Effect.void
  )
})

// Create an entry in the database, and define the release function that
// deletes the entry if the operation fails.
const createEntry = (bucket: Bucket, index: Index) =>
  Effect.gen(function* () {
    const { createEntry, deleteEntry } = yield* Database
    return yield* Effect.acquireRelease(
      createEntry(bucket, index),
      (entry, exit) =>
        Exit.isFailure(exit) ? deleteEntry(entry) : Effect.void
    )
  })

const make = Effect.scoped(
  Effect.gen(function* () {
    const bucket = yield* createBucket
    const index = yield* createIndex
    return yield* createEntry(bucket, index)
  })
)

// The `FailureCaseLiterals` type allows us to provide different error
// scenarios while testing our
//
// For example, by providing the value "S3", we can simulate an error
// scenario specific to the S3 service. This helps us ensure that our
// program handles errors correctly and behaves as expected in various
// situations.
//
// Similarly, we can provide other values like "ElasticSearch" or
// "Database" to simulate error scenarios for those  In cases
// where we want to test the absence of errors, we can provide
// `undefined`. By using this parameter, we can thoroughly test our
// services and verify their behavior under different error conditions.
type FailureCaseLiterals = "S3" | "ElasticSearch" | "Database" | undefined

class FailureCase extends Context.Tag("FailureCase")<
  FailureCase,
  FailureCaseLiterals
>() {}

// Create a test layer for the S3 service

const S3Test = Layer.effect(
  S3,
  Effect.gen(function* () {
    const failureCase = yield* FailureCase
    return {
      createBucket: Effect.gen(function* () {
        console.log("[S3] creating bucket")
        if (failureCase === "S3") {
          return yield* Effect.fail(new S3Error())
        } else {
          return { name: "<bucket.name>" }
        }
      }),
      deleteBucket: (bucket) =>
        Console.log(`[S3] delete bucket ${bucket.name}`)
    }
  })
)

// Create a test layer for the ElasticSearch service

const ElasticSearchTest = Layer.effect(
  ElasticSearch,
  Effect.gen(function* () {
    const failureCase = yield* FailureCase
    return {
      createIndex: Effect.gen(function* () {
        console.log("[ElasticSearch] creating index")
        if (failureCase === "ElasticSearch") {
          return yield* Effect.fail(new ElasticSearchError())
        } else {
          return { id: "<index.id>" }
        }
      }),
      deleteIndex: (index) =>
        Console.log(`[ElasticSearch] delete index ${index.id}`)
    }
  })
)

// Create a test layer for the Database service

const DatabaseTest = Layer.effect(
  Database,
  Effect.gen(function* () {
    const failureCase = yield* FailureCase
    return {
      createEntry: (bucket, index) =>
        Effect.gen(function* () {
          console.log(
            "[Database] creating entry for bucket" +
              `${bucket.name} and index ${index.id}`
          )
          if (failureCase === "Database") {
            return yield* Effect.fail(new DatabaseError())
          } else {
            return { id: "<entry.id>" }
          }
        }),
      deleteEntry: (entry) =>
        Console.log(`[Database] delete entry ${entry.id}`)
    }
  })
)

// Merge all the test layers for S3, ElasticSearch, and Database
// services into a single layer
const layer = Layer.mergeAll(S3Test, ElasticSearchTest, DatabaseTest)

// Create a runnable effect to test the Workspace code. The effect is
// provided with the test layer and a FailureCase service with undefined
// value (no failure case).
const runnable = make.pipe(
  Effect.provide(layer),
  Effect.provideService(FailureCase, undefined)
)

Effect.runPromise(Effect.either(runnable)).then(console.log)
```

Let's examine the test results for the scenario where `FailureCase` is set to `undefined` (happy path):

```ansi showLineNumbers=false
[S3] creating bucket
[ElasticSearch] creating index
[Database] creating entry for bucket <bucket.name> and index <index.id>
{ _id: 'Either', _tag: 'Right', right: { id: '<entry.id>' } }
```

In this case, all operations succeed, and we see a successful result with `right({ id: '<entry.id>' })`.

Now, let's simulate a failure in the `Database`:

```ts showLineNumbers=false
const runnable = make.pipe(
  Effect.provide(layer),
  Effect.provideService(FailureCase, "Database")
)
```

The console output will be:

```ansi showLineNumbers=false
[S3] creating bucket
[ElasticSearch] creating index
[Database] creating entry for bucket <bucket.name> and index <index.id>
[ElasticSearch] delete index <index.id>
[S3] delete bucket <bucket.name>
{ _id: 'Either', _tag: 'Left', left: { _tag: 'DatabaseError' } }
```

You can observe that once the `Database` error occurs, there is a complete rollback that deletes the `ElasticSearch` index first and then the associated `S3` bucket. The result is a failure with `left(new DatabaseError())`.

Let's now make the index creation fail instead:

```ts showLineNumbers=false
const runnable = make.pipe(
  Effect.provide(layer),
  Effect.provideService(FailureCase, "ElasticSearch")
)
```

In this case, the console output will be:

```ansi showLineNumbers=false
[S3] creating bucket
[ElasticSearch] creating index
[S3] delete bucket <bucket.name>
{ _id: 'Either', _tag: 'Left', left: { _tag: 'ElasticSearchError' } }
```

As expected, once the `ElasticSearch` index creation fails, there is a rollback that deletes the `S3` bucket. The result is a failure with `left(new ElasticSearchError())`.
