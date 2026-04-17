import { Effect, Ref } from "effect";
import * as acp from "@agentclientprotocol/sdk";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { Readable, Writable } from "node:stream";

export type AcpClientState =
  | "disconnected"
  | "initializing"
  | "ready"
  | "prompting";

export type SessionUpdateHandler = (event: acp.SessionNotification) => void;

export type AcpClientHandlers = {
  requestPermission?: (
    params: acp.RequestPermissionRequest,
  ) => Promise<acp.RequestPermissionResponse>;
  readTextFile?: (
    params: acp.ReadTextFileRequest,
  ) => Promise<acp.ReadTextFileResponse>;
  writeTextFile?: (
    params: acp.WriteTextFileRequest,
  ) => Promise<acp.WriteTextFileResponse>;
  createTerminal?: (
    params: acp.CreateTerminalRequest,
  ) => Promise<acp.CreateTerminalResponse>;
  terminalOutput?: (
    params: acp.TerminalOutputRequest,
  ) => Promise<acp.TerminalOutputResponse>;
  releaseTerminal?: (
    params: acp.ReleaseTerminalRequest,
  ) => Promise<acp.ReleaseTerminalResponse | void>;
  waitForTerminalExit?: (
    params: acp.WaitForTerminalExitRequest,
  ) => Promise<acp.WaitForTerminalExitResponse>;
  killTerminal?: (
    params: acp.KillTerminalRequest,
  ) => Promise<acp.KillTerminalResponse | void>;
};

export type SpawnOpts = {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
};

export type AcpClientConfig = SpawnOpts & {
  handlers?: AcpClientHandlers;
};

export { acp };
export const PROTOCOL_VERSION = acp.PROTOCOL_VERSION;

export class AcpClient {
  private stateRef: Ref.Ref<AcpClientState>;
  private sessionIdRef: Ref.Ref<string | null>;
  private connection: acp.ClientSideConnection;
  private updateHandlers: Set<SessionUpdateHandler>;
  private proc: ChildProcess;

  private constructor(
    stateRef: Ref.Ref<AcpClientState>,
    sessionIdRef: Ref.Ref<string | null>,
    connection: acp.ClientSideConnection,
    updateHandlers: Set<SessionUpdateHandler>,
    proc: ChildProcess,
  ) {
    this.stateRef = stateRef;
    this.sessionIdRef = sessionIdRef;
    this.connection = connection;
    this.updateHandlers = updateHandlers;
    this.proc = proc;
  }

  static create = (config: AcpClientConfig) =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make<AcpClientState>("disconnected");
      const sessionIdRef = yield* Ref.make<string | null>(null);
      const updateHandlers = new Set<SessionUpdateHandler>();

      const env = { ...process.env, ...config.env };
      delete env.NODE_OPTIONS;

      const proc = spawn(config.command, config.args, {
        cwd: config.cwd ?? process.cwd(),
        stdio: ["pipe", "pipe", "inherit"],
        env,
      });
      yield* Effect.tryPromise(() => once(proc as any, "spawn"));

      const input = Writable.toWeb(proc.stdin!) as WritableStream<Uint8Array>;
      const output = Readable.toWeb(proc.stdout!) as ReadableStream<Uint8Array>;
      const stream = acp.ndJsonStream(input, output);

      const connection = new acp.ClientSideConnection(
        () => ({
          sessionUpdate: async (params: acp.SessionNotification) => {
            for (const h of updateHandlers) h(params);
          },
          requestPermission: async (params: acp.RequestPermissionRequest) => {
            if (config.handlers?.requestPermission) {
              return config.handlers.requestPermission(params);
            }
            const option =
              params.options.find((o) => o.kind === "allow_always") ??
              params.options.find((o) => o.kind === "allow_once");
            if (option) {
              return {
                outcome: {
                  outcome: "selected" as const,
                  optionId: option.optionId,
                },
              };
            }
            return { outcome: { outcome: "cancelled" as const } };
          },
          readTextFile: async (params: acp.ReadTextFileRequest) => {
            if (config.handlers?.readTextFile) {
              return config.handlers.readTextFile(params);
            }
            return { content: "" };
          },
          writeTextFile: async (params: acp.WriteTextFileRequest) => {
            if (config.handlers?.writeTextFile) {
              return config.handlers.writeTextFile(params);
            }
            return {};
          },
          createTerminal: config.handlers?.createTerminal
            ? async (params: acp.CreateTerminalRequest) =>
                config.handlers!.createTerminal!(params)
            : undefined,
          terminalOutput: config.handlers?.terminalOutput
            ? async (params: acp.TerminalOutputRequest) =>
                config.handlers!.terminalOutput!(params)
            : undefined,
          releaseTerminal: config.handlers?.releaseTerminal
            ? async (params: acp.ReleaseTerminalRequest) =>
                config.handlers!.releaseTerminal!(params)
            : undefined,
          waitForTerminalExit: config.handlers?.waitForTerminalExit
            ? async (params: acp.WaitForTerminalExitRequest) =>
                config.handlers!.waitForTerminalExit!(params)
            : undefined,
          killTerminal: config.handlers?.killTerminal
            ? async (params: acp.KillTerminalRequest) =>
                config.handlers!.killTerminal!(params)
            : undefined,
        }),
        stream,
      );

      return new AcpClient(
        stateRef,
        sessionIdRef,
        connection,
        updateHandlers,
        proc,
      );
    });

  getState = () => Ref.get(this.stateRef);

  getSessionId = () => Ref.get(this.sessionIdRef);

  initialize = (params: acp.InitializeRequest) => {
    const { stateRef, connection } = this;
    return Effect.gen(function* () {
      yield* Ref.set(stateRef, "initializing");

      const result = yield* Effect.tryPromise(() =>
        connection.initialize(params),
      );

      return result;
    });
  };

  newSession = (params: acp.NewSessionRequest) => {
    const { stateRef, sessionIdRef, connection } = this;
    return Effect.gen(function* () {
      const result = yield* Effect.tryPromise(() =>
        connection.newSession(params),
      );
      yield* Ref.set(sessionIdRef, result.sessionId);
      yield* Ref.set(stateRef, "ready");
      return result;
    });
  };

  loadSession = (params: acp.LoadSessionRequest) => {
    const { stateRef, sessionIdRef, connection } = this;
    return Effect.gen(function* () {
      yield* Effect.tryPromise(() => connection.loadSession(params));
      yield* Ref.set(sessionIdRef, params.sessionId);
      yield* Ref.set(stateRef, "ready");
    });
  };

  resumeSession = (params: { sessionId: string; cwd: string; mcpServers?: acp.McpServer[] }) => {
    const { stateRef, sessionIdRef, connection } = this;
    return Effect.gen(function* () {
      yield* Effect.tryPromise(() => (connection as any).unstable_resumeSession(params));
      yield* Ref.set(sessionIdRef, params.sessionId);
      yield* Ref.set(stateRef, "ready");
    });
  };

  prompt = (params: acp.PromptRequest) => {
    const { stateRef, connection } = this;
    return Effect.gen(function* () {
      yield* Ref.set(stateRef, "prompting");
      const result = yield* Effect.tryPromise(() => connection.prompt(params));
      yield* Ref.set(stateRef, "ready");
      return result;
    });
  };

  cancel = (sessionId: string) =>
    Effect.tryPromise(() => this.connection.cancel({ sessionId }));

  setSessionMode = (params: acp.SetSessionModeRequest) =>
    Effect.tryPromise(() => this.connection.setSessionMode(params));

  setSessionModel = (params: acp.SetSessionModelRequest) =>
    Effect.tryPromise(() => this.connection.unstable_setSessionModel(params));

  setSessionConfigOption = (params: acp.SetSessionConfigOptionRequest) =>
    Effect.tryPromise(() => this.connection.setSessionConfigOption(params));

  onSessionUpdate(handler: SessionUpdateHandler): () => void {
    this.updateHandlers.add(handler);
    return () => this.updateHandlers.delete(handler);
  }

  close = () => {
    const { stateRef, proc } = this;
    return Effect.gen(function* () {
      yield* Ref.set(stateRef, "disconnected");
      proc.kill();
    });
  };
}
