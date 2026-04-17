import { Effect } from "effect";
import nodePath from "node:path";
import type { ServerEvent } from "../../shared";
import {
  type CollectionIndex,
  type PageIndex,
  createCollection,
  makeAck,
  makeErrorAck,
  paths,
  readJsonlFile,
  sendAck,
} from "../helpers";
import { type DbHandlerContext, validateSession } from "../helpers";

type SubscribeEvent = Extract<ServerEvent, { kind: "subscribe-collection" }>;

export const handleSubscribe = (ctx: DbHandlerContext, event: SubscribeEvent) =>
  Effect.gen(function* () {
    const session = yield* validateSession(ctx, event.sessionId, event.requestId, event.replicaId);

    yield* ctx.collectionMutex.withPermits(1)(
      Effect.gen(function* () {
        const collectionDir = paths.collection({
          config: ctx.config,
          collectionId: event.collectionId,
        });
        const exists = yield* ctx.fs.exists(collectionDir);
        if (!exists) {
          yield* createCollection({
            fs: ctx.fs,
            config: ctx.config,
            collectionId: event.collectionId,
          });
        }

        session.subscriptions.add(event.collectionId);

        if (event.pageIds) {
          const pageResults = yield* Effect.all(
            event.pageIds.map((pageId) =>
              Effect.gen(function* () {
                const dataPath = paths.pageData({
                  config: ctx.config,
                  collectionId: event.collectionId,
                  pageId,
                });
                const data = yield* readJsonlFile({ fs: ctx.fs, path: dataPath });
                const pageStats = yield* ctx.fs.stat(dataPath);
                return {
                  id: pageId,
                  collectionId: event.collectionId,
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
        } else {
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
                      collectionId: event.collectionId,
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

          const pageResults = yield* Effect.all(
            sorted.map((entry) =>
              Effect.gen(function* () {
                const dataPath = paths.pageData({
                  config: ctx.config,
                  collectionId: event.collectionId,
                  pageId: entry.id,
                });
                const data = yield* readJsonlFile({
                  fs: ctx.fs,
                  path: dataPath,
                });
                const pageStats = yield* ctx.fs.stat(dataPath);
                return {
                  id: entry.id,
                  collectionId: event.collectionId,
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
        }
      }),
    );
  });
