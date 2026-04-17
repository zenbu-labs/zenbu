---
title: Two Types of Errors
description: Learn how Effect differentiates between expected and unexpected errors to enhance error tracking and recovery.
sidebar:
  order: 0
---

Just like any other program, Effect programs may fail for expected or unexpected reasons.
The difference between a non-Effect program and an Effect program is in the detail provided to you when your program fails.
Effect attempts to preserve as much information as possible about what caused your program to fail to produce a detailed,
comprehensive, and human readable failure message.

In an Effect program, there are two possible ways for a program to fail:

- **Expected Errors**: These are errors that developers anticipate and expect as part of normal program execution.

- **Unexpected Errors**: These are errors that occur unexpectedly and are not part of the intended program flow.

## Expected Errors

These errors, also referred to as _failures_, _typed errors_
or _recoverable errors_, are errors that developers anticipate as part of the normal program execution.
They serve a similar purpose to checked exceptions and play a role in defining the program's domain and control flow.

Expected errors **are tracked** at the type level by the `Effect` data type in the "Error" channel:

```ts "HttpError" showLineNumbers=false
const program: Effect<string, HttpError, never>
```

it is evident from the type that the program can fail with an error of type `HttpError`.

## Unexpected Errors

Unexpected errors, also referred to as _defects_, _untyped errors_, or _unrecoverable errors_, are errors that developers
do not anticipate occurring during normal program execution.
Unlike expected errors, which are considered part of a program's domain and control flow,
unexpected errors resemble unchecked exceptions and lie outside the expected behavior of the program.

Since these errors are not expected, Effect **does not track** them at the type level.
However, the Effect runtime does keep track of these errors and provides several methods to aid in recovering from unexpected errors.
