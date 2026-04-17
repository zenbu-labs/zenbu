import { spawn, type ChildProcess } from "node:child_process";
import readline from "node:readline";
import { z } from "zod";

const RpcResponse = z.object({
  id: z.number(),
  result: z.unknown().optional(),
  error: z
    .object({
      message: z.string().optional(),
      code: z.number().optional(),
      data: z.unknown().optional(),
    })
    .optional(),
});

const RpcNotification = z.object({
  method: z.string(),
  params: z.unknown().optional(),
});

const RpcServerRequest = z.object({
  id: z.number(),
  method: z.string(),
  params: z.unknown().optional(),
});

export type NotificationHandler = (method: string, params: unknown) => void;
export type ServerRequestHandler = (
  method: string,
  id: number,
  params: unknown,
) => void;

export interface CodexTransport {
  sendRequest<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T>;
  sendNotification(method: string, params?: Record<string, unknown>): void;
  onNotification(handler: NotificationHandler): () => void;
  onServerRequest(handler: ServerRequestHandler): () => void;
  respondToServerRequest(id: number, result: Record<string, unknown>): void;
  close(): void;
  readonly proc: ChildProcess;
}

export function createCodexTransport(cwd?: string): CodexTransport {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;

  const proc = spawn("codex", ["app-server"], {
    cwd: cwd ?? process.cwd(),
    stdio: ["pipe", "pipe", "inherit"],
    env,
  });

  const rl = readline.createInterface({ input: proc.stdout! });
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  const notifHandlers = new Set<NotificationHandler>();
  const serverRequestHandlers = new Set<ServerRequestHandler>();

  rl.on("line", (line) => {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      return;
    }

    const serverRequest = RpcServerRequest.safeParse(raw);
    if (serverRequest.success) {
      const req = serverRequest.data;
      if (pending.has(req.id)) {
        const p = pending.get(req.id)!;
        pending.delete(req.id);
        p.resolve(undefined);
      } else {
        for (const h of serverRequestHandlers)
          h(req.method, req.id, req.params);
      }
      return;
    }

    const response = RpcResponse.safeParse(raw);
    if (response.success) {
      const res = response.data;
      const p = pending.get(res.id);
      if (!p) return;
      pending.delete(res.id);
      if (res.error) {
        p.reject(new Error(res.error.message ?? JSON.stringify(res.error)));
      } else {
        p.resolve(res.result);
      }
      return;
    }

    const notification = RpcNotification.safeParse(raw);
    if (notification.success) {
      const notif = notification.data;
      for (const h of notifHandlers) h(notif.method, notif.params);
      return;
    }
  });

  proc.on("error", (err) => {
    for (const [, p] of pending) {
      p.reject(new Error(`Codex process error: ${err.message}`));
    }
    pending.clear();
  });

  proc.on("close", () => {
    for (const [, p] of pending) {
      p.reject(new Error("Codex process closed unexpectedly"));
    }
    pending.clear();
  });

  function write(obj: Record<string, unknown>): void {
    proc.stdin!.write(JSON.stringify(obj) + "\n");
  }

  function sendRequest<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      write({ method, id, params: params ?? {} });
    });
  }

  function sendNotification(
    method: string,
    params?: Record<string, unknown>,
  ): void {
    write({ method, params: params ?? {} });
  }

  function onNotification(handler: NotificationHandler): () => void {
    notifHandlers.add(handler);
    return () => notifHandlers.delete(handler);
  }

  function onServerRequest(handler: ServerRequestHandler): () => void {
    serverRequestHandlers.add(handler);
    return () => serverRequestHandlers.delete(handler);
  }

  function respondToServerRequest(
    id: number,
    result: Record<string, unknown>,
  ): void {
    write({ id, result });
  }

  function close(): void {
    proc.kill();
  }

  return {
    sendRequest,
    sendNotification,
    onNotification,
    onServerRequest,
    respondToServerRequest,
    close,
    proc,
  };
}
