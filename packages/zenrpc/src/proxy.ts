import { nanoid } from "nanoid";
import type { RouterProxy } from "./types";
import { serialize } from "./protocol";
import type { createPendingRequests } from "./pending";

type ProxyDeps = {
  send: (data: string) => void;
  pending: ReturnType<typeof createPendingRequests>;
};

export const createProxy = <T extends Record<string, any>>(
  deps: ProxyDeps,
): RouterProxy<T> => {
  const makeProxy = (currentPath: string[]): any => {
    return new Proxy(function () {}, {
      get(_target, prop, _receiver) {
        if (typeof prop === "symbol") return undefined;
        return makeProxy([...currentPath, prop as string]);
      },
      apply(_target, _thisArg, args: unknown[]) {
        const id = nanoid();
        const promise = deps.pending.add(id);
        deps.send(serialize({ type: "request", id, path: currentPath, args }));
        return promise;
      },
    });
  };

  return makeProxy([]) as RouterProxy<T>;
};
