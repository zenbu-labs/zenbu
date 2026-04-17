import zod from "zod";
import { createSchema, f } from "@zenbu/kyju/schema";

export const schema = createSchema({
  agents: f
    .array(
      zod.object({
        id: zod.string(),
        name: zod.string(),
      }),
    )
    .default([]),
});
