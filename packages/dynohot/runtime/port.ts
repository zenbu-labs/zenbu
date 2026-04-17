// This is used to allow other loaders in the chain to invalidate modules that they loaded.

/** @internal */
export const { port1, port2 } = new MessageChannel();

/** @internal */
export const url = import.meta.url;
