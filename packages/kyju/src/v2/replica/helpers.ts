import { Effect, Ref } from "effect";
import type { Ack, ClientState, KyjuJSON } from "../shared";

type PendingRequest = {
  requestId: string;
  resolve: (ack: Ack<any, any>) => void;
};

export const makeRequestAwaiter = () => {
  const pending = new Map<string, PendingRequest>();

  return {
    resolve: (ack: Ack<any, any>) => {
      const entry = pending.get(ack.requestId);
      if (entry) {
        pending.delete(ack.requestId);
        entry.resolve(ack);
      }
    },
    await: <T extends Ack<any, any>>(requestId: string): Promise<T> =>
      new Promise<T>((resolve) => {
        pending.set(requestId, {
          requestId,
          resolve: resolve as (ack: Ack<any, any>) => void,
        });
      }),
  };
};

export const setAtPath = ({
  root,
  path,
  value,
}: {
  root: KyjuJSON;
  path: string[];
  value: KyjuJSON;
}): KyjuJSON => {
  if (path.length === 0) return value;

  const [head, ...rest] = path;
  const isIndex = /^\d+$/.test(head!);

  if (Array.isArray(root)) {
    /**
     * so react observes a new reference
     */
    const arr = [...root] as KyjuJSON[];
    const index = Number(head);
    if (rest.length === 0) {
      arr[index] = value;
      return arr;
    }
    const nextRoot = arr[index] ?? (/^\d+$/.test(rest[0] ?? "") ? [] : {});
    arr[index] = setAtPath({ root: nextRoot, path: rest, value });
    return arr;
  }

  if (typeof root !== "object" || root === null) {
    root = isIndex ? [] : {};
  }

  if (Array.isArray(root)) {
    const arr = [...root] as KyjuJSON[];
    const index = Number(head);
    if (rest.length === 0) {
      arr[index] = value;
      return arr;
    }
    const nextRoot = arr[index] ?? (/^\d+$/.test(rest[0] ?? "") ? [] : {});
    arr[index] = setAtPath({ root: nextRoot, path: rest, value });
    return arr;
  }

  const obj = { ...(root as { [key: string]: KyjuJSON }) };
  if (rest.length === 0) {
    obj[head!] = value;
    return obj;
  }
  obj[head!] = setAtPath({
    root: obj[head!] ?? (/^\d+$/.test(rest[0] ?? "") ? [] : {}),
    path: rest,
    value,
  });
  return obj;
};

export type ConnectedState = Extract<ClientState, { kind: "connected" }>;

export const requireConnected = ({ ref }: { ref: Ref.Ref<ClientState> }) =>
  Effect.gen(function* () {
    const state = yield* Ref.get(ref);
    if (state.kind === "disconnected") {
      return yield* Effect.die("Cannot process event: not connected");
    }
    return state;
  });

export const applyState = ({
  ref,
  fn,
}: {
  ref: Ref.Ref<ClientState>;
  fn: (state: ConnectedState) => ConnectedState;
}) =>
  Ref.update(ref, (current) => {
    if (current.kind === "disconnected") return current;
    return fn(current);
  });
