import { Context, Ref, SubscriptionRef } from "effect";

export const VERSION = 0;

export type KyjuJSON =
  | string
  | number
  | boolean
  | null
  | KyjuJSON[]
  | { [key: string]: KyjuJSON };

export type InvalidSessionError = {
  readonly _tag: "InvalidSessionError";
  readonly message: string;
};

export type VersionMismatchError = {
  readonly _tag: "VersionMismatchError";
  readonly message: string;
};

export type NotFoundError = {
  readonly _tag: "NotFoundError";
  readonly message: string;
};

export type ReferenceExistsError = {
  readonly _tag: "ReferenceExistsError";
  readonly message: string;
};

export type KyjuError =
  | InvalidSessionError
  | VersionMismatchError
  | NotFoundError
  | ReferenceExistsError;

export type ErrorTag = KyjuError["_tag"];

export type Ack<T extends {} = {}, E extends ErrorTag = never> = {
  type: "ack";
  requestId: string;
  sessionId: string;
  error?: Extract<KyjuError, { _tag: E }>;
} & T;

export type RootSetOp = {
  type: "root.set";
  path: string[];
  value: KyjuJSON;
};

export type CollectionCreateOp = {
  type: "collection.create";
  collectionId: string;
  data?: KyjuJSON[];
};

export type CollectionConcatOp = {
  type: "collection.concat";
  collectionId: string;
  data: KyjuJSON[];
  authority?: { startIndex: number };
};

export type CollectionDeleteOp = {
  type: "collection.delete";
  collectionId: string;
};

export type BlobCreateOp = {
  type: "blob.create";
  blobId: string;
  data: Uint8Array;
  hot?: boolean;
};

export type BlobSetOp = {
  type: "blob.set";
  blobId: string;
  data: Uint8Array;
};

export type BlobDeleteOp = {
  type: "blob.delete";
  blobId: string;
};

export type WriteOp =
  | RootSetOp
  | CollectionCreateOp
  | CollectionConcatOp
  | CollectionDeleteOp
  | BlobCreateOp
  | BlobSetOp
  | BlobDeleteOp;


export type CollectionReadOp = {
  type: "collection.read";
  collectionId: string;
  range?: { start: number; end: number };
};

export type BlobReadOp = {
  type: "blob.read";
  blobId: string;
};

export type ReadOp = CollectionReadOp | BlobReadOp;

export type PageMetadataUpdate = {
  type: "collection.page.metadataUpdate";
  pageId: string;
  fileSize: number;
};

export type BlobMetadataUpdate = {
  type: "blob.metadataUpdate";
  blobId: string;
  fileSize: number;
};

export type ReconnectUpdate = {
  type: "reconnect";
};

export type DbUpdateMessage =
  | Ack
  | PageMetadataUpdate
  | BlobMetadataUpdate
  | ReconnectUpdate;

export type ConnectAck = Ack<{ root: KyjuJSON }, "VersionMismatchError">;
export type CollectionReadAck = Ack<{ pages: WirePage[] }, "NotFoundError">;
export type SubscribeAck = Ack<{ pages: WirePage[] }, "NotFoundError">;
export type BlobReadAck = Ack<{ data: Uint8Array }, "NotFoundError">;

export type WirePage = {
  id: string;
  collectionId: string;
  size: number;
  count: number;
  data: KyjuJSON[];
};

export type ClientEvent =
  | { kind: "connect"; version: number }
  | { kind: "disconnect" }
  | { kind: "subscribe-collection"; collectionId: string; pageIds?: string[] }
  | { kind: "unsubscribe-collection"; collectionId: string }
  | { kind: "write"; op: WriteOp }
  | { kind: "replicated-write"; op: WriteOp }
  | { kind: "read"; op: ReadOp }
  | { kind: "db-update"; message: DbUpdateMessage };

export type DbSendEvent = ClientEvent & { replicaId: string };

export type ServerEvent =
  | {
      kind: "connect";
      message: {
        type: "connect";
        version: number;
        requestId: string;
        replicaId: string;
      };
    }
  | {
      kind: "disconnect";
      message: { type: "disconnect"; sessionId: string; requestId: string };
      replicaId: string;
    }
  | {
      kind: "subscribe-collection";
      collectionId: string;
      pageIds?: string[];
      sessionId: string;
      requestId: string;
      replicaId: string;
    }
  | {
      kind: "unsubscribe-collection";
      collectionId: string;
      sessionId: string;
      requestId: string;
      replicaId: string;
    }
  | {
      kind: "write";
      op: WriteOp;
      sessionId: string;
      requestId: string;
      replicaId: string;
    }
  | {
      kind: "read";
      op: ReadOp;
      sessionId: string;
      requestId: string;
      replicaId: string;
    };

export type PageData = { kind: "hot"; items: KyjuJSON[] } | { kind: "cold" };

export type ClientPage = {
  id: string;
  data: PageData;
  currentSize: number;
};

export type ClientCollection = {
  id: string;
  pages: ClientPage[];
  totalCount: number;
};

export type BlobData = { kind: "hot"; value: Uint8Array } | { kind: "cold" };

export type ClientBlob = {
  id: string;
  data: BlobData;
  fileSize: number;
};

export type ClientState =
  | {
      kind: "connected";
      sessionId: string;
      root: KyjuJSON;
      collections: ClientCollection[];
      blobs: ClientBlob[];
    }
  | { kind: "disconnected" };

export const SendContext = Context.GenericTag<{
  send: (event: ServerEvent) => void;
}>("SendContext");

export const ClientStateRef =
  Context.GenericTag<SubscriptionRef.SubscriptionRef<ClientState>>("ClientStateRef");

export const MaxPageSizeContext = Context.GenericTag<{
  maxPageSizeBytes: number;
}>("MaxPageSizeContext");

