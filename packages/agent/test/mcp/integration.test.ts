import { describe, it, expect, afterEach } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { McpSocketServer } from "../../src/mcp/server.ts";
import { defineTools } from "../../src/mcp/tools.ts";
import { writeProxyScript } from "../../src/mcp/proxy-template.ts";

const TEST_SOCKET = join(tmpdir(), `zenbu-test-integ-${process.pid}.sock`);

function cleanup() {
  if (existsSync(TEST_SOCKET)) {
    try { unlinkSync(TEST_SOCKET); } catch {}
  }
}

function sendViaProxy(
  child: ChildProcess,
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
          child.stdout!.off("data", onData);
          resolve(parsed);
          return;
        }
      }
    };
    child.stdout!.on("data", onData);
    child.on("error", reject);
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    child.stdin!.write(msg + "\n");
  });
}

describe("MCP Integration (proxy + server)", () => {
  let server: McpSocketServer;
  let child: ChildProcess | null = null;

  afterEach(async () => {
    child?.kill();
    child = null;
    await server?.close();
    cleanup();
  });

  it("full initialize -> tools/list -> tools/call flow through proxy", async () => {
    server = new McpSocketServer();
    server.setImplementation(
      defineTools({
        greet: {
          description: "Greet someone",
          input: z.object({ name: z.string() }),
          handler: async ({ name }) => ({
            content: [{ type: "text" as const, text: `Hello ${name}!` }],
          }),
        },
        multiply: {
          description: "Multiply two numbers",
          input: z.object({ a: z.number(), b: z.number() }),
          handler: async ({ a, b }) => ({
            content: [{ type: "text" as const, text: String(a * b) }],
          }),
        },
      }),
    );
    await server.listen(TEST_SOCKET);

    const scriptPath = writeProxyScript(TEST_SOCKET);
    child = spawn("node", [scriptPath], { stdio: ["pipe", "pipe", "pipe"] });

    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    const initRes = await sendViaProxy(child, "initialize", 0, {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0" },
    });
    expect(initRes.result.protocolVersion).toBe("2024-11-05");
    expect(initRes.result.capabilities.tools).toBeDefined();

    const listRes = await sendViaProxy(child, "tools/list", 1);
    expect(listRes.result.tools).toHaveLength(2);
    const toolNames = listRes.result.tools.map((t: any) => t.name).sort();
    expect(toolNames).toEqual(["greet", "multiply"]);

    const callRes = await sendViaProxy(child, "tools/call", 2, {
      name: "greet",
      arguments: { name: "World" },
    });
    expect(callRes.result.content).toEqual([{ type: "text", text: "Hello World!" }]);

    const mathRes = await sendViaProxy(child, "tools/call", 3, {
      name: "multiply",
      arguments: { a: 6, b: 7 },
    });
    expect(mathRes.result.content).toEqual([{ type: "text", text: "42" }]);
  });

  it("handles tool call errors through the proxy", async () => {
    server = new McpSocketServer();
    server.setImplementation(
      defineTools({
        strict: {
          description: "Requires a number",
          input: z.object({ value: z.number() }),
          handler: async ({ value }) => ({
            content: [{ type: "text" as const, text: String(value) }],
          }),
        },
      }),
    );
    await server.listen(TEST_SOCKET);

    const scriptPath = writeProxyScript(TEST_SOCKET);
    child = spawn("node", [scriptPath], { stdio: ["pipe", "pipe", "pipe"] });

    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    const res = await sendViaProxy(child, "tools/call", 1, {
      name: "strict",
      arguments: { value: "not-a-number" },
    });
    expect(res.result.isError).toBe(true);
  });

  it("supports hot-swap through the proxy", async () => {
    const implV1 = defineTools({
      version: {
        description: "Version",
        input: z.object({}),
        handler: async () => ({
          content: [{ type: "text" as const, text: "v1" }],
        }),
      },
    });

    server = new McpSocketServer();
    server.setImplementation(implV1);
    await server.listen(TEST_SOCKET);

    const scriptPath = writeProxyScript(TEST_SOCKET);
    child = spawn("node", [scriptPath], { stdio: ["pipe", "pipe", "pipe"] });

    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    const res1 = await sendViaProxy(child, "tools/call", 1, {
      name: "version",
      arguments: {},
    });
    expect(res1.result.content[0].text).toBe("v1");

    server.setImplementation(
      defineTools({
        version: {
          description: "Version",
          input: z.object({}),
          handler: async () => ({
            content: [{ type: "text" as const, text: "v2" }],
          }),
        },
      }),
    );

    const res2 = await sendViaProxy(child, "tools/call", 2, {
      name: "version",
      arguments: {},
    });
    expect(res2.result.content[0].text).toBe("v2");
  });
});
