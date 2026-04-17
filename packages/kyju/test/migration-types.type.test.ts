import type { Expect, Equal } from "type-testing";
import { createSchema, f, type InferRoot } from "../src/v2/db/schema";
import zod from "zod";

const baseSchema = createSchema({
  title: f.string().default("hello"),
  count: f.number().default(0),
});

// fields with .default() infer to T (not T | undefined)
{
  type Root = InferRoot<typeof baseSchema.shape>;
  type _title = Expect<Equal<Root["title"], string>>;
  type _count = Expect<Equal<Root["count"], number>>;
}

// fields without .default() infer to T | undefined
{
  const schema = createSchema({
    name: f.string().default("hi"),
    nickname: f.string(),
  });
  type Root = InferRoot<typeof schema.shape>;
  type _name = Expect<Equal<Root["name"], string>>;
  type _nickname = Expect<Equal<Root["nickname"], string | undefined>>;
}

// collections always infer to their type
{
  const schema = createSchema({
    messages: f.collection<{ text: string }>(),
  });
  type Root = InferRoot<typeof schema.shape>;
  type _msg = Expect<
    Equal<Root["messages"], { collectionId: string; debugName: string }>
  >;
}

// blobs always infer to their type
{
  const schema = createSchema({
    data: f.blob(),
  });
  type Root = InferRoot<typeof schema.shape>;
  type _blob = Expect<
    Equal<Root["data"], { blobId: string; debugName: string }>
  >;
}

// mix of defaulted, optional, collection, blob
{
  const schema = createSchema({
    title: f.string().default(""),
    nickname: f.string(),
    messages: f.collection<{ text: string }>(),
    avatar: f.blob(),
  });
  type Root = InferRoot<typeof schema.shape>;
  type _title = Expect<Equal<Root["title"], string>>;
  type _nickname = Expect<Equal<Root["nickname"], string | undefined>>;
  type _msg = Expect<
    Equal<Root["messages"], { collectionId: string; debugName: string }>
  >;
  type _avatar = Expect<
    Equal<Root["avatar"], { blobId: string; debugName: string }>
  >;
}

// createSchema returns correct inferred types
{
  const schema = createSchema({
    title: f.string().default(""),
    count: f.number().default(0),
    description: f.string().default("new"),
  });

  type _root = Expect<
    Equal<
      InferRoot<typeof schema.shape>,
      { title: string; count: number; description: string }
    >
  >;
}

// collections and blobs compile
{
  const schema = createSchema({
    title: f.string().default(""),
    count: f.number().default(0),
    messages: f.collection<{ text: string }>(),
    avatar: f.blob(),
  });

  type _msg = Expect<
    Equal<
      InferRoot<typeof schema.shape>["messages"],
      { collectionId: string; debugName: string }
    >
  >;
}
