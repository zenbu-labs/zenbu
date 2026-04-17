---
title: Schema Projections
description: Create new schemas by extracting and customizing the Type or Encoded components of existing schemas.
sidebar:
  label: Projections
  order: 6
---

Sometimes, you may want to create a new schema based on an existing one, focusing specifically on either its `Type` or `Encoded` aspect. The Schema module provides several functions to make this possible.

## typeSchema

The `Schema.typeSchema` function is used to extract the `Type` portion of a schema, resulting in a new schema that retains only the type-specific properties from the original schema. This excludes any initial encoding or transformation logic applied to the original schema.

**Function Signature**

```ts showLineNumbers=false
declare const typeSchema: <A, I, R>(schema: Schema<A, I, R>) => Schema<A>
```

**Example** (Extracting Only Type-Specific Properties)

```ts twoslash
import { Schema } from "effect"

const Original = Schema.Struct({
  quantity: Schema.NumberFromString.pipe(Schema.greaterThanOrEqualTo(2))
})

// This creates a schema where 'quantity' is defined as a number
// that must be greater than or equal to 2.
const TypeSchema = Schema.typeSchema(Original)

// TypeSchema is equivalent to:
const TypeSchema2 = Schema.Struct({
  quantity: Schema.Number.pipe(Schema.greaterThanOrEqualTo(2))
})
```

## encodedSchema

The `Schema.encodedSchema` function enables you to extract the `Encoded` portion of a schema, creating a new schema that matches the original properties but **omits any refinements or transformations** applied to the schema.

**Function Signature**

```ts showLineNumbers=false
declare const encodedSchema: <A, I, R>(
  schema: Schema<A, I, R>
) => Schema<I>
```

**Example** (Extracting Encoded Properties Only)

```ts twoslash
import { Schema } from "effect"

const Original = Schema.Struct({
  quantity: Schema.String.pipe(Schema.minLength(3))
})

// This creates a schema where 'quantity' is just a string,
// disregarding the minLength refinement.
const Encoded = Schema.encodedSchema(Original)

// Encoded is equivalent to:
const Encoded2 = Schema.Struct({
  quantity: Schema.String
})
```

## encodedBoundSchema

The `Schema.encodedBoundSchema` function is similar to `Schema.encodedSchema` but preserves the refinements up to the first transformation point in the
original schema.

**Function Signature**

```ts showLineNumbers=false
declare const encodedBoundSchema: <A, I, R>(
  schema: Schema<A, I, R>
) => Schema<I>
```

The term "bound" in this context refers to the boundary up to which refinements are preserved when extracting the encoded form of a schema. It essentially marks the limit to which initial validations and structure are maintained before any transformations are applied.

**Example** (Retaining Initial Refinements Only)

```ts twoslash
import { Schema } from "effect"

const Original = Schema.Struct({
  foo: Schema.String.pipe(
    Schema.minLength(3),
    Schema.compose(Schema.Trim)
  )
})

// The EncodedBoundSchema schema preserves the minLength(3) refinement,
// ensuring the string length condition is enforced
// but omits the Schema.Trim transformation.
const EncodedBoundSchema = Schema.encodedBoundSchema(Original)

// EncodedBoundSchema is equivalent to:
const EncodedBoundSchema2 = Schema.Struct({
  foo: Schema.String.pipe(Schema.minLength(3))
})
```
