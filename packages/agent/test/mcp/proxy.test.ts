import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateProxyScript, writeProxyScript } from "../../src/mcp/proxy-template.ts";

const TEST_SOCKET = join(tmpdir(), `zenbu-test-proxy-${process.pid}.sock`);

function cleanup() {
  if (existsSync(TEST_SOCKET)) {
    try { unlinkSync(TEST_SOCKET); } catch {}
  }
}

describe("MCP Proxy Script", () => {
  let server: Server | null = null;
  let child: ChildProcess | null = null;

  afterEach(async () => {
    child?.kill();
    child = null;
    await new Promise<void>((r) => {
      if (server) server.close(() => r());
      else r();
    });
    server = null;
    cleanup();
  });

  it("generates valid JS source with the socket path embedded", () => {
    const src = generateProxyScript("/tmp/test.sock");
    expect(src).toContain("/tmp/test.sock");
    expect(src).toContain("net.connect");
    expect(src).toContain("process.stdin.pipe");
  });

  it("writeProxyScript creates a file and returns its path", () => {
    const path = writeProxyScript("/tmp/test.sock");
    expect(existsSync(path)).toBe(true);
    expect(path.endsWith(".cjs")).toBe(true);
  });

  it("forwards stdin to socket and socket to stdout", async () => {
    const received: string[] = [];

    await new Promise<void>((resolve, reject) => {
      server = createServer((conn) => {
        let buf = "";
        conn.on("data", (chunk) => {
          buf += chunk.toString();
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            received.push(buf.slice(0, idx));
            buf = buf.slice(idx + 1);
          }
        });
        setTimeout(() => {
          conn.write(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } }) + "\n");
        }, 50);
      });
      server.listen(TEST_SOCKET, resolve);
      server.on("error", reject);
    });

    const scriptPath = writeProxyScript(TEST_SOCKET);
    child = spawn("node", [scriptPath], { stdio: ["pipe", "pipe", "pipe"] });

    const stdout = await new Promise<string>((resolve, reject) => {
      let out = "";
      child!.stdout!.on("data", (chunk) => {
        out += chunk.toString();
        if (out.includes("\n")) resolve(out);
      });
      child!.on("error", reject);

      const msg = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" });
      child!.stdin!.write(msg + "\n");
    });

    expect(received.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(received[0]);
    expect(parsed.method).toBe("ping");

    const response = JSON.parse(stdout.trim());
    expect(response.result).toEqual({ ok: true });
  });

  it("exits when stdin closes", async () => {
    await new Promise<void>((resolve, reject) => {
      server = createServer(() => {});
      server.listen(TEST_SOCKET, resolve);
      server.on("error", reject);
    });

    const scriptPath = writeProxyScript(TEST_SOCKET);
    child = spawn("node", [scriptPath], { stdio: ["pipe", "pipe", "pipe"] });

    const exitCode = await new Promise<number | null>((resolve) => {
      child!.on("exit", (code) => resolve(code));
      setTimeout(() => child!.stdin!.end(), 100);
    });

    expect(exitCode).toBe(0);
    child = null;
  });
});
