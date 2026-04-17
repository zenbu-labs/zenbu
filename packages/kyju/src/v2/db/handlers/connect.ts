import { Effect, Ref } from "effect";
import { nanoid } from "nanoid";
import type { ServerEvent } from "../../shared";
import { VERSION } from "../../shared";
import type { Session } from "../helpers";
import { makeAck, makeErrorAck, paths, readJsonFile, sendAck } from "../helpers";
import type { DbHandlerContext } from "../helpers";

type ConnectEvent = Extract<ServerEvent, { kind: "connect" }>;

export const handleConnect = (
  ctx: DbHandlerContext,
  event: ConnectEvent,
  latch: Effect.Latch,
) =>
  latch.whenOpen(
    Effect.gen(function* () {
      const msg = event.message;
      const { replicaId } = msg;

      if (msg.version !== VERSION) {
        ctx.dbSend({
          kind: "db-update",
          replicaId,
          message: makeErrorAck({
            requestId: msg.requestId,
            _tag: "VersionMismatchError",
            message: `Expected version ${VERSION}, got ${msg.version}`,
          }),
        });
        return;
      }

      const sessionId = nanoid();
      const root = yield* readJsonFile({
        fs: ctx.fs,
        path: paths.root({ config: ctx.config }),
      });

      const session: Session = {
        sessionId,
        replicaId,
        subscriptions: new Set(),
        send: (event) => ctx.dbSend({ ...event, replicaId }),
      };
      yield* Ref.update(ctx.sessionsRef, (sessions) => {
        const next = new Map(sessions);
        next.set(sessionId, session);
        return next;
      });

      sendAck({
        session,
        ack: makeAck({
          requestId: msg.requestId,
          sessionId,
          data: { root },
        }),
      });
    }),
  );
