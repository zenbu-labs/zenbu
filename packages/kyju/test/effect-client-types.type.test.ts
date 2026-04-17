import type { Expect, Equal } from "type-testing";
import type { Effect } from "effect";
import zod from "zod";
import { createSchema, f, type InferSchema } from "../src/v2/db/schema";
import type { KyjuError } from "../src/v2/shared";
import type { EffectClientProxy } from "../src/v2/client/client";

const testSchema = createSchema({
  title: f.string().default("untitled"),
  count: f.number().default(0),
  settings: f.object({
    theme: zod.enum(["light", "dark"]),
    fontSize: zod.number(),
  }).default({ theme: "light", fontSize: 14 }),
  items: f.array(
    zod.object({ id: zod.string(), name: zod.string() }),
  ).default([]),
  lookup: f.record(zod.string(), zod.string()).default({}),
  messages: f.collection<{ text: string; author: string }>(),
  data: f.blob(),
});

type TestShape = InferSchema<typeof testSchema>;
type Client = EffectClientProxy<TestShape>;

// field.set returns Effect<void, KyjuError>
{
  type SetReturn = ReturnType<Client["title"]["set"]>;
  type _test = Expect<Equal<SetReturn, Effect.Effect<void, KyjuError>>>;
}

// field.read returns the value type synchronously
{
  type ReadReturn = ReturnType<Client["title"]["read"]>;
  type _test = Expect<Equal<ReadReturn, string>>;
}

// collection.concat returns Effect<void, KyjuError>
{
  type ConcatReturn = ReturnType<Client["messages"]["concat"]>;
  type _test = Expect<Equal<ConcatReturn, Effect.Effect<void, KyjuError>>>;
}

// collection.read returns Effect<void, KyjuError>
{
  type ReadReturn = ReturnType<Client["messages"]["read"]>;
  type _test = Expect<Equal<ReadReturn, Effect.Effect<void, KyjuError>>>;
}

// collection.create returns Effect<void, KyjuError>
{
  type CreateReturn = ReturnType<Client["messages"]["create"]>;
  type _test = Expect<Equal<CreateReturn, Effect.Effect<void, KyjuError>>>;
}

// collection.delete returns Effect<void, KyjuError>
{
  type DeleteReturn = ReturnType<Client["messages"]["delete"]>;
  type _test = Expect<Equal<DeleteReturn, Effect.Effect<void, KyjuError>>>;
}

// blob.set returns Effect<void, KyjuError>
{
  type SetReturn = ReturnType<Client["data"]["set"]>;
  type _test = Expect<Equal<SetReturn, Effect.Effect<void, KyjuError>>>;
}

// blob.read returns Effect<void, KyjuError>
{
  type ReadReturn = ReturnType<Client["data"]["read"]>;
  type _test = Expect<Equal<ReadReturn, Effect.Effect<void, KyjuError>>>;
}

// update returns Effect<void, KyjuError>
{
  type UpdateReturn = ReturnType<Client["update"]>;
  type _test = Expect<Equal<UpdateReturn, Effect.Effect<void, KyjuError>>>;
}

// readRoot returns InferRoot synchronously
{
  type Root = ReturnType<Client["readRoot"]>;
  type _test_title = Expect<Equal<Root["title"], string>>;
  type _test_count = Expect<Equal<Root["count"], number>>;
  type _test_items = Expect<Equal<Root["items"], Array<{ id: string; name: string }>>>;
  type _test_lookup = Expect<Equal<Root["lookup"], Record<string, string>>>;
}

// subscribe is synchronous
{
  type SubReturn = ReturnType<Client["title"]["subscribe"]>;
  type _test = Expect<Equal<SubReturn, () => void>>;
}

// collection.subscribe is synchronous
{
  type SubReturn = ReturnType<Client["messages"]["subscribe"]>;
  type _test = Expect<Equal<SubReturn, () => void>>;
}

// nested field.set returns Effect
{
  type SetReturn = ReturnType<Client["settings"]["theme"]["set"]>;
  type _test = Expect<Equal<SetReturn, Effect.Effect<void, KyjuError>>>;
}

// --- Promise ClientProxy type inference ---
{
  type PromiseClient = import("../src/v2/client/client").ClientProxy<TestShape>;
  type SetReturn = ReturnType<PromiseClient["title"]["set"]>;
  type _test = Expect<Equal<SetReturn, Promise<void>>>;
}

{
  type PromiseClient = import("../src/v2/client/client").ClientProxy<TestShape>;
  type ConcatReturn = ReturnType<PromiseClient["messages"]["concat"]>;
  type _test = Expect<Equal<ConcatReturn, Promise<void>>>;
}

{
  type PromiseClient = import("../src/v2/client/client").ClientProxy<TestShape>;
  type UpdateReturn = ReturnType<PromiseClient["update"]>;
  type _test = Expect<Equal<UpdateReturn, Promise<void>>>;
}
