import { Effect, Ref } from "effect";
import { nanoid } from "nanoid";
import type { ServerEvent } from "../../shared";
import type { ClientProxy } from "../../client/client";
import type { SchemaShape } from "../schema";
import type { Session } from "../helpers";
import { paths, readJsonFile } from "../helpers";
import { createReplica } from "../../replica/replica";
import { createClient } from "../../client/client";
import type { DbHandlerContext } from "../helpers";

export type PluginContext = {
  client: ClientProxy<SchemaShape>;
  pluginPath: string[];
};

export type DbPlugin = {
  name: string;
  onBeforeStart?: (ctx: PluginContext) => Promise<void>;
};

export const runPlugins = (
  ctx: DbHandlerContext,
  postMessageEffect: (event: ServerEvent) => Effect.Effect<void, never, never>,
  plugins: DbPlugin[],
) =>
  Effect.gen(function* () {
    const sessionId = nanoid();
    const root = yield* readJsonFile({
      fs: ctx.fs,
      path: paths.root({ config: ctx.config }),
    });

    const replica = createReplica({
      send: (event) => {
        Effect.runPromise(postMessageEffect(event));
      },
      maxPageSizeBytes: ctx.config.maxPageSize,
    });

    const session: Session = {
      sessionId,
      replicaId: replica.replicaId,
      subscriptions: new Set(),
      send: (event) => {
        replica.postMessage(event);
      },
    };

    yield* Ref.update(ctx.sessionsRef, (s) => {
      const next = new Map(s);
      next.set(sessionId, session);
      return next;
    });

    replica._forceState({
      kind: "connected" as const,
      sessionId,
      root,
      collections: [],
      blobs: [],
    });

    const client = createClient<SchemaShape>(replica);

    for (const plugin of plugins) {
      if (!plugin.onBeforeStart) continue;
      yield* Effect.promise(() =>
        plugin.onBeforeStart!({
          client,
          pluginPath: ["_plugins", plugin.name],
        }),
      );
    }

    return replica;
  });
