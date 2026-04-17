import { Args, Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { FileSystem } from "@effect/platform";
import { Console, Effect, Option, Ref } from "effect";
import nodePath from "node:path";
import {
  paths,
  readJsonFile,
  readJsonlFile,
  type DbConfig,
  type DbHandlerContext,
  type Session,
  type CollectionIndex,
  type BlobIndex,
} from "../v2/db/helpers";
import { handleWrite } from "../v2/db/handlers/write";
import type { KyjuJSON, WriteOp } from "../v2/shared";

const DEFAULT_CONFIG: Omit<
  DbConfig,
  "dbPath" | "maxPageSize" | "checkReferences"
> = {
  rootName: "root",
  collectionsDirName: "collections",
  collectionIndexName: "index",
  pagesDirName: "pages",
  pageIndexName: "index",
  pageDataName: "data",
  blobsDirName: "blobs",
  blobIndexName: "index",
  blobDataName: "data",
};

const makeConfig = (dbPath: string): DbConfig => ({
  ...DEFAULT_CONFIG,
  dbPath: nodePath.resolve(dbPath),
  maxPageSize: 1024 * 1024,
  checkReferences: false,
});

const readRoot = (fs: FileSystem.FileSystem, config: DbConfig) =>
  readJsonFile({ fs, path: paths.root({ config }) }) as Effect.Effect<
    Record<string, any>
  >;

type CollectionRef = {
  field: string;
  collectionId: string;
  debugName: string;
};
type BlobRef = { field: string; blobId: string; debugName: string };

const getCollectionRefs = (root: Record<string, any>): CollectionRef[] =>
  Object.entries(root)
    .filter(([, v]) => v && typeof v === "object" && "collectionId" in v)
    .map(([field, v]: [string, any]) => ({
      field,
      collectionId: v.collectionId as string,
      debugName: v.debugName as string,
    }));

const getBlobRefs = (root: Record<string, any>): BlobRef[] =>
  Object.entries(root)
    .filter(([, v]) => v && typeof v === "object" && "blobId" in v)
    .map(([field, v]: [string, any]) => ({
      field,
      blobId: v.blobId as string,
      debugName: v.debugName as string,
    }));

const resolveCollectionId = (
  root: Record<string, any>,
  fieldOrId: string,
): string => {
  const val = root[fieldOrId];
  if (val?.collectionId) return val.collectionId;
  const match = getCollectionRefs(root).find(
    (r) => r.collectionId === fieldOrId,
  );
  if (match) return match.collectionId;
  throw new Error(`No collection found for "${fieldOrId}"`);
};

const resolveBlobId = (
  root: Record<string, any>,
  fieldOrId: string,
): string => {
  const val = root[fieldOrId];
  if (val?.blobId) return val.blobId;
  const match = getBlobRefs(root).find((r) => r.blobId === fieldOrId);
  if (match) return match.blobId;
  throw new Error(`No blob found for "${fieldOrId}"`);
};

const readCollectionPages = (
  fs: FileSystem.FileSystem,
  config: DbConfig,
  collectionId: string,
) =>
  Effect.gen(function* () {
    const pagesDir = nodePath.join(
      paths.collection({ config, collectionId }),
      config.pagesDirName,
    );
    const pageDirs = yield* fs.readDirectory(pagesDir);

    const withOrder = yield* Effect.all(
      pageDirs.map((pageId) =>
        Effect.map(
          readJsonFile({
            fs,
            path: paths.pageIndex({ config, collectionId, pageId }),
          }),
          (idx: any) => ({ id: pageId, order: idx.order as number }),
        ),
      ),
    );
    return withOrder.sort((a, b) => a.order - b.order);
  });

// ── @effect/cli command definitions ───────────────────────────

const dbPathOption = Options.text("db").pipe(
  Options.withDescription("Path to the database directory"),
);

const dbCommand = Command.make("db", { db: dbPathOption });

// ── root ──────────────────────────────────────────────────────

const rootCmd = Command.make("root", {}, () =>
  Effect.gen(function* () {
    const { db } = yield* dbCommand;
    const fs = yield* FileSystem.FileSystem;
    const config = makeConfig(db);
    const root = yield* readRoot(fs, config);
    yield* Console.log(JSON.stringify(root, null, 2));
  }),
);

// ── collections ───────────────────────────────────────────────

const collectionsCmd = Command.make("collections", {}, () =>
  Effect.gen(function* () {
    const { db } = yield* dbCommand;
    const fs = yield* FileSystem.FileSystem;
    const config = makeConfig(db);
    const root = yield* readRoot(fs, config);
    const refs = getCollectionRefs(root);
    if (refs.length === 0) {
      yield* Console.log("No collections.");
      return;
    }
    for (const ref of refs) {
      const idx = (yield* readJsonFile({
        fs,
        path: paths.collectionIndex({ config, collectionId: ref.collectionId }),
      })) as unknown as CollectionIndex;
      yield* Console.log(
        `${ref.field} (${ref.debugName})\n` +
          `  id:    ${ref.collectionId}\n` +
          `  pages: ${idx.totalPages}\n` +
          `  count: ${idx.totalCount}`,
      );
    }
  }),
);

// ── collection <field-or-id> ──────────────────────────────────

const collectionCmd = Command.make(
  "collection",
  {
    fieldOrId: Args.text({ name: "field-or-id" }),
    page: Options.integer("page").pipe(Options.optional),
    json: Options.boolean("json").pipe(Options.withDefault(false)),
  },
  ({ fieldOrId, page, json }) =>
    Effect.gen(function* () {
      const { db } = yield* dbCommand;
      const fs = yield* FileSystem.FileSystem;
      const config = makeConfig(db);
      const root = yield* readRoot(fs, config);
      const colId = resolveCollectionId(root, fieldOrId);

      const sorted = yield* readCollectionPages(fs, config, colId);
      const selected = Option.isSome(page)
        ? [sorted[page.value]!]
        : sorted;

      const allItems: KyjuJSON[] = [];
      for (const p of selected) {
        const items = yield* readJsonlFile({
          fs,
          path: paths.pageData({ config, collectionId: colId, pageId: p.id }),
        });
        allItems.push(...items);
      }

      if (json) {
        yield* Console.log(JSON.stringify(allItems));
      } else {
        for (let i = 0; i < allItems.length; i++) {
          yield* Console.log(`[${i}] ${JSON.stringify(allItems[i])}`);
        }
      }
    }),
);

// ── blobs ─────────────────────────────────────────────────────

const blobsCmd = Command.make("blobs", {}, () =>
  Effect.gen(function* () {
    const { db } = yield* dbCommand;
    const fs = yield* FileSystem.FileSystem;
    const config = makeConfig(db);
    const root = yield* readRoot(fs, config);
    const refs = getBlobRefs(root);
    if (refs.length === 0) {
      yield* Console.log("No blobs.");
      return;
    }
    for (const ref of refs) {
      const idx = (yield* readJsonFile({
        fs,
        path: paths.blobIndex({ config, blobId: ref.blobId }),
      })) as unknown as BlobIndex;
      yield* Console.log(
        `${ref.field} (${ref.debugName})\n` +
          `  id:   ${ref.blobId}\n` +
          `  size: ${idx.fileSize} bytes`,
      );
    }
  }),
);

// ── blob <field-or-id> ───────────────────────────────────────

const blobCmd = Command.make(
  "blob",
  { fieldOrId: Args.text({ name: "field-or-id" }) },
  ({ fieldOrId }) =>
    Effect.gen(function* () {
      const { db } = yield* dbCommand;
      const fs = yield* FileSystem.FileSystem;
      const config = makeConfig(db);
      const root = yield* readRoot(fs, config);
      const blobId = resolveBlobId(root, fieldOrId);
      const data = yield* fs.readFile(
        paths.blobData({ config, blobId }),
      );
      yield* Console.log(new TextDecoder().decode(data));
    }),
);

// ── paths ─────────────────────────────────────────────────────

const pathsCmd = Command.make("paths", {}, () =>
  Effect.gen(function* () {
    const { db } = yield* dbCommand;
    const fs = yield* FileSystem.FileSystem;
    const config = makeConfig(db);
    const root = yield* readRoot(fs, config);

    yield* Console.log(`root: ${paths.root({ config })}`);

    for (const ref of getCollectionRefs(root)) {
      const sorted = yield* readCollectionPages(
        fs,
        config,
        ref.collectionId,
      );
      yield* Console.log(`\n${ref.field} (collection):`);
      yield* Console.log(
        `  index: ${paths.collectionIndex({ config, collectionId: ref.collectionId })}`,
      );
      for (const p of sorted) {
        yield* Console.log(
          `  page:  ${paths.pageData({ config, collectionId: ref.collectionId, pageId: p.id })}`,
        );
      }
    }

    for (const ref of getBlobRefs(root)) {
      yield* Console.log(`\n${ref.field} (blob):`);
      yield* Console.log(
        `  index: ${paths.blobIndex({ config, blobId: ref.blobId })}`,
      );
      yield* Console.log(
        `  data:  ${paths.blobData({ config, blobId: ref.blobId })}`,
      );
    }
  }),
);

// ── op <json> ─────────────────────────────────────────────────

const opCmd = Command.make(
  "op",
  { opJson: Args.text({ name: "operation-json" }) },
  ({ opJson }) =>
    Effect.gen(function* () {
      const { db } = yield* dbCommand;
      const fs = yield* FileSystem.FileSystem;
      const config = makeConfig(db);
      const parsedOp = JSON.parse(opJson) as WriteOp;

      const responses: any[] = [];
      const fakeSession: Session = {
        sessionId: "cli",
        replicaId: "cli",
        subscriptions: new Set(),
        send: (event) => {
          responses.push(event);
        },
      };

      const ctx: DbHandlerContext = {
        fs,
        config,
        sessionsRef: yield* Ref.make(new Map([["cli", fakeSession]])),
        rootMutex: yield* Effect.makeSemaphore(1),
        collectionMutex: yield* Effect.makeSemaphore(1),
        blobMutex: yield* Effect.makeSemaphore(1),
        dbSend: () => {},
      };

      yield* handleWrite(ctx, {
        kind: "write",
        op: parsedOp,
        sessionId: "cli",
        requestId: "cli-op",
        replicaId: "cli",
      });

      const ack = responses.find(
        (r) =>
          r.kind === "db-update" && r.message?.requestId === "cli-op",
      );
      if (ack?.message?.error) {
        yield* Console.error(
          `Error: ${ack.message.error._tag}: ${ack.message.error.message}`,
        );
      } else {
        yield* Console.log(`Applied: ${parsedOp.type}`);
      }
    }),
);

// ── wire everything ───────────────────────────────────────────

const command = dbCommand.pipe(
  Command.withSubcommands([
    rootCmd,
    collectionsCmd,
    collectionCmd,
    blobsCmd,
    blobCmd,
    pathsCmd,
    opCmd,
  ]),
);

export function runDb(argv: string[] = process.argv.slice(3)) {
  const cli = Command.run(command, {
    name: "kyju db",
    version: "0.0.0",
  });
  Effect.suspend(() =>
    cli(["node", "kyju-db", ...argv]),
  ).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
}
