---
title: Error Formatters
description: Format and customize error messages during schema decoding and encoding using TreeFormatter or ArrayFormatter.
sidebar:
  order: 10
---

When working with Effect Schema, errors encountered during decoding or encoding operations can be formatted using two built-in methods: `TreeFormatter` and `ArrayFormatter`. These formatters help structure and present errors in a readable and actionable manner.

## TreeFormatter (default)

The `TreeFormatter` is the default method for formatting errors. It organizes errors in a tree structure, providing a clear hierarchy of issues.

**Example** (Decoding with Missing Properties)

```ts twoslash
import { Either, Schema, ParseResult } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

const decode = Schema.decodeUnknownEither(Person)

const result = decode({})
if (Either.isLeft(result)) {
  console.error("Decoding failed:")
  console.error(ParseResult.TreeFormatter.formatErrorSync(result.left))
}
/*
Decoding failed:
{ readonly name: string; readonly age: number }
└─ ["name"]
   └─ is missing
*/
```

In this example:

- `{ readonly name: string; readonly age: number }` describes the schema's expected structure.
- `["name"]` identifies the specific field causing the error.
- `is missing` explains the issue for the `"name"` field.

### Customizing the Output

You can make the error output more concise and meaningful by annotating the schema with annotations like `identifier`, `title`, or `description`. These annotations replace the default TypeScript-like representation in the error messages.

**Example** (Using `title` Annotation for Clarity)

Adding a `title` annotation replaces the schema structure in the error message with the more human-readable "Person" making it easier to understand.

```ts twoslash
import { Either, Schema, ParseResult } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
}).annotations({ title: "Person" }) // Add a title annotation

const result = Schema.decodeUnknownEither(Person)({})
if (Either.isLeft(result)) {
  console.error(ParseResult.TreeFormatter.formatErrorSync(result.left))
}
/*
Person
└─ ["name"]
   └─ is missing
*/
```

### Handling Multiple Errors

By default, decoding functions like `Schema.decodeUnknownEither` report only the first error. To list all errors, use the `{ errors: "all" }` option.

**Example** (Listing All Errors)

```ts twoslash
import { Either, Schema, ParseResult } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

const decode = Schema.decodeUnknownEither(Person, { errors: "all" })

const result = decode({})
if (Either.isLeft(result)) {
  console.error("Decoding failed:")
  console.error(ParseResult.TreeFormatter.formatErrorSync(result.left))
}
/*
Decoding failed:
{ readonly name: string; readonly age: number }
├─ ["name"]
│  └─ is missing
└─ ["age"]
   └─ is missing
*/
```

### ParseIssueTitle Annotation

The `parseIssueTitle` annotation allows you to add dynamic context to error messages by generating titles based on the value being validated. For instance, it can include an ID from the validated object, making it easier to identify specific issues in complex or nested data structures.

**Annotation Type**

```ts
export type ParseIssueTitleAnnotation = (
  issue: ParseIssue
) => string | undefined
```

**Return Value**:

- If the function returns a `string`, the `TreeFormatter` uses it as the title unless a `message` annotation is present (which takes precedence).
- If the function returns `undefined`, the `TreeFormatter` determines the title based on the following priority:
  1. `identifier` annotation
  2. `title` annotation
  3. `description` annotation
  4. Default TypeScript-like schema representation

**Example** (Dynamic Titles Using `parseIssueTitle`)

```ts twoslash
import type { ParseResult } from "effect"
import { Schema } from "effect"

// Function to generate titles for OrderItem issues
const getOrderItemId = ({ actual }: ParseResult.ParseIssue) => {
  if (Schema.is(Schema.Struct({ id: Schema.String }))(actual)) {
    return `OrderItem with id: ${actual.id}`
  }
}

const OrderItem = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  price: Schema.Number
}).annotations({
  identifier: "OrderItem",
  parseIssueTitle: getOrderItemId
})

// Function to generate titles for Order issues
const getOrderId = ({ actual }: ParseResult.ParseIssue) => {
  if (Schema.is(Schema.Struct({ id: Schema.Number }))(actual)) {
    return `Order with id: ${actual.id}`
  }
}

const Order = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  items: Schema.Array(OrderItem)
}).annotations({
  identifier: "Order",
  parseIssueTitle: getOrderId
})

const decode = Schema.decodeUnknownSync(Order, { errors: "all" })

// Case 1: No id available, uses the `identifier` annotation
decode({})
/*
throws
ParseError: Order
├─ ["id"]
│  └─ is missing
├─ ["name"]
│  └─ is missing
└─ ["items"]
   └─ is missing
*/

// Case 2: ID present, uses the dynamic `parseIssueTitle` annotation
decode({ id: 1 })
/*
throws
ParseError: Order with id: 1
├─ ["name"]
│  └─ is missing
└─ ["items"]
   └─ is missing
*/

// Case 3: Nested issues with IDs for both Order and OrderItem
decode({ id: 1, items: [{ id: "22b", price: "100" }] })
/*
throws
ParseError: Order with id: 1
├─ ["name"]
│  └─ is missing
└─ ["items"]
   └─ ReadonlyArray<OrderItem>
      └─ [0]
         └─ OrderItem with id: 22b
            ├─ ["name"]
            │  └─ is missing
            └─ ["price"]
               └─ Expected a number, actual "100"
*/
```

## ArrayFormatter

The `ArrayFormatter` provides a structured, array-based approach to formatting errors. It represents each error as an object, making it easier to analyze and address multiple issues during data decoding or encoding. Each error object includes properties like `_tag`, `path`, and `message` for clarity.

**Example** (Single Error in Array Format)

```ts twoslash
import { Either, Schema, ParseResult } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

const decode = Schema.decodeUnknownEither(Person)

const result = decode({})
if (Either.isLeft(result)) {
  console.error("Decoding failed:")
  console.error(ParseResult.ArrayFormatter.formatErrorSync(result.left))
}
/*
Decoding failed:
[ { _tag: 'Missing', path: [ 'name' ], message: 'is missing' } ]
*/
```

In this example:

- `_tag`: Indicates the type of error (`Missing`).
- `path`: Specifies the location of the error in the data (`['name']`).
- `message`: Describes the issue (`'is missing'`).

### Handling Multiple Errors

By default, decoding functions like `Schema.decodeUnknownEither` report only the first error. To list all errors, use the `{ errors: "all" }` option.

**Example** (Listing All Errors)

```ts twoslash
import { Either, Schema, ParseResult } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

const decode = Schema.decodeUnknownEither(Person, { errors: "all" })

const result = decode({})
if (Either.isLeft(result)) {
  console.error("Decoding failed:")
  console.error(ParseResult.ArrayFormatter.formatErrorSync(result.left))
}
/*
Decoding failed:
[
  { _tag: 'Missing', path: [ 'name' ], message: 'is missing' },
  { _tag: 'Missing', path: [ 'age' ], message: 'is missing' }
]
*/
```

## React Hook Form

If you are working with React and need form validation, `@hookform/resolvers` offers an adapter for `effect/Schema`, which can be integrated with React Hook Form for enhanced form validation processes. This integration allows you to leverage the powerful features of `effect/Schema` within your React applications.

For more detailed instructions and examples on how to integrate `effect/Schema` with React Hook Form using `@hookform/resolvers`, you can visit the official npm package page:
[React Hook Form Resolvers](https://www.npmjs.com/package/@hookform/resolvers#effect-ts)
