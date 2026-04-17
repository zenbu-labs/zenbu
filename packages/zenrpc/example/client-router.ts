export const createClientRouter = (label: string) => ({
  notify: (message: string) => {
    console.log(`  [${label}] notification: ${message}`);
    return "ack" as const;
  },
  window: {
    setTitle: (title: string) => {
      console.log(`  [${label}] title set to: ${title}`);
    },
    getTitle: () => `${label} window`,
  },
});

export type ClientRouter = ReturnType<typeof createClientRouter>;
