import { Effect } from "effect";
import nodePath from "node:path";
import type { ServerEvent } from "../../shared";
import {
  makeAck,
  makeErrorAck,
  paths,
  readJsonlFile,
  sendAck,
} from "../helpers";
import { type DbHandlerContext, validateSession } from "../helpers";

type ReadEvent = Extract<ServerEvent, { kind: "read" }>;

type PageIndex = {
  pageId: string;
  order: number;
};

export const handleRead = (ctx: DbHandlerContext, event: ReadEvent) =>
  Effect.gen(function* () {
    const session = yield* validateSession(ctx, event.sessionId, event.requestId, event.replicaId);
    const readOp = event.op;

    switch (readOp.type) {
      case "collection.read": {
        yield* ctx.collectionMutex.withPermits(1)(
          Effect.gen(function* () {
            const collectionDir = paths.collection({
              config: ctx.config,
              collectionId: readOp.collectionId,
            });
            const exists = yield* ctx.fs.exists(collectionDir);
            if (!exists) {
              sendAck({
                session,
                ack: makeErrorAck({
                  requestId: event.requestId,
                  sessionId: event.sessionId,
                  _tag: "NotFoundError",
                  message: `Collection ${readOp.collectionId} not found`,
                }),
              });
              return;
            }

            const pagesDir = nodePath.join(
              collectionDir,
              ctx.config.pagesDirName,
            );
            const pageDirs = yield* ctx.fs.readDirectory(pagesDir);

            const pageIndexes = yield* Effect.all(
              pageDirs.map((pageId) =>
                Effect.gen(function* () {
                  const pIdx = JSON.parse(
                    yield* ctx.fs.readFileString(
                      paths.pageIndex({
                        config: ctx.config,
                        collectionId: readOp.collectionId,
                        pageId,
                      }),
                    ),
                  ) as PageIndex;
                  return { id: pageId, order: pIdx.order };
                }),
              ),
              { concurrency: "unbounded" },
            );

            const sorted = pageIndexes.sort(
              (left, right) => left.order - right.order,
            );
            const selected = readOp.range
              ? sorted.slice(readOp.range.start, readOp.range.end + 1)
              : sorted;

            const pageResults = yield* Effect.all(
              selected.map((entry) =>
                Effect.gen(function* () {
                  const dataPath = paths.pageData({
                    config: ctx.config,
                    collectionId: readOp.collectionId,
                    pageId: entry.id,
                  });
                  const data = yield* readJsonlFile({
                    fs: ctx.fs,
                    path: dataPath,
                  });
                  const pageStats = yield* ctx.fs.stat(dataPath);
                  return {
                    id: entry.id,
                    collectionId: readOp.collectionId,
                    size: Number(pageStats.size),
                    count: data.length,
                    data,
                  };
                }),
              ),
              { concurrency: "unbounded" },
            );

            sendAck({
              session,
              ack: makeAck({
                requestId: event.requestId,
                sessionId: event.sessionId,
                data: { pages: pageResults },
              }),
            });
          }),
        );
        return;
      }

      case "blob.read": {
        yield* ctx.blobMutex.withPermits(1)(
          Effect.gen(function* () {
            const exists = yield* ctx.fs.exists(
              paths.blob({ config: ctx.config, blobId: readOp.blobId }),
            );
            if (!exists) {
              sendAck({
                session,
                ack: makeErrorAck({
                  requestId: event.requestId,
                  sessionId: event.sessionId,
                  _tag: "NotFoundError",
                  message: `Blob ${readOp.blobId} not found`,
                }),
              });
              return;
            }

            const data = yield* ctx.fs.readFile(
              paths.blobData({ config: ctx.config, blobId: readOp.blobId }),
            );

            sendAck({
              session,
              ack: makeAck({
                requestId: event.requestId,
                sessionId: event.sessionId,
                data: { data },
              }),
            });
          }),
        );
        return;
      }
    }
  });
