import { Effect, Exit, Cause, Option } from "effect";
import { serialize } from "./protocol";
import type { AnyRouter } from "./types";

export const resolveMethod = (router: AnyRouter, path: string[]): Function => {
  let current: any = router;
  for (const segment of path) {
    current = current[segment];
    if (current === undefined) {
      throw new Error(`Method not found: ${path.join(".")}`);
    }
  }
  if (typeof current !== "function") {
    throw new Error(`Not a function: ${path.join(".")}`);
  }
  return current;
};

const serializeTaggedError = (error: Record<string, any>): Record<string, unknown> => {
  const result: Record<string, unknown> = { _tag: error._tag };
  for (const key of Object.keys(error)) {
    if (key === "stack" || key === "name" || key === "cause" || key === "_tag") continue;
    const value = error[key];
    if (typeof value === "function" || typeof value === "symbol") continue;
    result[key] = value;
  }
  return result;
};

const isTaggedError = (value: unknown): value is { _tag: string } =>
  value !== null &&
  typeof value === "object" &&
  "_tag" in value &&
  typeof (value as any)._tag === "string";

/**
 * Executes a router method and sends the response.
 * Handles plain sync/async returns and Effect returns:
 * - Effect success → { type: "response", result: { _tag: "success", data } }
 * - Effect tagged error → { type: "response", result: { _tag: errorTag, ...fields } }
 * - Effect defect → { type: "error-response" }
 * - Plain return → { type: "response", result }
 * - Thrown error → { type: "error-response" }
 */
export const executeMethod = async (args: {
  method: Function;
  methodArgs: unknown[];
  id: string;
  send: (data: string) => void;
  runtime?: { runPromiseExit: (effect: Effect.Effect<any, any, any>) => Promise<any> };
}) => {
  try {
    const returnValue = args.method(...args.methodArgs);

    if (Effect.isEffect(returnValue)) {
      const runExit = args.runtime
        ? (e: Effect.Effect<unknown, unknown>) => args.runtime!.runPromiseExit(e)
        : Effect.runPromiseExit;
      const exit = await runExit(returnValue as Effect.Effect<unknown, unknown>);

      if (Exit.isSuccess(exit)) {
        args.send(
          serialize({
            type: "response",
            id: args.id,
            result: { _tag: "success", data: exit.value },
          }),
        );
        return;
      }

      const failure = Cause.failureOption(exit.cause);
      if (Option.isSome(failure) && isTaggedError(failure.value)) {
        args.send(
          serialize({
            type: "response",
            id: args.id,
            result: serializeTaggedError(failure.value as Record<string, any>),
          }),
        );
        return;
      }

      let message: string;
      if (Option.isSome(failure)) {
        message =
          failure.value instanceof Error ? failure.value.message : String(failure.value);
      } else {
        const defect = Cause.dieOption(exit.cause);
        if (Option.isSome(defect)) {
          message =
            defect.value instanceof Error ? defect.value.message : String(defect.value);
        } else {
          message = "Unknown error";
        }
      }
      args.send(
        serialize({ type: "error-response", id: args.id, error: { message } }),
      );
    } else {
      const result = await returnValue;
      args.send(serialize({ type: "response", id: args.id, result }));
    }
  } catch (err) {
    console.error(`[zenrpc] method execution failed:`, err);
    args.send(
      serialize({
        type: "error-response",
        id: args.id,
        error: { message: err instanceof Error ? err.message : String(err) },
      }),
    );
  }
};
