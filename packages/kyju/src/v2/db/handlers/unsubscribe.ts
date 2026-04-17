import { Effect } from "effect";
import type { ServerEvent } from "../../shared";
import { makeAck, sendAck } from "../helpers";
import { type DbHandlerContext, validateSession } from "../helpers";

type UnsubscribeEvent = Extract<ServerEvent, { kind: "unsubscribe-collection" }>;

export const handleUnsubscribe = (ctx: DbHandlerContext, event: UnsubscribeEvent) =>
  Effect.gen(function* () {
    const session = yield* validateSession(ctx, event.sessionId, event.requestId, event.replicaId);

    session.subscriptions.delete(event.collectionId);

    sendAck({
      session,
      ack: makeAck({
        requestId: event.requestId,
        sessionId: event.sessionId,
      }),
    });
  });
