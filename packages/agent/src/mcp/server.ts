import { createServer, type Server, type Socket } from "node:net";
import { unlinkSync, existsSync } from "node:fs";
import {
  type ToolImplementation,
  type ToolContext,
  toolsToListResponse,
  handleToolCall,
} from "./tools.ts";

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export class McpSocketServer<TCtx extends ToolContext = ToolContext> {
  private server: Server | null = null;
  private socketPath: string | null = null;
  private impl: ToolImplementation<TCtx> | null = null;
  private ctxFactory: (() => TCtx) | null = null;
  private connections = new Set<Socket>();
  private negotiatedVersion: string = SUPPORTED_PROTOCOL_VERSIONS[0];

  setImplementation(impl: ToolImplementation<TCtx>, ctxFactory?: () => TCtx): void {
    this.impl = impl;
    if (ctxFactory) this.ctxFactory = ctxFactory;
    this.notifyToolsChanged();
  }

  private notifyToolsChanged(): void {
    const notification = JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/tools/list_changed",
    }) + "\n";
    for (const conn of this.connections) {
      conn.write(notification);
    }
  }

  listen(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (existsSync(socketPath)) {
        try { unlinkSync(socketPath); } catch {}
      }

      this.socketPath = socketPath;
      this.server = createServer((socket) => {
        this.connections.add(socket);
        let buffer = "";

        socket.on("data", (chunk) => {
          buffer += chunk.toString();
          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            if (line.length === 0) continue;
            this.handleLine(line, socket);
          }
        });

        socket.on("close", () => {
          this.connections.delete(socket);
        });

        socket.on("error", () => {
          this.connections.delete(socket);
        });
      });

      this.server.on("error", reject);
      this.server.listen(socketPath, () => resolve());
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      for (const conn of this.connections) {
        conn.destroy();
      }
      this.connections.clear();

      if (this.server) {
        this.server.close(() => {
          if (this.socketPath && existsSync(this.socketPath)) {
            try { unlinkSync(this.socketPath); } catch {}
          }
          this.server = null;
          this.socketPath = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleLine(line: string, socket: Socket): void {
    let msg: JsonRpcRequest;
    try {
      msg = JSON.parse(line);
    } catch {
      this.sendError(socket, null, -32700, "Parse error");
      return;
    }

    if (msg.jsonrpc !== "2.0") {
      this.sendError(socket, msg.id ?? null, -32600, "Invalid Request");
      return;
    }

    if (msg.id === undefined || msg.id === null) {
      // Notification — no response required
      return;
    }

    this.handleRequest(msg, socket);
  }

  private handleRequest(msg: JsonRpcRequest, socket: Socket): void {
    switch (msg.method) {
      case "initialize":
        this.handleInitialize(msg, socket);
        break;
      case "ping":
        this.sendResult(socket, msg.id!, {});
        break;
      case "tools/list":
        this.handleToolsList(msg, socket);
        break;
      case "tools/call":
        this.handleToolsCall(msg, socket);
        break;
      default:
        this.sendError(socket, msg.id!, -32601, `Method not found: ${msg.method}`);
    }
  }

  private handleInitialize(msg: JsonRpcRequest, socket: Socket): void {
    const params = msg.params ?? {};
    const clientVersion = params.protocolVersion as string | undefined;
    this.negotiatedVersion =
      clientVersion && SUPPORTED_PROTOCOL_VERSIONS.includes(clientVersion)
        ? clientVersion
        : SUPPORTED_PROTOCOL_VERSIONS[0];

    this.sendResult(socket, msg.id!, {
      protocolVersion: this.negotiatedVersion,
      capabilities: { tools: { listChanged: true } },
      serverInfo: { name: "zenbu-mcp", version: "1.0.0" },
    });
  }

  private handleToolsList(msg: JsonRpcRequest, socket: Socket): void {
    if (!this.impl) {
      this.sendResult(socket, msg.id!, { tools: [] });
      return;
    }
    this.sendResult(socket, msg.id!, toolsToListResponse(this.impl));
  }

  private handleToolsCall(msg: JsonRpcRequest, socket: Socket): void {
    if (!this.impl) {
      this.sendError(socket, msg.id!, -32603, "No tool implementation registered");
      return;
    }

    const params = msg.params ?? {};
    const name = params.name as string;
    const args = params.arguments ?? {};
    const ctx = this.ctxFactory ? this.ctxFactory() : ({} as TCtx);

    handleToolCall(this.impl, name, args, ctx)
      .then((result) => this.sendResult(socket, msg.id!, result))
      .catch((err) =>
        this.sendResult(socket, msg.id!, {
          content: [{ type: "text", text: `Internal error: ${err?.message ?? String(err)}` }],
          isError: true,
        }),
      );
  }

  private sendResult(socket: Socket, id: string | number, result: unknown): void {
    const response: JsonRpcResponse = { jsonrpc: "2.0", id, result };
    socket.write(JSON.stringify(response) + "\n");
  }

  private sendError(
    socket: Socket,
    id: string | number | null,
    code: number,
    message: string,
  ): void {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: id ?? 0,
      error: { code, message },
    };
    socket.write(JSON.stringify(response) + "\n");
  }
}
