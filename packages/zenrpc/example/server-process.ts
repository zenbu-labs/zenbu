/**
 * The server process. Owns the server router and manages client connections.
 * Only imports the client router TYPE — no runtime dependency on client code.
 *
 * Clients self-register through the handshake — no explicit addClient needed.
 */

import { createServer } from "../src/server";
import { serverRouter } from "./server-router";
import type { ClientRouter } from "./client-router";

const VERSION = "1.0.0";

export function startServer(send: (data: string, clientId: string) => void) {
  return createServer<ClientRouter>({
    router: serverRouter,
    version: VERSION,
    send,
  });
}
