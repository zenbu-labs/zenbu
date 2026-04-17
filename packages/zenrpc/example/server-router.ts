import { Data, Effect } from "effect";
import type { RpcContext } from "../src/types";

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  id: string;
}> {}

export class InsufficientFundsError extends Data.TaggedError("InsufficientFundsError")<{
  balance: number;
  requested: number;
}> {}

const users = new Map([
  ["u1", { id: "u1", name: "Alice", balance: 100 }],
  ["u2", { id: "u2", name: "Bob", balance: 50 }],
]);

export const serverRouter = (getCtx: () => RpcContext) => ({
  greet: (name: string) => `Hello ${name}, you are ${getCtx().clientId}`,

  users: {
    get: (id: string) =>
      Effect.gen(function* () {
        const user = users.get(id);
        if (!user) return yield* new NotFoundError({ id });
        return user;
      }),

    list: () => [...users.values()],

    transfer: (fromId: string, toId: string, amount: number) =>
      Effect.gen(function* () {
        const from = users.get(fromId);
        if (!from) return yield* new NotFoundError({ id: fromId });
        const to = users.get(toId);
        if (!to) return yield* new NotFoundError({ id: toId });
        if (from.balance < amount) {
          return yield* new InsufficientFundsError({
            balance: from.balance,
            requested: amount,
          });
        }
        from.balance -= amount;
        to.balance += amount;
        return { from: from.balance, to: to.balance };
      }),
  },

  echo: (value: unknown) => value,
});

export type ServerRouter = ReturnType<typeof serverRouter>;
