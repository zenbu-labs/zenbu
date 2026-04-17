---
title: Redacted
description: Securely handle sensitive data with the Redacted module, preventing accidental exposure in logs while supporting safe value access and comparison.
sidebar:
  order: 11
---

The Redacted module provides functionality for handling sensitive information securely within your application.
By using the `Redacted` data type, you can ensure that sensitive values are not accidentally exposed in logs or error messages.

## make

The `Redacted.make` function creates a `Redacted<A>` instance from a given value `A`, ensuring the content is securely hidden.

**Example** (Hiding Sensitive Information from Logs)

Using `Redacted.make` helps prevent sensitive information, such as API keys, from being accidentally exposed in logs or error messages.

```ts twoslash
import { Redacted, Effect } from "effect"

// Create a redacted API key
const API_KEY = Redacted.make("1234567890")

console.log(API_KEY)
// Output: {}

console.log(String(API_KEY))
// Output: <redacted>

Effect.runSync(Effect.log(API_KEY))
// Output: timestamp=... level=INFO fiber=#0 message="\"<redacted>\""
```

## value

The `Redacted.value` function retrieves the original value from a `Redacted` instance. Use this function carefully, as it exposes the sensitive data, potentially making it visible in logs or accessible in unintended ways.

**Example** (Accessing the Underlying Sensitive Value)

```ts twoslash
import { Redacted } from "effect"

const API_KEY = Redacted.make("1234567890")

// Expose the redacted value
console.log(Redacted.value(API_KEY))
// Output: "1234567890"
```

## unsafeWipe

The `Redacted.unsafeWipe` function erases the underlying value of a `Redacted` instance, making it inaccessible. This helps ensure that sensitive data does not remain in memory longer than needed.

**Example** (Wiping Sensitive Data from Memory)

```ts twoslash
import { Redacted } from "effect"

const API_KEY = Redacted.make("1234567890")

console.log(Redacted.value(API_KEY))
// Output: "1234567890"

Redacted.unsafeWipe(API_KEY)

console.log(Redacted.value(API_KEY))
/*
throws:
Error: Unable to get redacted value
*/
```

## getEquivalence

The `Redacted.getEquivalence` function generates an [Equivalence](/docs/behaviour/equivalence/) for `Redacted<A>` values using an Equivalence for the underlying values of type `A`. This allows you to compare `Redacted` values securely without revealing their content.

**Example** (Comparing Redacted Values)

```ts twoslash
import { Redacted, Equivalence } from "effect"

const API_KEY1 = Redacted.make("1234567890")
const API_KEY2 = Redacted.make("1-34567890")
const API_KEY3 = Redacted.make("1234567890")

const equivalence = Redacted.getEquivalence(Equivalence.string)

console.log(equivalence(API_KEY1, API_KEY2))
// Output: false

console.log(equivalence(API_KEY1, API_KEY3))
// Output: true
```
