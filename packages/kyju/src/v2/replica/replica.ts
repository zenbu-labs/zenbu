import { Effect, Fiber, Ref, Stream, SubscriptionRef } from "effect";
import { nanoid } from "nanoid";
import {
  type Ack,
  type BlobCreateOp,
  type BlobDeleteOp,
  type BlobSetOp,
  type ClientBlob,
  type ClientCollection,
  type ClientEvent,
  type ClientPage,
  type ClientState,
  type CollectionCreateOp,
  type CollectionDeleteOp,
  type CollectionReadAck,
  type ConnectAck,
  type SubscribeAck,
  type BlobReadAck,
  type KyjuJSON,
  type RootSetOp,
  type ServerEvent,
  type WriteOp,
  ClientStateRef,
  MaxPageSizeContext,
  SendContext,
  VERSION,
} from "../shared";
import {
  applyState,
  makeRequestAwaiter,
  requireConnected,
  setAtPath,
} from "./helpers";

const concatToCollection = ({
  col,
  items,
  maxPageSizeBytes,
}: {
  col: ClientCollection;
  items: KyjuJSON[];
  maxPageSizeBytes: number;
}): ClientCollection => {
  if (items.length === 0) return col;
  const pages = [...col.pages];
  const lastPage = pages[pages.length - 1];
  if (!lastPage || lastPage.data.kind === "cold") return col;

  if (lastPage.currentSize >= maxPageSizeBytes) {
    pages.push({
      id: nanoid(),
      data: { kind: "hot", items: [...items] },
      currentSize: 0,
    });
  } else {
    pages[pages.length - 1] = {
      ...lastPage,
      data: {
        kind: "hot",
        items: [...lastPage.data.items, ...items],
      },
    };
  }

  return { ...col, pages, totalCount: col.totalCount + items.length };
};

const applyRootSet = (ref: Ref.Ref<ClientState>, op: RootSetOp) =>
  applyState({
    ref,
    fn: (state) => ({
      ...state,
      root: setAtPath({ root: state.root, path: op.path, value: op.value }),
    }),
  });

const applyCollectionCreate = (
  ref: Ref.Ref<ClientState>,
  op: CollectionCreateOp,
) => {
  const initialPage: ClientPage = {
    id: nanoid(),
    data: { kind: "hot", items: op.data ?? [] },
    currentSize: 0,
  };
  const collection: ClientCollection = {
    id: op.collectionId,
    pages: [initialPage],
    totalCount: op.data?.length ?? 0,
  };
  return applyState({
    ref,
    fn: (state) => ({
      ...state,
      collections: [...state.collections, collection],
    }),
  });
};

const applyCollectionDelete = (
  ref: Ref.Ref<ClientState>,
  op: CollectionDeleteOp,
) =>
  applyState({
    ref,
    fn: (state) => ({
      ...state,
      collections: state.collections.filter(
        (col) => col.id !== op.collectionId,
      ),
    }),
  });

const applyBlobCreate = (ref: Ref.Ref<ClientState>, op: BlobCreateOp) => {
  const blob: ClientBlob = {
    id: op.blobId,
    data: op.hot ? { kind: "hot", value: op.data } : { kind: "cold" },
    fileSize: 0,
  };
  return applyState({
    ref,
    fn: (state) => ({
      ...state,
      blobs: [...state.blobs, blob],
    }),
  });
};

const applyBlobSet = (ref: Ref.Ref<ClientState>, op: BlobSetOp) =>
  applyState({
    ref,
    fn: (state) => ({
      ...state,
      blobs: state.blobs.map((blob) => {
        if (blob.id !== op.blobId) return blob;
        if (blob.data.kind === "hot") {
          return {
            ...blob,
            data: { kind: "hot" as const, value: op.data },
          };
        }
        return blob;
      }),
    }),
  });

const applyBlobDelete = (ref: Ref.Ref<ClientState>, op: BlobDeleteOp) =>
  applyState({
    ref,
    fn: (state) => ({
      ...state,
      blobs: state.blobs.filter((blob) => blob.id !== op.blobId),
    }),
  });

const applyWrite = ({
  stateRef,
  op,
  maxPageSizeBytes,
}: {
  stateRef: Ref.Ref<ClientState>;
  op: WriteOp;
  maxPageSizeBytes: number;
}) => {
  switch (op.type) {
    case "root.set":
      return applyRootSet(stateRef, op);
    case "collection.create":
      return applyCollectionCreate(stateRef, op);
    case "collection.concat":
      return applyState({
        ref: stateRef,
        fn: (state) => ({
          ...state,
          collections: state.collections.map((col) =>
            col.id === op.collectionId
              ? concatToCollection({ col, items: op.data, maxPageSizeBytes })
              : col,
          ),
        }),
      });
    case "collection.delete":
      return applyCollectionDelete(stateRef, op);
    case "blob.create":
      return applyBlobCreate(stateRef, op);
    case "blob.set":
      return applyBlobSet(stateRef, op);
    case "blob.delete":
      return applyBlobDelete(stateRef, op);
  }
  op satisfies never;
};

const applyReplicatedWrite = ({
  stateRef,
  op,
  maxPageSizeBytes,
}: {
  stateRef: Ref.Ref<ClientState>;
  op: WriteOp;
  maxPageSizeBytes: number;
}) => {
  switch (op.type) {
    case "root.set":
      return applyRootSet(stateRef, op);
    case "collection.create":
      return applyCollectionCreate(stateRef, op);
    case "collection.concat": {
      const startIndex = op.authority?.startIndex ?? 0;
      return applyState({
        ref: stateRef,
        fn: (state) => ({
          ...state,
          collections: state.collections.map((col) => {
            if (col.id !== op.collectionId) return col;
            const updated = concatToCollection({
              col,
              items: op.data,
              maxPageSizeBytes,
            });
            return {
              ...updated,
              totalCount: Math.max(
                updated.totalCount,
                startIndex + op.data.length,
              ),
            };
          }),
        }),
      });
    }
    case "collection.delete":
      return applyCollectionDelete(stateRef, op);
    case "blob.create":
      return applyBlobCreate(stateRef, op);
    case "blob.set":
      return applyBlobSet(stateRef, op);
    case "blob.delete":
      return applyBlobDelete(stateRef, op);
  }
  op satisfies never;
};

export type CollectionConcatCallback = (data: {
  collectionId: string;
  newItems: KyjuJSON[];
  collection: ClientCollection;
}) => void;

const createReplicaEffect = (
  replicaId: string,
  collectionCallbacks: Map<string, Set<CollectionConcatCallback>>,
) =>
  Effect.gen(function* () {
    const awaiter = makeRequestAwaiter();
    const stateRef = yield* ClientStateRef;
    const { maxPageSizeBytes } = yield* MaxPageSizeContext;
    // todo: no positional params
    const sendToServer = <T extends Ack<any, any>>(
      event: ServerEvent,
      requestId: string,
    ) =>
      Effect.gen(function* () {
        const { send } = yield* SendContext;
        const promise = awaiter.await<T>(requestId);
        send(event);
        return yield* Effect.promise(() => promise);
      });

    const mergeSubscribePages = (ack: SubscribeAck, collectionId: string) =>
      applyState({
        ref: stateRef,
        fn: (state) => {
          const pages: ClientPage[] = ack.pages.map((page) => ({
            id: page.id,
            data: { kind: "hot" as const, items: page.data },
            currentSize: page.size,
          }));
          const totalCount = ack.pages.reduce(
            (sum, page) => sum + page.count,
            0,
          );
          const entry: ClientCollection = { id: collectionId, pages, totalCount };
          const exists = state.collections.some((col) => col.id === collectionId);
          return {
            ...state,
            collections: exists
              ? state.collections.map((col) =>
                  col.id === collectionId ? entry : col,
                )
              : [...state.collections, entry],
          };
        },
      });

    const notifyConcatCallbacks = (op: WriteOp) =>
      Effect.gen(function* () {
        if (op.type !== "collection.concat") return;
        const cbs = collectionCallbacks.get(op.collectionId);
        if (!cbs || cbs.size === 0) return;
        const currentState = yield* Ref.get(stateRef);
        if (currentState.kind !== "connected") return;
        const col = currentState.collections.find(
          (c) => c.id === op.collectionId,
        );
        if (!col) return;
        for (const cb of cbs) {
          cb({
            collectionId: op.collectionId,
            newItems: op.data,
            collection: col,
          });
        }
      });

    const postMessage = (event: ClientEvent) =>
      Effect.gen(function* () {
        switch (event.kind) {
          case "connect": {
            const requestId = nanoid();
            const ack = yield* sendToServer<ConnectAck>(
              {
                kind: "connect",
                message: {
                  type: "connect",
                  version: event.version,
                  requestId,
                  replicaId,
                },
              },
              requestId,
            );
            if (ack.error) return yield* Effect.fail(ack.error);

            yield* Ref.set(stateRef, {
              kind: "connected" as const,
              sessionId: ack.sessionId,
              root: ack.root,
              collections: [],
              blobs: [],
            });
            return;
          }

          case "disconnect": {
            const state = yield* requireConnected({ ref: stateRef });
            const requestId = nanoid();
            const ack = yield* sendToServer<Ack<any, any>>(
              {
                kind: "disconnect",
                replicaId,
                message: {
                  type: "disconnect",
                  sessionId: state.sessionId,
                  requestId,
                },
              },
              requestId,
            );
            if (ack.error) return yield* Effect.fail(ack.error);

            yield* Ref.set(stateRef, { kind: "disconnected" as const });
            return;
          }

          case "subscribe-collection": {
            const state = yield* requireConnected({ ref: stateRef });
            const requestId = nanoid();
            const ack = yield* sendToServer<SubscribeAck>(
              {
                kind: "subscribe-collection",
                collectionId: event.collectionId,
                pageIds: event.pageIds,
                sessionId: state.sessionId,
                requestId,
                replicaId,
              },
              requestId,
            );
            if (ack.error) return yield* Effect.fail(ack.error);

            yield* mergeSubscribePages(ack, event.collectionId);
            return;
          }

          case "unsubscribe-collection": {
            const state = yield* requireConnected({ ref: stateRef });
            const requestId = nanoid();
            yield* sendToServer<Ack<any, any>>(
              {
                kind: "unsubscribe-collection",
                collectionId: event.collectionId,
                sessionId: state.sessionId,
                requestId,
                replicaId,
              },
              requestId,
            );

            yield* applyState({
              ref: stateRef,
              fn: (s) => ({
                ...s,
                collections: s.collections.filter(
                  (col) => col.id !== event.collectionId,
                ),
              }),
            });
            return;
          }

          case "write": {
            const state = yield* requireConnected({ ref: stateRef });
            yield* applyWrite({ stateRef, op: event.op, maxPageSizeBytes });
            yield* notifyConcatCallbacks(event.op);
            const writeRequestId = nanoid();
            const writeAck = yield* sendToServer<Ack>(
              {
                kind: "write",
                op: event.op,
                sessionId: state.sessionId,
                requestId: writeRequestId,
                replicaId,
              },
              writeRequestId,
            );
            if (writeAck.error) return yield* Effect.fail(writeAck.error);
            return;
          }

          case "replicated-write": {
            yield* requireConnected({ ref: stateRef });
            yield* applyReplicatedWrite({
              stateRef,
              op: event.op,
              maxPageSizeBytes,
            });
            yield* notifyConcatCallbacks(event.op);
            return;
          }

          case "read": {
            const readState = yield* requireConnected({ ref: stateRef });
            const readRequestId = nanoid();
            const readOp = event.op;

            switch (readOp.type) {
              case "collection.read": {
                const ack = yield* sendToServer<CollectionReadAck>(
                  {
                    kind: "read",
                    op: readOp,
                    sessionId: readState.sessionId,
                    requestId: readRequestId,
                    replicaId,
                  },
                  readRequestId,
                );
                if (ack.error) return yield* Effect.fail(ack.error);

                yield* applyState({
                  ref: stateRef,
                  fn: (state) => {
                    const newPages: ClientPage[] = ack.pages.map((page) => ({
                      id: page.id,
                      data: { kind: "hot" as const, items: page.data },
                      currentSize: page.size,
                    }));

                    const existing = state.collections.find(
                      (col) => col.id === readOp.collectionId,
                    );

                    const mergedPages = existing ? [...existing.pages] : [];
                    for (const np of newPages) {
                      const idx = mergedPages.findIndex((p) => p.id === np.id);
                      if (idx >= 0) {
                        mergedPages[idx] = np;
                      } else {
                        mergedPages.push(np);
                      }
                    }

                    const entry: ClientCollection = {
                      id: readOp.collectionId,
                      pages: mergedPages,
                      totalCount: existing?.totalCount ?? mergedPages.reduce(
                        (sum, p) => sum + (p.data.kind === "hot" ? p.data.items.length : 0),
                        0,
                      ),
                    };

                    return {
                      ...state,
                      collections: existing
                        ? state.collections.map((col) =>
                            col.id === readOp.collectionId ? entry : col,
                          )
                        : [...state.collections, entry],
                    };
                  },
                });
                return;
              }

              case "blob.read": {
                const ack = yield* sendToServer<BlobReadAck>(
                  {
                    kind: "read",
                    op: readOp,
                    sessionId: readState.sessionId,
                    requestId: readRequestId,
                    replicaId,
                  },
                  readRequestId,
                );
                if (ack.error) return yield* Effect.fail(ack.error);

                yield* applyState({
                  ref: stateRef,
                  fn: (state) => {
                    const entry: ClientBlob = {
                      id: readOp.blobId,
                      data: { kind: "hot" as const, value: ack.data },
                      fileSize: 0,
                    };
                    const exists = state.blobs.some(
                      (b) => b.id === readOp.blobId,
                    );
                    return {
                      ...state,
                      blobs: exists
                        ? state.blobs.map((b) =>
                            b.id === readOp.blobId ? entry : b,
                          )
                        : [...state.blobs, entry],
                    };
                  },
                });
                return;
              }
            }
            readOp satisfies never;
          }

          case "db-update": {
            const msg = event.message;

            if (msg.type === "ack") {
              awaiter.resolve(msg);
              return;
            }

            yield* requireConnected({ ref: stateRef });

            switch (msg.type) {
              case "collection.page.metadataUpdate": {
                yield* applyState({
                  ref: stateRef,
                  fn: (state) => ({
                    ...state,
                    collections: state.collections.map((col) => ({
                      ...col,
                      pages: col.pages.map((page) =>
                        page.id === msg.pageId
                          ? { ...page, currentSize: msg.fileSize }
                          : page,
                      ),
                    })),
                  }),
                });
                return;
              }

              case "blob.metadataUpdate": {
                yield* applyState({
                  ref: stateRef,
                  fn: (state) => ({
                    ...state,
                    blobs: state.blobs.map((blob) =>
                      blob.id === msg.blobId
                        ? { ...blob, fileSize: msg.fileSize }
                        : blob,
                    ),
                  }),
                });
                return;
              }

              case "reconnect": {
                const reconState = yield* requireConnected({ ref: stateRef });
                const disconnectId = nanoid();
                const disconnectAck = yield* sendToServer<Ack<any, any>>(
                  {
                    kind: "disconnect",
                    replicaId,
                    message: {
                      type: "disconnect",
                      sessionId: reconState.sessionId,
                      requestId: disconnectId,
                    },
                  },
                  disconnectId,
                );
                if (disconnectAck.error)
                  return yield* Effect.fail(disconnectAck.error);

                yield* Ref.set(stateRef, { kind: "disconnected" as const });

                const connectId = nanoid();
                const connectAck = yield* sendToServer<ConnectAck>(
                  {
                    kind: "connect",
                    message: {
                      type: "connect",
                      version: VERSION,
                      requestId: connectId,
                      replicaId,
                    },
                  },
                  connectId,
                );
                if (connectAck.error)
                  return yield* Effect.fail(connectAck.error);

                yield* Ref.set(stateRef, {
                  kind: "connected" as const,
                  sessionId: connectAck.sessionId,
                  root: connectAck.root,
                  collections: [],
                  blobs: [],
                });
                return;
              }
            }
            msg satisfies never;
          }
        }
        event satisfies never;
      });

    return { postMessage };
  });

export type CreateReplicaArgs = {
  send: (event: ServerEvent) => void;
  maxPageSizeBytes: number;
  replicaId?: string;
};

export const createReplica = (args: CreateReplicaArgs) => {
  const replicaId = args.replicaId ?? nanoid();
  const stateRef = Effect.runSync(
    SubscriptionRef.make<ClientState>({ kind: "disconnected" }),
  );
  const collectionCallbacks = new Map<string, Set<CollectionConcatCallback>>();

  const provide = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(SendContext, { send: args.send }),
      Effect.provideService(ClientStateRef, stateRef),
      Effect.provideService(MaxPageSizeContext, {
        maxPageSizeBytes: args.maxPageSizeBytes,
      }),
    );

  const { postMessage: rawPostMessageEffect } = Effect.runSync(
    provide(createReplicaEffect(replicaId, collectionCallbacks)),
  );

  const postMessageEffect = (event: ClientEvent) =>
    provide(rawPostMessageEffect(event));

  const postMessage = (event: ClientEvent): Promise<void> =>
    Effect.runPromise(postMessageEffect(event).pipe(Effect.catchAll(() => Effect.void)));

  const onCollectionConcat = (collectionId: string, cb: CollectionConcatCallback) => {
    let cbs = collectionCallbacks.get(collectionId);
    if (!cbs) {
      cbs = new Set();
      collectionCallbacks.set(collectionId, cbs);
    }
    cbs.add(cb);
  };

  const offCollectionConcat = (collectionId: string, cb: CollectionConcatCallback) => {
    const cbs = collectionCallbacks.get(collectionId);
    if (cbs) {
      cbs.delete(cb);
      if (cbs.size === 0) collectionCallbacks.delete(collectionId);
    }
  };

  const getState = (): ClientState => Effect.runSync(Ref.get(stateRef));

  const _forceState = (state: ClientState) => {
    Effect.runSync(Ref.set(stateRef, state));
  };

  const subscribe = (cb: (state: ClientState) => void): (() => void) => {
    const fiber = Effect.runFork(
      Stream.runForEach(stateRef.changes, (state) =>
        Effect.sync(() => cb(state)),
      ),
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  };

  return { postMessage, postMessageEffect, getState, _forceState, subscribe, replicaId, onCollectionConcat, offCollectionConcat };
};
