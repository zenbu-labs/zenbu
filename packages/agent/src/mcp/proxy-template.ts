import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export function generateProxyScript(socketPath: string): string {
  return `"use strict";
const net = require("net");
const sock = net.connect(${JSON.stringify(socketPath)});
sock.on("connect", () => {
  process.stdin.pipe(sock);
  sock.pipe(process.stdout);
});
sock.on("error", (e) => {
  process.stderr.write("mcp-proxy error: " + e.message + "\\n");
  process.exit(1);
});
sock.on("close", () => process.exit(0));
process.stdin.on("end", () => sock.end());
`;
}

export function writeProxyScript(socketPath: string): string {
  const dir = join(tmpdir(), "zenbu-mcp-proxies");
  mkdirSync(dir, { recursive: true });
  const id = socketPath.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filePath = join(dir, `proxy-${id}.cjs`);
  writeFileSync(filePath, generateProxyScript(socketPath), "utf-8");
  return filePath;
}
