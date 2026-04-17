import type { Expect, Equal } from "type-testing";
import zod from "zod";
import type { ClientCollection } from "../src/v2/shared";
import { createSchema, f, type InferRoot, type InferSchema } from "../src/v2/db/schema";
import type { CollectionResult } from "../src/v2/react/index";

const testSchema = createSchema({
  title: f.string().default("untitled"),
  count: f.number().default(0),
  settings: f.object({
    theme: zod.enum(["light", "dark"]),
    fontSize: zod.number(),
  }).default({ theme: "light", fontSize: 14 }),
  messages: f.collection<{ text: string; author: string }>(),
  logs: f.collection<{ level: string; message: string }>(),
  data: f.blob(),
});

type TestShape = InferSchema<typeof testSchema>;
type Root = InferRoot<TestShape>;

// root has typed fields
{
  type _test_title = Expect<Equal<Root["title"], string>>;
  type _test_count = Expect<Equal<Root["count"], number>>;
  type _test_messages = Expect<
    Equal<Root["messages"], { collectionId: string; debugName: string }>
  >;
  type _test_data = Expect<
    Equal<Root["data"], { blobId: string; debugName: string }>
  >;
}

// selector parameter receives Root
{
  type SelectorFn = (root: Root) => string;
  type SelectorParam = Parameters<SelectorFn>[0];

  type _test_title = Expect<Equal<SelectorParam["title"], string>>;
  type _test_count = Expect<Equal<SelectorParam["count"], number>>;
  type _test_messages = Expect<
    Equal<SelectorParam["messages"], { collectionId: string; debugName: string }>
  >;
}

// infers item type from collection accessor
{
  type MessagesResult = CollectionResult<{ text: string; author: string }>;
  type _test_items = Expect<Equal<MessagesResult["items"], { text: string; author: string }[]>>;
  type _test_collection = Expect<Equal<MessagesResult["collection"], ClientCollection | null>>;
  type _test_concat = Expect<
    Equal<MessagesResult["concat"], (items: { text: string; author: string }[]) => Promise<void>>
  >;
}

// infers different collection item types
{
  type LogsResult = CollectionResult<{ level: string; message: string }>;
  type _test_items = Expect<Equal<LogsResult["items"], { level: string; message: string }[]>>;
}
