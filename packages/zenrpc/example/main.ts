/**
 * ZenRPC example: two clients connected to one server over MessageChannels,
 * simulating separate processes that only share types across the boundary.
 *
 * Clients self-register via the handshake — the server auto-discovers them.
 *
 *   server-process.ts  ──MessageChannel──  client-process.ts (Window A)
 *                      ──MessageChannel──  client-process.ts (Window B)
 *
 * Run: npx tsx example/main.ts
 */

import { MessageChannel } from "node:worker_threads";
import { startServer } from "./server-process";
import { startClient } from "./client-process";

async function main() {
  // ── Transport layer ──
  // Each client gets its own MessageChannel. The server's send function
  // routes outgoing messages to the right port by clientId.
  const channels = new Map<string, MessageChannel>();

  function getOrCreateChannel(clientId: string) {
    if (!channels.has(clientId)) channels.set(clientId, new MessageChannel());
    return channels.get(clientId)!;
  }

  // ── Spawn the server ──
  const server = startServer((data, clientId) => {
    getOrCreateChannel(clientId).port1.postMessage(data);
  });

  // ── Wire each channel's server-side port to the server's postMessage ──
  function connectChannel(clientId: string) {
    const channel = getOrCreateChannel(clientId);
    channel.port1.on("message", (data: string) => {
      server.postMessage(data, clientId);
    });
    return channel.port2;
  }

  // ── Spawn two clients — they self-register via the handshake ──
  const clientA = startClient("window-a", "Window A", connectChannel("window-a"));
  const clientB = startClient("window-b", "Window B", connectChannel("window-b"));

  await Promise.all([clientA.ready, clientB.ready]);
  console.log("Both clients connected.\n");

  // ── 1. Plain method call ──
  console.log("── Plain RPC ──");
  const greeting = await clientA.server.greet("World");
  console.log(`  greet result: ${greeting}`);

  // ── 2. Nested method call ──
  console.log("\n── Nested RPC ──");
  const users = await clientA.server.users.list();
  console.log(`  users.list: ${JSON.stringify(users)}`);

  // ── 3. Effect method — success ──
  console.log("\n── Effect success ──");
  const userResult = await clientA.server.users.get("u1");
  if (userResult._tag === "success") {
    console.log(`  users.get("u1"): ${JSON.stringify(userResult.data)}`);
  }

  // ── 4. Effect method — expected error ──
  console.log("\n── Effect expected error ──");
  const missing = await clientA.server.users.get("u999");
  switch (missing._tag) {
    case "success":
      console.log(`  found user: ${JSON.stringify(missing.data)}`);
      break;
    case "NotFoundError":
      console.log(`  user not found: id=${missing.id}`);
      break;
  }

  // ── 5. Effect method — multiple error types ──
  console.log("\n── Effect multiple errors ──");
  const transfer = await clientB.server.users.transfer("u1", "u2", 9999);
  switch (transfer._tag) {
    case "success":
      console.log(`  transfer ok: ${JSON.stringify(transfer.data)}`);
      break;
    case "NotFoundError":
      console.log(`  user not found: id=${transfer.id}`);
      break;
    case "InsufficientFundsError":
      console.log(
        `  insufficient funds: balance=${transfer.balance}, requested=${transfer.requested}`,
      );
      break;
  }

  // ── 6. Server calls client (bidirectional) ──
  console.log("\n── Server -> Client RPC ──");
  const ack = await server.client("window-a").notify("deploy complete");
  console.log(`  notify returned: ${ack}`);

  // ── 7. Server calls nested client method ──
  console.log("\n── Server -> Client nested ──");
  const title = await server.client("window-b").window.getTitle();
  console.log(`  window-b title: ${title}`);
  await server.client("window-b").window.setTitle("Updated Title");

  // ── 8. Server targets multiple clients ──
  console.log("\n── Broadcast to all clients ──");
  const clientIds = ["window-a", "window-b"] as const;
  await Promise.all(
    clientIds.map((id) => server.client(id).notify("server shutting down")),
  );

  // ── 9. Disconnect ──
  console.log("\n── Cleanup ──");
  server.removeClient("window-a");
  server.removeClient("window-b");
  for (const ch of channels.values()) {
    ch.port1.close();
    ch.port2.close();
  }
  console.log("  Both clients removed, ports closed.");
}

main().catch(console.error);
