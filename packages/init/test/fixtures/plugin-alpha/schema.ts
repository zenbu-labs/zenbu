import zod from "zod";
import { createSchema, f } from "@zenbu/kyju/schema";

export const schema = createSchema({
  items: f
    .array(zod.object({ id: zod.string(), text: zod.string() }))
    .default([]),
  count: f.number().default(0),
});
