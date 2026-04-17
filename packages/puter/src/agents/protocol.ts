import { spawn, type ChildProcess } from "node:child_process";
import readline from "node:readline";

export type NotificationHandler = (method: string, params: any) => void;

export interface JsonRpcTransport {
  sendRequest(method: string, params?: any): Promise<any>;
  sendNotification(method: string, params?: any): void;
  onNotification(handler: NotificationHandler): () => void;
  close(): void;
  readonly proc: ChildProcess;
}

export interface SpawnOpts {
  command: string;
  args: string[];
  cwd?: string;
}

export function createTransport(opts: SpawnOpts): JsonRpcTransport {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;

  const proc = spawn(opts.command, opts.args, {
    cwd: opts.cwd ?? process.cwd(),
    stdio: ["pipe", "pipe", "inherit"],
    env,
  });

  const rl = readline.createInterface({ input: proc.stdout! });
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();
  const notifHandlers = new Set<NotificationHandler>();

  rl.on("line", (line) => {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    if ("id" in msg && pending.has(msg.id)) {
      const p = pending.get(msg.id)!;
      pending.delete(msg.id);
      if (msg.error) {
        p.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
      } else {
        p.resolve(msg.result);
      }
    } else if ("method" in msg && !("id" in msg)) {
      for (const h of notifHandlers) h(msg.method, msg.params);
    } else if ("method" in msg && "id" in msg) {
      // Server-initiated request -- auto-approve for headless usage
      send({ id: msg.id, result: { approved: true } });
    }
  });

  proc.on("error", (err) => {
    for (const [, p] of pending) {
      p.reject(new Error(`Process error: ${err.message}`));
    }
    pending.clear();
  });

  proc.on("close", () => {
    for (const [, p] of pending) {
      p.reject(new Error("Process closed unexpectedly"));
    }
    pending.clear();
  });

  function send(obj: any): void {
    proc.stdin!.write(JSON.stringify(obj) + "\n");
  }

  function sendRequest(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      send({ method, id, params: params ?? {} });
    });
  }

  function sendNotification(method: string, params?: any): void {
    send({ method, params: params ?? {} });
  }

  function onNotification(handler: NotificationHandler): () => void {
    notifHandlers.add(handler);
    return () => {
      notifHandlers.delete(handler);
    };
  }

  function close(): void {
    proc.kill();
  }

  return { sendRequest, sendNotification, onNotification, close, proc };
}

/**
 * Build a well-formed Codex app-server request object.
 * Exported for testing/validation.
 */
export function buildCodexRequest(
  method: string,
  id: number,
  params: Record<string, any>
): Record<string, any> {
  return { method, id, params };
}

/**
 * Build a well-formed ACP (opencode) request object per JSON-RPC 2.0.
 * Exported for testing/validation.
 */
export function buildAcpRequest(
  method: string,
  id: number,
  params: Record<string, any>
): Record<string, any> {
  return { jsonrpc: "2.0", method, id, params };
}

/**
 * Build a well-formed Codex notification (no id).
 */
export function buildCodexNotification(
  method: string,
  params: Record<string, any> = {}
): Record<string, any> {
  return { method, params };
}

/**
 * Build a well-formed ACP notification (no id, with jsonrpc header).
 */
export function buildAcpNotification(
  method: string,
  params: Record<string, any> = {}
): Record<string, any> {
  return { jsonrpc: "2.0", method, params };
}
