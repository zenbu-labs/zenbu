import zod from "zod";
import { createSchema, f } from "@zenbu/kyju/schema";

export const schema = createSchema({
  config: f
    .object({ theme: zod.string(), lang: zod.string() })
    .default({ theme: "dark", lang: "en" }),
  logs: f.collection(zod.object({ msg: zod.string(), ts: zod.number() })),
});
