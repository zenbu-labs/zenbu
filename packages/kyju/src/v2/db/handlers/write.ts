import { Effect, Ref } from "effect";
import { nanoid } from "nanoid";
import type { KyjuJSON, ServerEvent } from "../../shared";
import {
  type CollectionIndex,
  type PageIndex,
  type BlobIndex,
  broadcastCollectionDbUpdate,
  broadcastCollectionWrite,
  broadcastDbUpdate,
  broadcastWrite,
  createBlob,
  createCollection,
  makeAck,
  makeErrorAck,
  paths,
  readJsonFile,
  sendAck,
  setAtPath,
  writeJsonFile,
} from "../helpers";
import { type DbHandlerContext, validateSession } from "../helpers";

type WriteEvent = Extract<ServerEvent, { kind: "write" }>;

export const handleWrite = (ctx: DbHandlerContext, event: WriteEvent) =>
  Effect.gen(function* () {
    const session = yield* validateSession(ctx, event.sessionId, event.requestId, event.replicaId);

    switch (event.op.type) {
      case "root.set": {
        const typedOp = event.op;
        yield* ctx.rootMutex.withPermits(1)(
          Effect.gen(function* () {
            const root = yield* readJsonFile({
              fs: ctx.fs,
              path: paths.root({ config: ctx.config }),
            });
            const updated = setAtPath({
              root,
              path: typedOp.path,
              value: typedOp.value,
            });
            yield* writeJsonFile({
              fs: ctx.fs,
              path: paths.root({ config: ctx.config }),
              data: updated,
            });
          }),
        );
        sendAck({
          session,
          ack: makeAck({
            requestId: event.requestId,
            sessionId: event.sessionId,
          }),
        });

        const sessions = yield* Ref.get(ctx.sessionsRef);
        broadcastWrite({
          sessions,
          excludeSessionId: event.sessionId,
          op: event.op,
        });
        return;
      }

      case "collection.create": {
        yield* createCollection({
          fs: ctx.fs,
          config: ctx.config,
          collectionId: event.op.collectionId,
          data: event.op.data,
        });

        sendAck({
          session,
          ack: makeAck({
            requestId: event.requestId,
            sessionId: event.sessionId,
          }),
        });

        const sessions = yield* Ref.get(ctx.sessionsRef);
        broadcastCollectionWrite({
          sessions,
          excludeSessionId: event.sessionId,
          collectionId: event.op.collectionId,
          op: event.op,
        });
        return;
      }

      case "collection.concat": {
        const typedOp = event.op;
        yield* ctx.collectionMutex.withPermits(1)(
          Effect.gen(function* () {
            if (typedOp.data.length === 0) {
              sendAck({
                session,
                ack: makeAck({
                  requestId: event.requestId,
                  sessionId: event.sessionId,
                }),
              });
              return;
            }

            const collectionDir = paths.collection({
              config: ctx.config,
              collectionId: typedOp.collectionId,
            });
            const collectionExists = yield* ctx.fs.exists(collectionDir);
            if (!collectionExists) {
              yield* createCollection({
                fs: ctx.fs,
                config: ctx.config,
                collectionId: typedOp.collectionId,
              });
            }

            const collectionIndexPath = paths.collectionIndex({
              config: ctx.config,
              collectionId: typedOp.collectionId,
            });
            const collectionIndex = JSON.parse(
              yield* ctx.fs.readFileString(collectionIndexPath),
            ) as CollectionIndex;
            let activePageId = collectionIndex.activePageId;

            const activeDataPath = paths.pageData({
              config: ctx.config,
              collectionId: typedOp.collectionId,
              pageId: activePageId,
            });
            const stats = yield* ctx.fs.stat(activeDataPath);
            const currentSize = Number(stats.size);

            const jsonlContent =
              typedOp.data
                .map((item) => JSON.stringify(item))
                .join("\n") + "\n";

            if (currentSize >= ctx.config.maxPageSize) {
              const newPageId = nanoid();
              yield* ctx.fs.makeDirectory(
                paths.page({
                  config: ctx.config,
                  collectionId: typedOp.collectionId,
                  pageId: newPageId,
                }),
                { recursive: true },
              );

              const pIndex: PageIndex = {
                pageId: newPageId,
                order: collectionIndex.totalPages,
              };
              yield* Effect.all([
                writeJsonFile({
                  fs: ctx.fs,
                  path: paths.pageIndex({
                    config: ctx.config,
                    collectionId: typedOp.collectionId,
                    pageId: newPageId,
                  }),
                  data: pIndex,
                }),
                ctx.fs.writeFileString(
                  paths.pageData({
                    config: ctx.config,
                    collectionId: typedOp.collectionId,
                    pageId: newPageId,
                  }),
                  jsonlContent,
                ),
              ]);

              collectionIndex.activePageId = newPageId;
              collectionIndex.totalPages += 1;
              activePageId = newPageId;
            } else {
              yield* Effect.scoped(
                Effect.gen(function* () {
                  const file = yield* ctx.fs.open(activeDataPath, { flag: "a" });
                  yield* file.write(new TextEncoder().encode(jsonlContent));
                }),
              );
            }

            const startIndex = collectionIndex.totalCount;
            collectionIndex.totalCount += typedOp.data.length;
            yield* writeJsonFile({
              fs: ctx.fs,
              path: collectionIndexPath,
              data: collectionIndex,
            });

            const newStats = yield* ctx.fs.stat(
              paths.pageData({
                config: ctx.config,
                collectionId: typedOp.collectionId,
                pageId: activePageId,
              }),
            );
            const newFileSize = Number(newStats.size);

            sendAck({
              session,
              ack: makeAck({
                requestId: event.requestId,
                sessionId: event.sessionId,
              }),
            });

            const sessions = yield* Ref.get(ctx.sessionsRef);
            broadcastCollectionWrite({
              sessions,
              excludeSessionId: event.sessionId,
              collectionId: typedOp.collectionId,
              op: { ...typedOp, authority: { startIndex } },
            });

            broadcastCollectionDbUpdate({
              sessions,
              collectionId: typedOp.collectionId,
              message: {
                type: "collection.page.metadataUpdate",
                pageId: activePageId,
                fileSize: newFileSize,
              },
            });
          }),
        );
        return;
      }

      case "collection.delete": {
        const typedOp = event.op;
        yield* ctx.collectionMutex.withPermits(1)(
          Effect.gen(function* () {
            const collectionDir = paths.collection({
              config: ctx.config,
              collectionId: typedOp.collectionId,
            });
            const exists = yield* ctx.fs.exists(collectionDir);
            if (!exists) {
              sendAck({
                session,
                ack: makeErrorAck({
                  requestId: event.requestId,
                  sessionId: event.sessionId,
                  _tag: "NotFoundError",
                  message: `Collection ${typedOp.collectionId} not found`,
                }),
              });
              return;
            }

            if (ctx.config.checkReferences) {
              const root = yield* readJsonFile({
                fs: ctx.fs,
                path: paths.root({ config: ctx.config }),
              });
              const hasRef = JSON.stringify(root).includes(typedOp.collectionId);
              if (hasRef) {
                sendAck({
                  session,
                  ack: makeErrorAck({
                    requestId: event.requestId,
                    sessionId: event.sessionId,
                    _tag: "ReferenceExistsError",
                    message: `Collection ${typedOp.collectionId} still has references`,
                  }),
                });
                return;
              }
            }

            yield* ctx.fs.remove(collectionDir, { recursive: true });

            sendAck({
              session,
              ack: makeAck({
                requestId: event.requestId,
                sessionId: event.sessionId,
              }),
            });

            const sessions = yield* Ref.get(ctx.sessionsRef);
            broadcastCollectionWrite({
              sessions,
              excludeSessionId: event.sessionId,
              collectionId: typedOp.collectionId,
              op: event.op,
            });

            for (const [, s] of sessions) {
              s.subscriptions.delete(typedOp.collectionId);
            }
          }),
        );
        return;
      }

      case "blob.create": {
        yield* createBlob({
          fs: ctx.fs,
          config: ctx.config,
          blobId: event.op.blobId,
          data: event.op.data,
        });

        sendAck({
          session,
          ack: makeAck({
            requestId: event.requestId,
            sessionId: event.sessionId,
          }),
        });

        const sessions = yield* Ref.get(ctx.sessionsRef);
        broadcastWrite({
          sessions,
          excludeSessionId: event.sessionId,
          op: event.op,
        });
        return;
      }

      case "blob.set": {
        const typedOp = event.op;
        yield* ctx.blobMutex.withPermits(1)(
          Effect.gen(function* () {
            const exists = yield* ctx.fs.exists(
              paths.blob({ config: ctx.config, blobId: typedOp.blobId }),
            );
            if (!exists) {
              sendAck({
                session,
                ack: makeErrorAck({
                  requestId: event.requestId,
                  sessionId: event.sessionId,
                  _tag: "NotFoundError",
                  message: `Blob ${typedOp.blobId} not found`,
                }),
              });
              return;
            }

            const dataPath = paths.blobData({
              config: ctx.config,
              blobId: typedOp.blobId,
            });
            yield* ctx.fs.writeFile(dataPath, typedOp.data);
            const blobStats = yield* ctx.fs.stat(dataPath);

            const bIdx: BlobIndex = {
              blobId: typedOp.blobId,
              fileSize: Number(blobStats.size),
            };
            yield* writeJsonFile({
              fs: ctx.fs,
              path: paths.blobIndex({ config: ctx.config, blobId: typedOp.blobId }),
              data: bIdx,
            });

            sendAck({
              session,
              ack: makeAck({
                requestId: event.requestId,
                sessionId: event.sessionId,
              }),
            });

            const sessions = yield* Ref.get(ctx.sessionsRef);
            broadcastWrite({
              sessions,
              excludeSessionId: event.sessionId,
              op: typedOp,
            });

            broadcastDbUpdate({
              sessions,
              message: {
                type: "blob.metadataUpdate",
                blobId: typedOp.blobId,
                fileSize: Number(blobStats.size),
              },
            });
          }),
        );
        return;
      }

      case "blob.delete": {
        const typedOp = event.op;
        yield* ctx.blobMutex.withPermits(1)(
          Effect.gen(function* () {
            const blobDir = paths.blob({
              config: ctx.config,
              blobId: typedOp.blobId,
            });
            const exists = yield* ctx.fs.exists(blobDir);
            if (!exists) {
              sendAck({
                session,
                ack: makeErrorAck({
                  requestId: event.requestId,
                  sessionId: event.sessionId,
                  _tag: "NotFoundError",
                  message: `Blob ${typedOp.blobId} not found`,
                }),
              });
              return;
            }

            if (ctx.config.checkReferences) {
              const root = yield* readJsonFile({
                fs: ctx.fs,
                path: paths.root({ config: ctx.config }),
              });
              const hasRef = JSON.stringify(root).includes(typedOp.blobId);
              if (hasRef) {
                sendAck({
                  session,
                  ack: makeErrorAck({
                    requestId: event.requestId,
                    sessionId: event.sessionId,
                    _tag: "ReferenceExistsError",
                    message: `Blob ${typedOp.blobId} still has references`,
                  }),
                });
                return;
              }
            }

            yield* ctx.fs.remove(blobDir, { recursive: true });

            sendAck({
              session,
              ack: makeAck({
                requestId: event.requestId,
                sessionId: event.sessionId,
              }),
            });

            const sessions = yield* Ref.get(ctx.sessionsRef);
            broadcastWrite({
              sessions,
              excludeSessionId: event.sessionId,
              op: event.op,
            });
          }),
        );
        return;
      }
    }
  });
