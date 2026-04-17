import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { createDb } from "../src/v2/db/db";
import { createReplica } from "../src/v2/replica/replica";
import { createClient } from "../src/v2/client/client";
import { createSchema, f, type InferSchema } from "../src/v2/db/schema";
import { VERSION } from "../src/v2/shared";

export const seedSchema = createSchema({
  title: f.string().default("My Project"),
  count: f.number().default(0),
  settings: f.string().default(JSON.stringify({ theme: "dark", fontSize: 14 })),
  messages: f.collection<{ text: string; author: string; ts: number }>(),
  logs: f.collection<{ level: string; message: string }>(),
  readme: f.blob(),
});

type SeedSchema = InferSchema<typeof seedSchema>;

export async function seedDb(opts?: { path?: string }) {
  const dbPath = opts?.path ?? path.join(os.tmpdir(), `kyju-seed-${nanoid()}`);

  let db!: Awaited<ReturnType<typeof createDb>>;
  const replica = createReplica({
    send: (event) => db.postMessage(event),
    maxPageSizeBytes: 1024 * 1024,
  });

  db = await createDb({
    path: dbPath,
    schema: seedSchema,
    send: (event) => replica.postMessage(event),
  });

  await replica.postMessage({ kind: "connect", version: VERSION });
  const client = createClient<SeedSchema>(replica);

  await client.title.set("Test Project");
  await client.count.set(42);

  const messages = Array.from({ length: 25 }, (_, i) => ({
    text: `Message ${i + 1}`,
    author: i % 2 === 0 ? "alice" : "bob",
    ts: Date.now() + i * 1000,
  }));
  await client.messages.concat(messages);

  await client.logs.concat([
    { level: "info", message: "Application started" },
    { level: "warn", message: "Disk space low" },
    { level: "error", message: "Connection timeout" },
  ]);

  await client.readme.set(
    new TextEncoder().encode("# README\n\nThis is a test database."),
  );

  await replica.postMessage({ kind: "disconnect" });

  return {
    dbPath,
    cleanup: () => fs.rmSync(dbPath, { recursive: true, force: true }),
  };
}

if (process.argv[1]?.endsWith("seed-db.ts")) {
  const pathIdx = process.argv.indexOf("--path");
  const customPath = pathIdx !== -1 ? process.argv[pathIdx + 1] : undefined;
  seedDb({ path: customPath }).then(({ dbPath }) => {
    console.log(`Seeded database at: ${dbPath}`);
  });
}
