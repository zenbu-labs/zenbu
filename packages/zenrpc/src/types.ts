import type { Effect } from "effect";

export type AnyRouter = {
  [key: string]: ((...args: any[]) => any) | AnyRouter;
};

export type AnyRouterFactory = (getCtx: () => RpcContext) => AnyRouter;

export type RpcContext = {
  clientId: string;
};

/**
 * Strips Error/Effect internals from a tagged error type, keeping _tag
 * and user-defined data fields. Excludes stack, name, cause, symbols,
 * and function-valued properties.
 */
export type SerializedError<E> = E extends { readonly _tag: string }
  ? {
      [K in keyof E as K extends symbol
        ? never
        : K extends "stack" | "name" | "cause"
          ? never
          : E[K] extends (...args: any[]) => any
            ? never
            : K]: E[K];
    }
  : never;

/**
 * Result type for Effect-returning router methods.
 * Always wraps success in { _tag: "success", data: A }.
 * If E has tagged errors, they're added to the discriminated union.
 */
export type EffectResult<A, E> = [E] extends [never]
  ? { readonly _tag: "success"; readonly data: A }
  : { readonly _tag: "success"; readonly data: A } | SerializedError<E>;

/**
 * Recursively converts a router's methods into Promise-returning versions.
 */
export type RouterProxy<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? [R] extends [Effect.Effect<infer S, infer E, any>]
      ? (...args: A) => Promise<EffectResult<S, E>>
      : (...args: A) => Promise<Awaited<R>>
    : T[K] extends Record<string, any>
      ? RouterProxy<T[K]>
      : never;
};

/**
 * Recursively extracts the Effect requirements (R channel) from all methods
 * in a router tree. Used to constrain the runtime passed to createServer.
 */
export type ExtractRequirements<T> = T extends Record<string, any>
  ? {
      [K in keyof T]: T[K] extends (...args: any[]) => Effect.Effect<any, any, infer R>
        ? R
        : T[K] extends Record<string, any>
          ? ExtractRequirements<T[K]>
          : never;
    }[keyof T]
  : never;

/**
 * Recursively maps an event definition tree into subscribe proxies.
 * Every node is both navigable (for nesting) and subscribable (for leaf events).
 * In practice, only call .subscribe on leaf event nodes.
 */
export type EventProxy<T> = {
  [K in keyof T]: T[K] extends Record<string, any>
    ? EventProxy<T[K]> & { subscribe: (cb: (data: T[K]) => void) => () => void }
    : { subscribe: (cb: (data: T[K]) => void) => () => void };
};
