import type { EventListeners } from "./client";

export const createEventProxy = <T extends Record<string, any>>(
  listeners: EventListeners,
  currentPath: string[] = [],
): any =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === "symbol") return undefined;
        if (prop === "subscribe") {
          const key = currentPath.join(".");
          return (cb: (data: unknown) => void) => listeners.add(key, cb);
        }
        return createEventProxy(listeners, [...currentPath, prop as string]);
      },
    },
  );
