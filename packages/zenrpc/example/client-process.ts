/**
 * A client process. Owns the client router and connects to the server.
 * Only imports the server router TYPE — no runtime dependency on server code.
 */

import { MessagePort } from "node:worker_threads";
import { createClient } from "../src/client";
import { createClientRouter } from "./client-router";
import type { ServerRouter } from "./server-router";

const VERSION = "1.0.0";

export function startClient(clientId: string, label: string, port: MessagePort) {
  const client = createClient<ServerRouter>({
    router: createClientRouter(label),
    version: VERSION,
    clientId,
    send: (data) => port.postMessage(data),
  });

  port.on("message", (data: string) => client.postMessage(data));

  return client;
}
