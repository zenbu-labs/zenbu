import { describe, it, expect, afterEach } from "vitest";
import { connect, type Socket } from "node:net";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { McpSocketServer } from "../../src/mcp/server.ts";
import { defineTools } from "../../src/mcp/tools.ts";

const TEST_SOCKET = join(tmpdir(), `zenbu-test-server-${process.pid}.sock`);

function cleanup() {
  if (existsSync(TEST_SOCKET)) {
    try { unlinkSync(TEST_SOCKET); } catch {}
  }
}

function sendRequest(
  socket: Socket,
  method: string,
  id: number,
  params?: Record<string, unknown>,
): Promise<any> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        const parsed = JSON.parse(line);
        if (parsed.id !== undefined) {
          socket.off("data", onData);
          resolve(parsed);
          return;
        }
      }
    };
    socket.on("data", onData);
    socket.on("error", reject);
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    socket.write(msg + "\n");
  });
}

function connectToSocket(path: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = connect(path);
    sock.on("connect", () => resolve(sock));
    sock.on("error", reject);
  });
}

describe("McpSocketServer", () => {
  let server: McpSocketServer;
  let client: Socket | null = null;

  afterEach(async () => {
    client?.destroy();
    client = null;
    await server?.close();
    cleanup();
  });

  it("responds to initialize with protocol version and capabilities", async () => {
    server = new McpSocketServer();
    server.setImplementation(defineTools({}));
    await server.listen(TEST_SOCKET);

    client = await connectToSocket(TEST_SOCKET);
    const res = await sendRequest(client, "initialize", 0, {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0" },
    });

    expect(res.result.protocolVersion).toBe("2024-11-05");
    expect(res.result.capabilities).toEqual({ tools: { listChanged: true } });
    expect(res.result.serverInfo.name).toBe("zenbu-mcp");
  });

  it("responds to ping", async () => {
    server = new McpSocketServer();
    server.setImplementation(defineTools({}));
    await server.listen(TEST_SOCKET);

    client = await connectToSocket(TEST_SOCKET);
    const res = await sendRequest(client, "ping", 1);
    expect(res.result).toEqual({});
  });

  it("returns registered tools via tools/list", async () => {
    server = new McpSocketServer();
    server.setImplementation(
      defineTools({
        echo: {
          description: "Echo input",
          input: z.object({ text: z.string() }),
          handler: async ({ text }) => ({
            content: [{ type: "text" as const, text }],
          }),
        },
      }),
    );
    await server.listen(TEST_SOCKET);

    client = await connectToSocket(TEST_SOCKET);
    const res = await sendRequest(client, "tools/list", 2);
    expect(res.result.tools).toHaveLength(1);
    expect(res.result.tools[0].name).toBe("echo");
    expect(res.result.tools[0].description).toBe("Echo input");
  });

  it("executes a tool call via tools/call", async () => {
    server = new McpSocketServer();
    server.setImplementation(
      defineTools({
        echo: {
          description: "Echo input",
          input: z.object({ text: z.string() }),
          handler: async ({ text }) => ({
            content: [{ type: "text" as const, text }],
          }),
        },
      }),
    );
    await server.listen(TEST_SOCKET);

    client = await connectToSocket(TEST_SOCKET);
    const res = await sendRequest(client, "tools/call", 3, {
      name: "echo",
      arguments: { text: "hello world" },
    });
    expect(res.result.content).toEqual([{ type: "text", text: "hello world" }]);
  });

  it("returns error for unknown method", async () => {
    server = new McpSocketServer();
    server.setImplementation(defineTools({}));
    await server.listen(TEST_SOCKET);

    client = await connectToSocket(TEST_SOCKET);
    const res = await sendRequest(client, "unknown/method", 4);
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(-32601);
  });

  it("supports hot-swapping implementations", async () => {
    server = new McpSocketServer();

    const implV1 = defineTools({
      version: {
        description: "Get version",
        input: z.object({}),
        handler: async () => ({
          content: [{ type: "text" as const, text: "v1" }],
        }),
      },
    });
    const implV2 = defineTools({
      version: {
        description: "Get version",
        input: z.object({}),
        handler: async () => ({
          content: [{ type: "text" as const, text: "v2" }],
        }),
      },
    });

    server.setImplementation(implV1);
    await server.listen(TEST_SOCKET);
    client = await connectToSocket(TEST_SOCKET);

    const res1 = await sendRequest(client, "tools/call", 1, {
      name: "version",
      arguments: {},
    });
    expect(res1.result.content[0].text).toBe("v1");

    server.setImplementation(implV2);

    const res2 = await sendRequest(client, "tools/call", 2, {
      name: "version",
      arguments: {},
    });
    expect(res2.result.content[0].text).toBe("v2");
  });

  it("cleans up socket file on close", async () => {
    server = new McpSocketServer();
    server.setImplementation(defineTools({}));
    await server.listen(TEST_SOCKET);
    expect(existsSync(TEST_SOCKET)).toBe(true);

    await server.close();
    expect(existsSync(TEST_SOCKET)).toBe(false);
  });

  it("closing server kills existing client connections", async () => {
    server = new McpSocketServer();
    server.setImplementation(
      defineTools({
        ping: {
          description: "Ping",
          input: z.object({}),
          handler: async () => ({
            content: [{ type: "text" as const, text: "pong" }],
          }),
        },
      }),
    );
    await server.listen(TEST_SOCKET);
    client = await connectToSocket(TEST_SOCKET);

    const res = await sendRequest(client, "tools/call", 1, {
      name: "ping",
      arguments: {},
    });
    expect(res.result.content[0].text).toBe("pong");

    await server.close();

    const clientDead = await new Promise<boolean>((resolve) => {
      client!.once("close", () => resolve(true));
      setTimeout(() => resolve(false), 500);
    });
    expect(clientDead).toBe(true);
  });

  it("close + re-listen breaks existing clients (documents the HMR bug)", async () => {
    server = new McpSocketServer();
    const implV1 = defineTools({
      ping: {
        description: "Ping",
        input: z.object({}),
        handler: async () => ({
          content: [{ type: "text" as const, text: "v1" }],
        }),
      },
    });
    server.setImplementation(implV1);
    await server.listen(TEST_SOCKET);

    client = await connectToSocket(TEST_SOCKET);
    const res1 = await sendRequest(client, "tools/call", 1, {
      name: "ping",
      arguments: {},
    });
    expect(res1.result.content[0].text).toBe("v1");

    await server.close();

    server = new McpSocketServer();
    server.setImplementation(
      defineTools({
        ping: {
          description: "Ping",
          input: z.object({}),
          handler: async () => ({
            content: [{ type: "text" as const, text: "v2" }],
          }),
        },
      }),
    );
    await server.listen(TEST_SOCKET);

    const writeError = await new Promise<boolean>((resolve) => {
      try {
        client!.write(
          JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "ping", arguments: {} } }) + "\n",
        );
        client!.once("error", () => resolve(true));
        client!.once("data", () => resolve(false));
        setTimeout(() => resolve(true), 500);
      } catch {
        resolve(true);
      }
    });
    expect(writeError).toBe(true);
  });

  it("sends notifications/tools/list_changed when implementation changes", async () => {
    server = new McpSocketServer();
    server.setImplementation(
      defineTools({
        v1: {
          description: "Version 1 tool",
          input: z.object({}),
          handler: async () => ({
            content: [{ type: "text" as const, text: "v1" }],
          }),
        },
      }),
    );
    await server.listen(TEST_SOCKET);
    client = await connectToSocket(TEST_SOCKET);

    await sendRequest(client, "initialize", 0, {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0" },
    });

    const notificationPromise = new Promise<any>((resolve) => {
      let buf = "";
      const onData = (chunk: Buffer) => {
        buf += chunk.toString();
        const idx = buf.indexOf("\n");
        if (idx !== -1) {
          client!.off("data", onData);
          resolve(JSON.parse(buf.slice(0, idx)));
        }
      };
      client!.on("data", onData);
    });

    server.setImplementation(
      defineTools({
        v2: {
          description: "Version 2 tool",
          input: z.object({}),
          handler: async () => ({
            content: [{ type: "text" as const, text: "v2" }],
          }),
        },
      }),
    );

    const notification = await notificationPromise;
    expect(notification.jsonrpc).toBe("2.0");
    expect(notification.method).toBe("notifications/tools/list_changed");
    expect(notification.id).toBeUndefined();
  });

  it("setImplementation preserves connections (correct HMR behavior)", async () => {
    server = new McpSocketServer();
    const implV1 = defineTools({
      ping: {
        description: "Ping",
        input: z.object({}),
        handler: async () => ({
          content: [{ type: "text" as const, text: "v1" }],
        }),
      },
    });
    server.setImplementation(implV1);
    await server.listen(TEST_SOCKET);

    client = await connectToSocket(TEST_SOCKET);
    const res1 = await sendRequest(client, "tools/call", 1, {
      name: "ping",
      arguments: {},
    });
    expect(res1.result.content[0].text).toBe("v1");

    server.setImplementation(
      defineTools({
        ping: {
          description: "Ping",
          input: z.object({}),
          handler: async () => ({
            content: [{ type: "text" as const, text: "v2" }],
          }),
        },
      }),
    );

    const res2 = await sendRequest(client, "tools/call", 2, {
      name: "ping",
      arguments: {},
    });
    expect(res2.result.content[0].text).toBe("v2");

    server.setImplementation(
      defineTools({
        ping: {
          description: "Ping",
          input: z.object({}),
          handler: async () => ({
            content: [{ type: "text" as const, text: "v3" }],
          }),
        },
      }),
    );

    const res3 = await sendRequest(client, "tools/call", 3, {
      name: "ping",
      arguments: {},
    });
    expect(res3.result.content[0].text).toBe("v3");
  });
});
