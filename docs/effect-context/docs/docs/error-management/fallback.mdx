---
title: Fallback
description: Learn techniques to handle failures and implement fallback mechanisms in Effect programs.
sidebar:
  order: 3
---

import { Aside } from "@astrojs/starlight/components"

This page explains various techniques for handling failures and creating fallback mechanisms in the Effect library.

## orElse

`Effect.orElse` allows you to attempt to run an effect, and if it fails, you
can provide a fallback effect to run instead.

This is useful for handling failures gracefully by defining an alternative effect to execute if the first
one encounters an error.

**Example** (Handling Fallback with `Effect.orElse`)

```ts twoslash
import { Effect } from "effect"

const success = Effect.succeed("success")
const failure = Effect.fail("failure")
const fallback = Effect.succeed("fallback")

// Try the success effect first, fallback is not used
const program1 = Effect.orElse(success, () => fallback)
console.log(Effect.runSync(program1))
// Output: "success"

// Try the failure effect first, fallback is used
const program2 = Effect.orElse(failure, () => fallback)
console.log(Effect.runSync(program2))
// Output: "fallback"
```

## orElseFail

`Effect.orElseFail` allows you to replace the failure from one effect with a
custom failure value. If the effect fails, you can provide a new failure to
be returned instead of the original one.

This function only applies to failed effects. If the effect
succeeds, it will remain unaffected.

**Example** (Replacing Failure with `Effect.orElseFail`)

```ts twoslash
import { Effect } from "effect"

const validate = (age: number): Effect.Effect<number, string> => {
  if (age < 0) {
    return Effect.fail("NegativeAgeError")
  } else if (age < 18) {
    return Effect.fail("IllegalAgeError")
  } else {
    return Effect.succeed(age)
  }
}

const program = Effect.orElseFail(validate(-1), () => "invalid age")

console.log(Effect.runSyncExit(program))
/*
Output:
{
  _id: 'Exit',
  _tag: 'Failure',
  cause: { _id: 'Cause', _tag: 'Fail', failure: 'invalid age' }
}
*/
```

## orElseSucceed

`Effect.orElseSucceed` allows you to replace the failure of an effect with a
success value. If the effect fails, it will instead succeed with the provided
value, ensuring the effect always completes successfully.

This is useful when you want to guarantee a successful result regardless of whether the original
effect failed.

The function ensures that any failure is effectively "swallowed" and replaced
by a successful value, which can be helpful for providing default values in
case of failure.

This function only applies to failed effects. If the effect
already succeeds, it will remain unchanged.

**Example** (Replacing Failure with Success using `Effect.orElseSucceed`)

```ts twoslash
import { Effect } from "effect"

const validate = (age: number): Effect.Effect<number, string> => {
  if (age < 0) {
    return Effect.fail("NegativeAgeError")
  } else if (age < 18) {
    return Effect.fail("IllegalAgeError")
  } else {
    return Effect.succeed(age)
  }
}

const program = Effect.orElseSucceed(validate(-1), () => 18)

console.log(Effect.runSyncExit(program))
/*
Output:
{ _id: 'Exit', _tag: 'Success', value: 18 }
*/
```

## firstSuccessOf

`Effect.firstSuccessOf` allows you to try multiple effects in sequence, and
as soon as one of them succeeds, it returns that result. If all effects fail,
it returns the error of the last effect in the list.

This is useful when you
have several potential alternatives and want to use the first one that works.

This function is sequential, meaning that the `Effect` values in the iterable
will be executed in sequence, and the first one that succeeds will determine
the outcome of the resulting `Effect` value.

<Aside type="caution" title="Empty Collection Error">
  If the collection provided to the `Effect.firstSuccessOf` function is
  empty, it will throw an `IllegalArgumentException` error.
</Aside>

**Example** (Finding Configuration with Fallbacks)

In this example, we try to retrieve a configuration from different nodes. If the primary node fails, we fall back to other nodes until we find a successful configuration.

```ts twoslash
import { Effect, Console } from "effect"

interface Config {
  host: string
  port: number
  apiKey: string
}

// Create a configuration object with sample values
const makeConfig = (name: string): Config => ({
  host: `${name}.example.com`,
  port: 8080,
  apiKey: "12345-abcde"
})

// Simulate retrieving configuration from a remote node
const remoteConfig = (name: string): Effect.Effect<Config, Error> =>
  Effect.gen(function* () {
    // Simulate node3 being the only one with available config
    if (name === "node3") {
      yield* Console.log(`Config for ${name} found`)
      return makeConfig(name)
    } else {
      yield* Console.log(`Unavailable config for ${name}`)
      return yield* Effect.fail(new Error(`Config not found for ${name}`))
    }
  })

// Define the master configuration and potential fallback nodes
const masterConfig = remoteConfig("master")
const nodeConfigs = ["node1", "node2", "node3", "node4"].map(remoteConfig)

// Attempt to find a working configuration,
// starting with the master and then falling back to other nodes
const config = Effect.firstSuccessOf([masterConfig, ...nodeConfigs])

// Run the effect to retrieve the configuration
const result = Effect.runSync(config)

console.log(result)
/*
Output:
Unavailable config for master
Unavailable config for node1
Unavailable config for node2
Config for node3 found
{ host: 'node3.example.com', port: 8080, apiKey: '12345-abcde' }
*/
```
