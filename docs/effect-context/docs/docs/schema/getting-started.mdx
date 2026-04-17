---
title: Getting Started
description: Learn how to define schemas, extract types, and handle decoding and encoding.
sidebar:
  order: 2
---

import { Aside } from "@astrojs/starlight/components"

You can import the necessary types and functions from the `effect/Schema` module:

**Example** (Namespace Import)

```ts showLineNumbers=false
import * as Schema from "effect/Schema"
```

**Example** (Named Import)

```ts showLineNumbers=false
import { Schema } from "effect"
```

## Defining a schema

One common way to define a `Schema` is by utilizing the `Struct` constructor.
This constructor allows you to create a new schema that outlines an object with specific properties.
Each property in the object is defined by its own schema, which specifies the data type and any validation rules.

**Example** (Defining a Simple Object Schema)

This `Person` schema describes an object with a `name` (string) and `age` (number) property:

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})
```

## Extracting Inferred Types

### Type

Once you've defined a schema (`Schema<Type, Encoded, Context>`), you can extract the inferred type `Type` in two ways:

1. Using the `Schema.Type` utility
2. Accessing the `Type` field directly on your schema

**Example** (Extracting Inferred Type)

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

// 1. Using the Schema.Type utility
type Person = Schema.Schema.Type<typeof Person>

// 2. Accessing the Type field directly
type Person2 = typeof Person.Type
```

The resulting type will look like this:

```ts showLineNumbers=false
type Person = {
  readonly name: string
  readonly age: number
}
```

Alternatively, you can extract the `Person` type using the `interface` keyword, which may improve readability and performance in some cases.

**Example** (Extracting Type with an Interface)

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

interface Person extends Schema.Schema.Type<typeof Person> {}
```

Both approaches yield the same result, but using an interface provides benefits such as performance advantages and improved readability.

### Encoded

In a `Schema<Type, Encoded, Context>`, the `Encoded` type can differ from the `Type` type, representing the format in which data is encoded. You can extract the `Encoded` type in two ways:

1. Using the `Schema.Encoded` utility
2. Accessing the `Encoded` field directly on the schema

**Example** (Extracting the Encoded Type)

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  // a schema that decodes a string to a number
  age: Schema.NumberFromString
})

// 1. Using the Schema.Encoded utility
type PersonEncoded = Schema.Schema.Encoded<typeof Person>

// 2. Accessing the Encoded field directly
type PersonEncoded2 = typeof Person.Encoded
```

The resulting type is:

```ts showLineNumbers=false
type PersonEncoded = {
  readonly name: string
  readonly age: string
}
```

Note that `age` is of type `string` in the `Encoded` type of the schema and is of type `number` in the `Type` type of the schema.

Alternatively, you can define the `PersonEncoded` type using the `interface` keyword, which can enhance readability and performance.

**Example** (Extracting Encoded Type with an Interface)

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  // a schema that decodes a string to a number
  age: Schema.NumberFromString
})

interface PersonEncoded extends Schema.Schema.Encoded<typeof Person> {}
```

Both approaches yield the same result, but using an interface provides benefits such as performance advantages and improved readability.

### Context

In a `Schema<Type, Encoded, Context>`, the `Context` type represents any external data or dependencies that the schema requires to perform encoding or decoding. You can extract the inferred `Context` type in two ways:

1. Using the `Schema.Context` utility.
2. Accessing the `Context` field on the schema.

**Example** (Extracting the Context Type)

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

// 1. Using the Schema.Context utility
type PersonContext = Schema.Schema.Context<typeof Person>

// 2. Accessing the Context field directly
type PersonContext2 = typeof Person.Context
```

### Schemas with Opaque Types

When defining a schema, you may want to create a schema with an opaque type. This is useful when you want to hide the internal structure of the schema and only expose the type of the schema.

**Example** (Creating an Opaque Schema)

To create a schema with an opaque type, you can use the following technique that re-declares the schema:

```ts twoslash
import { Schema } from "effect"

// Define the schema structure
const _Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

// Declare the type interface to make it opaque
interface Person extends Schema.Schema.Type<typeof _Person> {}

// Re-declare the schema as opaque
const Person: Schema.Schema<Person> = _Person
```

Alternatively, you can use the Class APIs (see the [Class APIs](/docs/schema/classes/) section for more details).

Note that the technique shown above becomes more complex when the schema is defined such that `Type` is different from `Encoded`.

**Example** (Opaque Schema with Different Type and Encoded)

```ts twoslash "NumberFromString"
import { Schema } from "effect"

// Define the schema structure, with a field that
// decodes a string to a number
const _Person = Schema.Struct({
  name: Schema.String,
  age: Schema.NumberFromString
})

// Create the `Type` interface for an opaque schema
interface Person extends Schema.Schema.Type<typeof _Person> {}

// Create the `Encoded` interface for an opaque schema
interface PersonEncoded extends Schema.Schema.Encoded<typeof _Person> {}

// Re-declare the schema with opaque Type and Encoded
const Person: Schema.Schema<Person, PersonEncoded> = _Person
```

In this case, the field `"age"` is of type `string` in the `Encoded` type of the schema and is of type `number` in the `Type` type of the schema. Therefore, we need to define **two** interfaces (`PersonEncoded` and `Person`) and use both to redeclare our final schema `Person`.

## Readonly Types by Default

It's important to note that by default, most constructors exported by
`effect/Schema` return `readonly` types.

**Example** (Readonly Types in a Schema)

For instance, in the `Person` schema below:

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})
```

the resulting inferred `Type` would be:

```ts showLineNumbers=false "readonly"
{
  readonly name: string;
  readonly age: number;
}
```

## Decoding

When working with unknown data types in TypeScript, decoding them into a known structure can be challenging. Luckily, `effect/Schema` provides several functions to help with this process. Let's explore how to decode unknown values using these functions.

| API                    | Description                                                                      |
| ---------------------- | -------------------------------------------------------------------------------- |
| `decodeUnknownSync`    | Synchronously decodes a value and throws an error if parsing fails.              |
| `decodeUnknownOption`  | Decodes a value and returns an [Option](/docs/data-types/option/) type.          |
| `decodeUnknownEither`  | Decodes a value and returns an [Either](/docs/data-types/either/) type.          |
| `decodeUnknownPromise` | Decodes a value and returns a `Promise`.                                         |
| `decodeUnknown`        | Decodes a value and returns an [Effect](/docs/getting-started/the-effect-type/). |

### decodeUnknownSync

The `Schema.decodeUnknownSync` function is useful when you want to parse a value and immediately throw an error if the parsing fails.

**Example** (Using `decodeUnknownSync` for Immediate Decoding)

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

// Simulate an unknown input
const input: unknown = { name: "Alice", age: 30 }

// Example of valid input matching the schema
console.log(Schema.decodeUnknownSync(Person)(input))
// Output: { name: 'Alice', age: 30 }

// Example of invalid input that does not match the schema
console.log(Schema.decodeUnknownSync(Person)(null))
/*
throws:
ParseError: Expected { readonly name: string; readonly age: number }, actual null
*/
```

### decodeUnknownEither

The `Schema.decodeUnknownEither` function allows you to parse a value and receive the result as an [Either](/docs/data-types/either/), representing success (`Right`) or failure (`Left`). This approach lets you handle parsing errors more gracefully without throwing exceptions.

**Example** (Using `Schema.decodeUnknownEither` for Error Handling)

```ts twoslash
import { Schema } from "effect"
import { Either } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

const decode = Schema.decodeUnknownEither(Person)

// Simulate an unknown input
const input: unknown = { name: "Alice", age: 30 }

// Attempt decoding a valid input
const result1 = decode(input)
if (Either.isRight(result1)) {
  console.log(result1.right)
  /*
  Output:
  { name: "Alice", age: 30 }
  */
}

// Simulate decoding an invalid input
const result2 = decode(null)
if (Either.isLeft(result2)) {
  console.log(result2.left)
  /*
  Output:
  {
    _id: 'ParseError',
    message: 'Expected { readonly name: string; readonly age: number }, actual null'
  }
  */
}
```

### decodeUnknown

If your schema involves asynchronous transformations, the `Schema.decodeUnknownSync` and `Schema.decodeUnknownEither` functions will not be suitable.
In such cases, you should use the `Schema.decodeUnknown` function, which returns an [Effect](/docs/getting-started/the-effect-type/).

**Example** (Handling Asynchronous Decoding)

```ts twoslash
import { Schema } from "effect"
import { Effect } from "effect"

const PersonId = Schema.Number

const Person = Schema.Struct({
  id: PersonId,
  name: Schema.String,
  age: Schema.Number
})

const asyncSchema = Schema.transformOrFail(PersonId, Person, {
  strict: true,
  // Decode with simulated async transformation
  decode: (id) =>
    Effect.succeed({ id, name: "name", age: 18 }).pipe(
      Effect.delay("10 millis")
    ),
  encode: (person) =>
    Effect.succeed(person.id).pipe(Effect.delay("10 millis"))
})

// Attempting to use a synchronous decoder on an async schema
console.log(Schema.decodeUnknownEither(asyncSchema)(1))
/*
Output:
{
  _id: 'Either',
  _tag: 'Left',
  left: {
    _id: 'ParseError',
    message: '(number <-> { readonly id: number; readonly name: string; readonly age: number })\n' +
      '└─ cannot be be resolved synchronously, this is caused by using runSync on an effect that performs async work'
  }
}
*/

// Decoding asynchronously with `Schema.decodeUnknown`
Effect.runPromise(Schema.decodeUnknown(asyncSchema)(1)).then(console.log)
/*
Output:
{ id: 1, name: 'name', age: 18 }
*/
```

In the code above, the first approach using `Schema.decodeUnknownEither` results in an error indicating that the transformation cannot be resolved synchronously.
This occurs because `Schema.decodeUnknownEither` is not designed for async operations.
The second approach, which uses `Schema.decodeUnknown`, works correctly, allowing you to handle asynchronous transformations and return the expected result.

## Encoding

The `Schema` module provides several `encode*` functions to encode data according to a schema:

| API             | Description                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `encodeSync`    | Synchronously encodes data and throws an error if encoding fails.                                    |
| `encodeOption`  | Encodes data and returns an [Option](/docs/data-types/option/) type.                                 |
| `encodeEither`  | Encodes data and returns an [Either](/docs/data-types/either/) type representing success or failure. |
| `encodePromise` | Encodes data and returns a `Promise`.                                                                |
| `encode`        | Encodes data and returns an [Effect](/docs/getting-started/the-effect-type/).                        |

**Example** (Using `Schema.encodeSync` for Immediate Encoding)

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  // Ensure name is a non-empty string
  name: Schema.NonEmptyString,
  // Allow age to be decoded from a string and encoded to a string
  age: Schema.NumberFromString
})

// Valid input: encoding succeeds and returns expected types
console.log(Schema.encodeSync(Person)({ name: "Alice", age: 30 }))
// Output: { name: 'Alice', age: '30' }

// Invalid input: encoding fails due to empty name string
console.log(Schema.encodeSync(Person)({ name: "", age: 30 }))
/*
throws:
ParseError: { readonly name: NonEmptyString; readonly age: NumberFromString }
└─ ["name"]
   └─ NonEmptyString
      └─ Predicate refinement failure
         └─ Expected a non empty string, actual ""
*/
```

Note that during encoding, the number value `30` was converted to a string `"30"`.

### Handling Unsupported Encoding

In certain cases, it may not be feasible to support encoding for a schema. While it is generally advised to define schemas that allow both decoding and encoding, there are situations where encoding a particular type is either unsupported or unnecessary. In these instances, the `Forbidden` issue can signal that encoding is not available for certain values.

**Example** (Using `Forbidden` to Indicate Unsupported Encoding)

Here is an example of a transformation that never fails during decoding. It returns an [Either](/docs/data-types/either/) containing either the decoded value or the original input. For encoding, it is reasonable to not support it and use `Forbidden` as the result.

```ts twoslash
import { Either, ParseResult, Schema } from "effect"

// Define a schema that safely decodes to Either type
export const SafeDecode = <A, I>(self: Schema.Schema<A, I, never>) => {
  const decodeUnknownEither = Schema.decodeUnknownEither(self)
  return Schema.transformOrFail(
    Schema.Unknown,
    Schema.EitherFromSelf({
      left: Schema.Unknown,
      right: Schema.typeSchema(self)
    }),
    {
      strict: true,
      // Decode: map a failed result to the input as Left,
      // successful result as Right
      decode: (input) =>
        ParseResult.succeed(
          Either.mapLeft(decodeUnknownEither(input), () => input)
        ),
      // Encode: only support encoding Right values,
      // Left values raise Forbidden error
      encode: (actual, _, ast) =>
        Either.match(actual, {
          onLeft: () =>
            ParseResult.fail(
              new ParseResult.Forbidden(
                ast,
                actual,
                "cannot encode a Left"
              )
            ),
          // Successfully encode a Right value
          onRight: ParseResult.succeed
        })
    }
  )
}
```

**Explanation**

- **Decoding**: The `SafeDecode` function ensures that decoding never fails. It wraps the decoded value in an [Either](/docs/data-types/either/), where a successful decoding results in a `Right` and a failed decoding results in a `Left` containing the original input.
- **Encoding**: The encoding process uses the `Forbidden` error to indicate that encoding a `Left` value is not supported. Only `Right` values are successfully encoded.

## ParseError

The `Schema.decodeUnknownEither` and `Schema.encodeEither` functions returns a [Either](/docs/data-types/either/):

```ts showLineNumbers=false
Either<Type, ParseError>
```

where `ParseError` is defined as follows (simplified):

```ts showLineNumbers=false
interface ParseError {
  readonly _tag: "ParseError"
  readonly issue: ParseIssue
}
```

In this structure, `ParseIssue` represents an error that might occur during the parsing process.
It is wrapped in a tagged error to make it easier to catch errors using [Effect.catchTag](/docs/error-management/expected-errors/#catchtag).
The result `Either<Type, ParseError>` contains the inferred data type described by the schema (`Type`).
A successful parse yields a `Right` value with the parsed data `Type`, while a failed parse results in a `Left` value containing a `ParseError`.

<Aside type="tip" title="Returning All Errors">
  By default only the first error is returned. You can use the
  [`errors`](#receive-all-errors) option to receive all errors.
</Aside>

## Parse Options

The options below provide control over both decoding and encoding behaviors.

### Managing Excess properties

By default, any properties not defined in the schema are removed from the output when parsing a value. This ensures the parsed data conforms strictly to the expected structure.

If you want to detect and handle unexpected properties, use the `onExcessProperty` option (default value: `"ignore"`), which allows you to raise an error for excess properties. This can be helpful when you need to validate and catch unanticipated properties.

**Example** (Setting `onExcessProperty` to `"error"`)

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

// Excess properties are ignored by default
console.log(
  Schema.decodeUnknownSync(Person)({
    name: "Bob",
    age: 40,
    email: "bob@example.com" // Ignored
  })
)
/*
Output:
{ name: 'Bob', age: 40 }
*/

// With `onExcessProperty` set to "error",
// an error is thrown for excess properties
Schema.decodeUnknownSync(Person)(
  {
    name: "Bob",
    age: 40,
    email: "bob@example.com" // Will raise an error
  },
  { onExcessProperty: "error" }
)
/*
throws
ParseError: { readonly name: string; readonly age: number }
└─ ["email"]
   └─ is unexpected, expected: "name" | "age"
*/
```

To retain extra properties, set `onExcessProperty` to `"preserve"`.

**Example** (Setting `onExcessProperty` to `"preserve"`)

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

// Excess properties are preserved in the output
console.log(
  Schema.decodeUnknownSync(Person)(
    {
      name: "Bob",
      age: 40,
      email: "bob@example.com"
    },
    { onExcessProperty: "preserve" }
  )
)
/*
{ email: 'bob@example.com', name: 'Bob', age: 40 }
*/
```

### Receive all errors

The `errors` option enables you to retrieve all errors encountered during parsing. By default, only the first error is returned. Setting `errors` to `"all"` provides comprehensive error feedback, which can be useful for debugging or offering detailed validation feedback.

**Example** (Setting `errors` to `"all"`)

```ts twoslash
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

// Attempt to parse with multiple issues in the input data
Schema.decodeUnknownSync(Person)(
  {
    name: "Bob",
    age: "abc",
    email: "bob@example.com"
  },
  { errors: "all", onExcessProperty: "error" }
)
/*
throws
ParseError: { readonly name: string; readonly age: number }
├─ ["email"]
│  └─ is unexpected, expected: "name" | "age"
└─ ["age"]
   └─ Expected number, actual "abc"
*/
```

### Managing Property Order

The `propertyOrder` option provides control over the order of object fields in the output. This feature is particularly useful when the sequence of keys is important for the consuming processes or when maintaining the input order enhances readability and usability.

By default, the `propertyOrder` option is set to `"none"`. This means that the internal system decides the order of keys to optimize parsing speed.
The order of keys in this mode should not be considered stable, and it's recommended not to rely on key ordering as it may change in future updates.

Setting `propertyOrder` to `"original"` ensures that the keys are ordered as they appear in the input during the decoding/encoding process.

**Example** (Synchronous Decoding)

```ts twoslash
import { Schema } from "effect"

const schema = Schema.Struct({
  a: Schema.Number,
  b: Schema.Literal("b"),
  c: Schema.Number
})

// Default decoding, where property order is system-defined
console.log(Schema.decodeUnknownSync(schema)({ b: "b", c: 2, a: 1 }))
// Output may vary: { a: 1, b: 'b', c: 2 }

// Decoding while preserving input order
console.log(
  Schema.decodeUnknownSync(schema)(
    { b: "b", c: 2, a: 1 },
    { propertyOrder: "original" }
  )
)
// Output preserves input order: { b: 'b', c: 2, a: 1 }
```

**Example** (Asynchronous Decoding)

```ts twoslash
import type { Duration } from "effect"
import { Effect, ParseResult, Schema } from "effect"

// Helper function to simulate an async operation in schema
const effectify = (duration: Duration.DurationInput) =>
  Schema.Number.pipe(
    Schema.transformOrFail(Schema.Number, {
      strict: true,
      decode: (x) =>
        Effect.sleep(duration).pipe(
          Effect.andThen(ParseResult.succeed(x))
        ),
      encode: ParseResult.succeed
    })
  )

// Define a structure with asynchronous behavior in each field
const schema = Schema.Struct({
  a: effectify("200 millis"),
  b: effectify("300 millis"),
  c: effectify("100 millis")
}).annotations({ concurrency: 3 })

// Default decoding, where property order is system-defined
Schema.decode(schema)({ a: 1, b: 2, c: 3 })
  .pipe(Effect.runPromise)
  .then(console.log)
// Output decided internally: { c: 3, a: 1, b: 2 }

// Decoding while preserving input order
Schema.decode(schema)({ a: 1, b: 2, c: 3 }, { propertyOrder: "original" })
  .pipe(Effect.runPromise)
  .then(console.log)
// Output preserving input order: { a: 1, b: 2, c: 3 }
```

### Customizing Parsing Behavior at the Schema Level

The `parseOptions` annotation allows you to customize parsing behavior at different schema levels, enabling you to apply unique parsing settings to nested schemas within a structure. Options defined within a schema override parent-level settings and apply to all nested schemas.

**Example** (Using `parseOptions` to Customize Error Handling)

```ts twoslash
import { Schema } from "effect"
import { Either } from "effect"

const schema = Schema.Struct({
  a: Schema.Struct({
    b: Schema.String,
    c: Schema.String
  }).annotations({
    title: "first error only",
    // Limit errors to the first in this sub-schema
    parseOptions: { errors: "first" }
  }),
  d: Schema.String
}).annotations({
  title: "all errors",
  // Capture all errors for the main schema
  parseOptions: { errors: "all" }
})

// Decode input with custom error-handling behavior
const result = Schema.decodeUnknownEither(schema)(
  { a: {} },
  { errors: "first" }
)
if (Either.isLeft(result)) {
  console.log(result.left.message)
}
/*
all errors
├─ ["a"]
│  └─ first error only
│     └─ ["b"]
│        └─ is missing
└─ ["d"]
   └─ is missing
*/
```

**Detailed Output Explanation:**

In this example:

- The main schema is configured to display all errors. Hence, you will see errors related to both the `d` field (since it's missing) and any errors from the `a` subschema.
- The subschema (`a`) is set to display only the first error. Although both `b` and `c` fields are missing, only the first missing field (`b`) is reported.

## Type Guards

The `Schema.is` function provides a way to verify if a value conforms to a given schema. It acts as a [type guard](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates), taking a value of type `unknown` and determining if it matches the structure and type constraints defined in the schema.

Here's how the `Schema.is` function works:

1. **Schema Definition**: Define a schema to describe the structure and constraints of the data type you expect. For instance, `Schema<Type, Encoded, Context>`, where `Type` is the target type you want to validate against.

2. **Type Guard Creation**: Use the schema to create a user-defined type guard, `(u: unknown) => u is Type`. This function can be used at runtime to check if a value meets the requirements of the schema.

<Aside type="note" title="Role of the Encoded Type in Type Guards">
  The type `Encoded`, which is often used in schema transformations, does
  not affect the creation of the type guard. The main purpose is to ensure
  that the input matches the desired type `Type`.
</Aside>

**Example** (Creating and Using a Type Guard)

```ts twoslash
import { Schema } from "effect"

// Define a schema for a Person object
const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

// Generate a type guard from the schema
const isPerson = Schema.is(Person)

// Test the type guard with various inputs
console.log(isPerson({ name: "Alice", age: 30 }))
// Output: true

console.log(isPerson(null))
// Output: false

console.log(isPerson({}))
// Output: false
```

The generated `isPerson` function has the following signature:

```ts showLineNumbers=false
const isPerson: (
  u: unknown,
  overrideOptions?: number | ParseOptions
) => u is {
  readonly name: string
  readonly age: number
}
```

## Assertions

While type guards verify whether a value conforms to a specific type, the `Schema.asserts` function goes further by asserting that an input matches the schema type `Type` (from `Schema<Type, Encoded, Context>`).
If the input does not match the schema, it throws a detailed error, making it useful for runtime validation.

<Aside type="note" title="Role of the Encoded Type in Assertions">
  The type `Encoded`, which is often used in schema transformations, does
  not affect the creation of the assertion. The main purpose is to ensure
  that the input matches the desired type `Type`.
</Aside>

**Example** (Creating and Using an Assertion)

```ts twoslash
import { Schema } from "effect"

// Define a schema for a Person object
const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

// Generate an assertion function from the schema
const assertsPerson: Schema.Schema.ToAsserts<typeof Person> =
  Schema.asserts(Person)

try {
  // Attempt to assert that the input matches the Person schema
  assertsPerson({ name: "Alice", age: "30" })
} catch (e) {
  console.error("The input does not match the schema:")
  console.error(e)
}
/*
throws:
The input does not match the schema:
{
  _id: 'ParseError',
  message: '{ readonly name: string; readonly age: number }\n' +
    '└─ ["age"]\n' +
    '   └─ Expected number, actual "30"'
}
*/

// This input matches the schema and will not throw an error
assertsPerson({ name: "Alice", age: 30 })
```

The `assertsPerson` function generated from the schema has the following signature:

```ts showLineNumbers=false
const assertsPerson: (
  input: unknown,
  overrideOptions?: number | ParseOptions
) => asserts input is {
  readonly name: string
  readonly age: number
}
```

## Managing Missing Properties

When decoding, it's important to understand how missing properties are processed. By default, if a property is not present in the input, it is treated as if it were present with an `undefined` value.

**Example** (Default Behavior of Missing Properties)

```ts twoslash
import { Schema } from "effect"

const schema = Schema.Struct({ a: Schema.Unknown })
const input = {}

console.log(Schema.decodeUnknownSync(schema)(input))
// Output: { a: undefined }
```

In this example, although the key `"a"` is not present in the input, it is treated as `{ a: undefined }` by default.

If you need your validation logic to differentiate between genuinely missing properties and those explicitly set to `undefined`, you can enable the `exact` option.

**Example** (Setting `exact: true` to Distinguish Missing Properties)

```ts twoslash
import { Schema } from "effect"

const schema = Schema.Struct({ a: Schema.Unknown })
const input = {}

console.log(Schema.decodeUnknownSync(schema)(input, { exact: true }))
/*
throws
ParseError: { readonly a: unknown }
└─ ["a"]
   └─ is missing
*/
```

For the APIs `Schema.is` and `Schema.asserts`, however, the default behavior is to treat missing properties strictly, where the default for `exact` is `true`:

**Example** (Strict Handling of Missing Properties with `Schema.is` and `Schema.asserts`)

```ts twoslash
import type { SchemaAST } from "effect"
import { Schema } from "effect"

const schema = Schema.Struct({ a: Schema.Unknown })
const input = {}

console.log(Schema.is(schema)(input))
// Output: false

console.log(Schema.is(schema)(input, { exact: false }))
// Output: true

const asserts: (
  u: unknown,
  overrideOptions?: SchemaAST.ParseOptions
) => asserts u is {
  readonly a: unknown
} = Schema.asserts(schema)

try {
  asserts(input)
  console.log("asserts passed")
} catch (e: any) {
  console.error("asserts failed")
  console.error(e.message)
}
/*
Output:
asserts failed
{ readonly a: unknown }
└─ ["a"]
  └─ is missing
*/

try {
  asserts(input, { exact: false })
  console.log("asserts passed")
} catch (e: any) {
  console.error("asserts failed")
  console.error(e.message)
}
// Output: asserts passed
```

## Naming Conventions

The naming conventions in `effect/Schema` are designed to be straightforward and logical, **focusing primarily on compatibility with JSON serialization**. This approach simplifies the understanding and use of schemas, especially for developers who are integrating web technologies where JSON is a standard data interchange format.

### Overview of Naming Strategies

**JSON-Compatible Types**

Schemas that naturally serialize to JSON-compatible formats are named directly after their data types.

For instance:

- `Schema.Date`: serializes JavaScript Date objects to ISO-formatted strings, a typical method for representing dates in JSON.
- `Schema.Number`: used directly as it maps precisely to the JSON number type, requiring no special transformation to remain JSON-compatible.

**Non-JSON-Compatible Types**

When dealing with types that do not have a direct representation in JSON, the naming strategy incorporates additional details to indicate the necessary transformation. This helps in setting clear expectations about the schema's behavior:

For instance:

- `Schema.DateFromSelf`: indicates that the schema handles `Date` objects, which are not natively JSON-serializable.
- `Schema.NumberFromString`: this naming suggests that the schema processes numbers that are initially represented as strings, emphasizing the transformation from string to number when decoding.

The primary goal of these schemas is to ensure that domain objects can be easily serialized ("encoded") and deserialized ("decoded") for transmission over network connections, thus facilitating their transfer between different parts of an application or across different applications.

### Rationale

While JSON's ubiquity justifies its primary consideration in naming, the conventions also accommodate serialization for other types of transport. For instance, converting a `Date` to a string is a universally useful method for various communication protocols, not just JSON. Thus, the selected naming conventions serve as sensible defaults that prioritize clarity and ease of use, facilitating the serialization and deserialization processes across diverse technological environments.
