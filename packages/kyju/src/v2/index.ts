export { createDb } from "./db/db";
export type { Db, CreateDbConfig, SectionConfig } from "./db/db";

export { createClient } from "./client/client";
export type { ClientProxy, CollectionNode, BlobNode, FieldNode, EffectFieldNode, EffectCollectionNode, EffectClientProxy, EffectArrayFieldNode } from "./client/client";

export { createReplica } from "./replica/replica";
export type { CreateReplicaArgs } from "./replica/replica";

export { createSchema, f } from "./db/schema";
export type { Schema, SchemaShape, InferSchema, InferRoot } from "./db/schema";

export { applyOperations } from "./migrations";
export type { KyjuMigration, MigrationOp } from "./migrations";

export { sectionMigrationPlugin } from "./core-plugins/migration";

export { createRouter, connectReplica } from "./transport";

export type {
  KyjuJSON,
  KyjuError,
  ErrorTag,
  InvalidSessionError,
  VersionMismatchError,
  NotFoundError,
  ReferenceExistsError,
  ClientState,
  ClientEvent,
  DbSendEvent,
  ServerEvent,
} from "./shared";
export { VERSION } from "./shared";
