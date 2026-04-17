import { Data } from "effect";

export class VersionMismatchError extends Data.TaggedError("VersionMismatch")<{
  expected: string;
  received: string;
}> {}

export class ClientNotFoundError extends Data.TaggedError("ClientNotFound")<{
  clientId: string;
}> {}

export class RpcCallError extends Data.TaggedError("RpcCallError")<{
  message: string;
  path: string[];
}> {}

export class ClientDisconnectedError extends Data.TaggedError("ClientDisconnected")<{
  clientId: string;
}> {}

export class HandshakeError extends Data.TaggedError("HandshakeError")<{
  message: string;
}> {}
