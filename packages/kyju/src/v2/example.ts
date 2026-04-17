import { createReplica } from "./replica/replica";
import { createClient } from "./client/client";
import { createSchema, f, type InferSchema } from "./db/schema";
import { createDb } from "./db/db";
import type { KyjuMigration } from "./migrations";

const appSchema = createSchema({
  title: f.string().default(""),
  description: f.string().default("default description"),
  messages: f.collection<{ text: string; author: string }>(),
});

const migrations: KyjuMigration[] = [
  {
    version: 1,
    operations: [
      { op: "add", key: "title", kind: "data", hasDefault: true, default: "my app" },
      { op: "add", key: "messages", kind: "collection" },
    ],
  },
  {
    version: 2,
    migrate: (prev) => ({
      ...prev,
      title: "migrated: " + prev.title,
    }),
  },
  {
    version: 3,
    operations: [
      { op: "add", key: "description", kind: "data", hasDefault: true, default: "default description" },
    ],
  },
];

export type AppSchema = InferSchema<typeof appSchema>;

const main = async () => {
  const replica = createReplica({
    send: (event) => db.postMessage(event),
    maxPageSizeBytes: 1024 * 1024,
  });

  const db = await createDb({
    path: "/tmp/kyju-example",
    schema: appSchema,
    migrations,
    send: (event) => replica.postMessage(event),
  });

  await replica.postMessage({ kind: "connect", version: 0 });

  const client = createClient<AppSchema>(replica);

  await client.title.set("hello world");
  await client.description.set("a cool app");
  await client.messages.concat([
    { text: "first message", author: "alice" },
    { text: "second message", author: "bob" },
  ]);

  console.log("title:", client.title.read());
  console.log("description:", client.description.read());

  client.title.subscribe((value) => {
    console.log("title changed:", value);
  });

  await client.update((root) => {
    root.title = "updated title";
  });
};

main();
