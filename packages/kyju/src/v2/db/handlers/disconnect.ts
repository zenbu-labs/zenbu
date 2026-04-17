import { Effect, Ref } from "effect";
import type { ServerEvent } from "../../shared";
import { makeAck, makeErrorAck, sendAck } from "../helpers";
import type { DbHandlerContext } from "../helpers";

type DisconnectEvent = Extract<ServerEvent, { kind: "disconnect" }>;

export const handleDisconnect = (ctx: DbHandlerContext, event: DisconnectEvent) =>
  Effect.gen(function* () {
    const msg = event.message;
    const sessions = yield* Ref.get(ctx.sessionsRef);
    const session = sessions.get(msg.sessionId);
    if (!session) {
      ctx.dbSend({
        kind: "db-update",
        replicaId: event.replicaId,
        message: makeErrorAck({
          requestId: msg.requestId,
          sessionId: msg.sessionId,
          _tag: "InvalidSessionError",
          message: "Invalid session",
        }),
      });
      return yield* Effect.fail("INVALID_SESSION" as const);
    }

    yield* Ref.update(ctx.sessionsRef, (s) => {
      const next = new Map(s);
      next.delete(msg.sessionId);
      return next;
    });

    sendAck({
      session,
      ack: makeAck({
        requestId: msg.requestId,
        sessionId: msg.sessionId,
      }),
    });
  });
