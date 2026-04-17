import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { createDb, type Db } from "../src/v2/db/db";
import { createReplica } from "../src/v2/replica/replica";
import { createClient, type ClientProxy } from "../src/v2/client/client";
import { createSchema, f, type InferSchema } from "../src/v2/db/schema";
import type { KyjuMigration } from "../src/v2/migrations";
import type { ClientState } from "../src/v2/shared";
import { VERSION } from "../src/v2/shared";

export const testSchema = createSchema({
  title: f.string().default("untitled"),
  messages: f.collection<{ text: string; author: string }>(),
  data: f.blob(),
});

export type TestSchema = InferSchema<typeof testSchema>;

function tmpDbPath() {
  return path.join(os.tmpdir(), `kyju-test-${nanoid()}`);
}

export function getState(replica: { getState: () => ClientState }): ClientState {
  return replica.getState();
}

export function getConnectedState(replica: { getState: () => ClientState }) {
  const state = getState(replica);
  if (state.kind === "disconnected") throw new Error("Not connected");
  return state;
}

export async function setup(opts?: {
  schema?: any;
  migrations?: KyjuMigration[];
  maxPageSize?: number;
  checkReferences?: boolean;
  plugins?: any[];
}) {
  const dbPath = tmpDbPath();
  const schema = opts?.schema ?? testSchema;

  let db!: Db;

  const replica = createReplica({
    send: (event) => db.postMessage(event),
    maxPageSizeBytes: opts?.maxPageSize ?? 1024 * 1024,
  });

  db = await createDb({
    path: dbPath,
    schema,
    migrations: opts?.migrations ?? [],
    send: (event) => replica.postMessage(event),
    maxPageSize: opts?.maxPageSize,
    checkReferences: opts?.checkReferences,
    plugins: opts?.plugins,
  });

  await replica.postMessage({ kind: "connect", version: VERSION });

  const client = createClient<TestSchema>(replica);

  const cleanup = () => {
    fs.rmSync(dbPath, { recursive: true, force: true });
  };

  return { db, replica, client, dbPath, cleanup };
}

export async function setupMultiClient(
  n: number,
  opts?: {
    schema?: any;
    migrations?: KyjuMigration[];
    maxPageSize?: number;
    checkReferences?: boolean;
  },
) {
  const dbPath = tmpDbPath();
  const maxPageSize = opts?.maxPageSize ?? 1024 * 1024;

  const replicas: ReturnType<typeof createReplica>[] = [];
  const replicaById = new Map<string, ReturnType<typeof createReplica>>();

  let db!: Db;

  db = await createDb({
    path: dbPath,
    schema: opts?.schema ?? testSchema,
    migrations: opts?.migrations ?? [],
    send: (event) => replicaById.get(event.replicaId)?.postMessage(event),
    maxPageSize,
    checkReferences: opts?.checkReferences,
  });

  for (let i = 0; i < n; i++) {
    const replica = createReplica({
      send: (event) => db.postMessage(event),
      maxPageSizeBytes: maxPageSize,
    });
    replicas.push(replica);
    replicaById.set(replica.replicaId, replica);
  }

  for (const replica of replicas) {
    await replica.postMessage({ kind: "connect", version: VERSION });
  }

  const clients = replicas.map((r) => createClient<TestSchema>(r));

  return {
    db,
    replicas,
    clients,
    dbPath,
    cleanup: () => fs.rmSync(dbPath, { recursive: true, force: true }),
  };
}

export const delay = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));
