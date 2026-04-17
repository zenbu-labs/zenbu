type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export const createPendingRequests = () => {
  const pending = new Map<string, PendingRequest>();

  return {
    add: (id: string): Promise<unknown> =>
      new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      }),

    resolve: (id: string, value: unknown) => {
      const entry = pending.get(id);
      if (entry) {
        pending.delete(id);
        entry.resolve(value);
      }
    },

    reject: (id: string, error: Error) => {
      const entry = pending.get(id);
      if (entry) {
        pending.delete(id);
        entry.reject(error);
      }
    },

    rejectAll: (error: Error) => {
      for (const [id, entry] of pending) {
        entry.reject(error);
      }
      pending.clear();
    },

    has: (id: string) => pending.has(id),
    size: () => pending.size,
  };
};
