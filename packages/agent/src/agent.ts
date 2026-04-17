import { Effect, Ref, Deferred } from "effect";
import { nanoid } from "nanoid";
import { unlinkSync, existsSync } from "node:fs";
import type * as acp from "@agentclientprotocol/sdk";
import { AcpClient, type AcpClientConfig, PROTOCOL_VERSION } from "./client.ts";
import type { EventLog } from "./event-log.ts";
import type { AgentStore } from "./store.ts";
import { getMcpSocketPath } from "./mcp/socket-path.ts";
import { writeProxyScript } from "./mcp/proxy-template.ts";
import { TerminalManager } from "./terminal.ts";
import {
  serializeEventLog,
  truncateToTokenBudget,
} from "./serialize-event-log.ts";

export type AgentState =
  | { kind: "initializing" }
  | { kind: "ready"; sessionId: string }
  | { kind: "prompting"; sessionId: string }
  | { kind: "error"; error: unknown }
  | { kind: "closed" };

export type BeforeCreateListener = (
  agentId: string,
  socketPath: string,
) => Promise<void>;
export type DestroyListener = (agentId: string, socketPath: string) => void;

export type AgentConfig = {
  id?: string;
  clientConfig: AcpClientConfig;
  cwd: string;
  mcpServers?: acp.McpServer[];
  eventLog: EventLog;
  store: AgentStore;
  onConfigOptions?: (options: any[]) => void;
  onConfigChange?: (options: any[]) => void;
  onStateChange?: (state: AgentState) => void;
};

export class Agent {
  private static beforeCreateListeners = new Set<BeforeCreateListener>();
  private static destroyListeners = new Set<DestroyListener>();

  static onBeforeCreate(listener: BeforeCreateListener): () => void {
    Agent.beforeCreateListeners.add(listener);
    return () => {
      Agent.beforeCreateListeners.delete(listener);
    };
  }

  static onDestroy(listener: DestroyListener): () => void {
    Agent.destroyListeners.add(listener);
    return () => {
      Agent.destroyListeners.delete(listener);
    };
  }

  private id: string;
  private socketPath: string;
  private stateRef: Ref.Ref<AgentState>;
  private queueRef: Ref.Ref<acp.ContentBlock[]>;
  private initDeferred: Deferred.Deferred<void>;
  private client: AcpClient;
  private clientConfig: AcpClientConfig;
  private eventLog: EventLog;
  private store: AgentStore;
  private cwd: string;
  private mcpServers: acp.McpServer[];
  private onConfigOptions?: (options: any[]) => void;
  private onConfigChange?: (options: any[]) => void;
  private onStateChange?: (state: AgentState) => void;
  private _terminalManager: TerminalManager;
  private initialContextRef: Ref.Ref<acp.ContentBlock[] | null>;
  private supportsLoadSession = false;
  private pendingHandoffContext: string | null = null;
  private eventBuffer: Array<{ timestamp: number; data: any }> = [];

  private _unsubSessionUpdate: (() => void) | null = null;

  private constructor(
    id: string,
    socketPath: string,
    stateRef: Ref.Ref<AgentState>,
    queueRef: Ref.Ref<acp.ContentBlock[]>,
    initDeferred: Deferred.Deferred<void>,
    client: AcpClient,
    clientConfig: AcpClientConfig,
    eventLog: EventLog,
    store: AgentStore,
    cwd: string,
    mcpServers: acp.McpServer[],
    terminalManager: TerminalManager,
    initialContextRef: Ref.Ref<acp.ContentBlock[] | null>,
    onConfigOptions?: (options: any[]) => void,
    onConfigChange?: (options: any[]) => void,
    onStateChange?: (state: AgentState) => void,
  ) {
    this.id = id;
    this.socketPath = socketPath;
    this.stateRef = stateRef;
    this.queueRef = queueRef;
    this.initDeferred = initDeferred;
    this.client = client;
    this.clientConfig = clientConfig;
    this.eventLog = eventLog;
    this.store = store;
    this.cwd = cwd;
    this.mcpServers = mcpServers;
    this._terminalManager = terminalManager;
    this.initialContextRef = initialContextRef;
    this.onConfigOptions = onConfigOptions;
    this.onConfigChange = onConfigChange;
    this.onStateChange = onStateChange;
  }

  private _subscribeSessionUpdates() {
    this._unsubSessionUpdate?.();
    this._unsubSessionUpdate = this.client.onSessionUpdate(
      (e: acp.SessionNotification) => {
        this.eventBuffer.push({
          timestamp: Date.now(),
          data: { kind: "session_update" as const, update: e.update },
        });
        Effect.runFork(this.eventLog.append([e.update]));

        const update = e.update as any;
        if (update?.configOptions && this.onConfigChange) {
          this.onConfigChange(update.configOptions);
        }
      },
    );
  }

  private _logSyntheticEvent(kind: string, data: any) {
    const event = { timestamp: Date.now(), data: { kind, ...data } };
    this.eventBuffer.push(event);
    Effect.runFork(
      this.eventLog
        .append([event.data])
        .pipe(Effect.catchAll(() => Effect.void)),
    );
  }

  private _setState = (state: AgentState) => {
    const agent = this;
    return Effect.gen(function* () {
      yield* Ref.set(agent.stateRef, state);
      agent.onStateChange?.(state);
    });
  };

  private _buildClientConfig(base: AcpClientConfig): AcpClientConfig {
    const tm = this._terminalManager;
    return {
      ...base,
      handlers: {
        ...base.handlers,
        createTerminal: (params) => Promise.resolve(tm.create(params)),
        terminalOutput: (params) =>
          Promise.resolve(tm.getOutput(params.terminalId)),
        releaseTerminal: (params) =>
          Promise.resolve(tm.release(params.terminalId)),
        waitForTerminalExit: (params) => tm.waitForExit(params.terminalId),
        killTerminal: (params) => Promise.resolve(tm.kill(params.terminalId)),
      },
    };
  }

  private _initSession = (opts?: { freshSession?: boolean }) => {
    const agent = this;
    return Effect.gen(function* () {
      const initResult = yield* agent.client.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          terminal: true,
        },
      });
      agent.supportsLoadSession = !!initResult.agentCapabilities?.loadSession;
      agent._logSyntheticEvent("initialize", {
        agentCapabilities: initResult.agentCapabilities,
      });

      const existingSessionId = opts?.freshSession
        ? null
        : yield* agent.store.getSessionId(agent.id);

      let sessionId: string;
      if (existingSessionId) {
        if (!agent.supportsLoadSession) {
          yield* agent._generateHandoff();
          const session = yield* agent.client.newSession({
            cwd: agent.cwd,
            mcpServers: agent.mcpServers,
          });
          sessionId = session.sessionId;
          yield* agent.store.setSessionId(agent.id, sessionId);
          agent._logSyntheticEvent("new_session", {
            sessionId,
            configOptions: session.configOptions,
            modes: (session as any).modes,
          });
          if (session.configOptions && agent.onConfigOptions) {
            agent.onConfigOptions(session.configOptions);
          }
        } else {
          const resumeResult = yield* Effect.either(
            agent.client.resumeSession({
              sessionId: existingSessionId,
              cwd: agent.cwd,
              mcpServers: agent.mcpServers,
            }),
          );
          if (resumeResult._tag === "Right") {
            sessionId = existingSessionId;
            agent._logSyntheticEvent("resume_session", { sessionId });
          } else {
            yield* agent._generateHandoff();
            const session = yield* agent.client.newSession({
              cwd: agent.cwd,
              mcpServers: agent.mcpServers,
            });
            sessionId = session.sessionId;
            yield* agent.store.setSessionId(agent.id, sessionId);
            agent._logSyntheticEvent("new_session", {
              sessionId,
              configOptions: session.configOptions,
              modes: (session as any).modes,
            });
            if (session.configOptions && agent.onConfigOptions) {
              agent.onConfigOptions(session.configOptions);
            }
          }
        }
      } else {
        const session = yield* agent.client.newSession({
          cwd: agent.cwd,
          mcpServers: agent.mcpServers,
        });
        sessionId = session.sessionId;
        yield* agent.store.setSessionId(agent.id, sessionId);
        agent._logSyntheticEvent("new_session", {
          sessionId,
          configOptions: session.configOptions,
          modes: (session as any).modes,
        });
        if (session.configOptions && agent.onConfigOptions) {
          agent.onConfigOptions(session.configOptions);
        }
      }

      yield* agent._setState({ kind: "ready", sessionId });
      yield* flushQueue({
        stateRef: agent.stateRef,
        queueRef: agent.queueRef,
        client: agent.client,
        initialContextRef: agent.initialContextRef,
        onStateChange: agent.onStateChange,
      });
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(agent.stateRef);
          if (current.kind !== "closed") {
            yield* agent._setState({ kind: "error", error: cause });
          }
        }),
      ),
      Effect.ensuring(Deferred.succeed(agent.initDeferred, void 0)),
    );
  };

  private _generateHandoff = () => {
    const agent = this;
    return Effect.sync(() => {
      if (agent.eventBuffer.length === 0) return;
      const { texts } = serializeEventLog(agent.eventBuffer);
      if (texts.length === 0) return;
      const transcript = texts.join("\n\n");
      agent.pendingHandoffContext = truncateToTokenBudget(
        `<handoff>\nThis is a continuation of a previous conversation with a different agent. Here is the transcript of that conversation for context:\n\n${transcript}\n</handoff>`,
      );
    });
  };

  private _restart = (opts?: { freshSession?: boolean }) => {
    const agent = this;
    return Effect.gen(function* () {
      agent._terminalManager.releaseAll();
      yield* agent.client.close();

      agent.initDeferred = yield* Deferred.make<void>();
      yield* agent._setState({ kind: "initializing" });

      const builtConfig = agent._buildClientConfig(agent.clientConfig);
      const clientResult = yield* Effect.either(AcpClient.create(builtConfig));
      if (clientResult._tag === "Left") {
        yield* agent._setState({
          kind: "error",
          error: clientResult.left,
        });
        yield* Deferred.succeed(agent.initDeferred, void 0);
        return;
      }
      agent.client = clientResult.right;
      agent._subscribeSessionUpdates();

      yield* Effect.forkDaemon(agent._initSession(opts));
    });
  };

  static create = (config: AgentConfig) =>
    Effect.gen(function* () {
      const id = config.id ?? nanoid();

      const hasToolListeners = Agent.beforeCreateListeners.size > 0;
      const socketPath = getMcpSocketPath(id);

      if (hasToolListeners) {
        yield* Effect.tryPromise(() =>
          Promise.all(
            [...Agent.beforeCreateListeners].map((l) => l(id, socketPath)),
          ),
        );
      }

      let mcpServers: acp.McpServer[];
      if (hasToolListeners) {
        const proxyScriptPath = writeProxyScript(socketPath);
        const proxyMcpServer = {
          type: "stdio" as const,
          name: "zenbu-tools",
          command: "node",
          args: [proxyScriptPath],
          env: [],
        };
        mcpServers = [
          proxyMcpServer,
          ...(config.mcpServers ?? []),
        ] as acp.McpServer[];
      } else {
        mcpServers = config.mcpServers ?? [];
      }

      const stateRef = yield* Ref.make<AgentState>({ kind: "initializing" });
      const queueRef = yield* Ref.make<acp.ContentBlock[]>([]);
      const initialContextRef = yield* Ref.make<acp.ContentBlock[] | null>(
        null,
      );
      const initDeferred = yield* Deferred.make<void>();

      const terminalManager = new TerminalManager();

      const baseClientConfig: AcpClientConfig = {
        ...config.clientConfig,
      };

      const agent = new Agent(
        id,
        socketPath,
        stateRef,
        queueRef,
        initDeferred,
        null as any,
        baseClientConfig,
        config.eventLog,
        config.store,
        config.cwd,
        mcpServers,
        terminalManager,
        initialContextRef,
        config.onConfigOptions,
        config.onConfigChange,
        config.onStateChange,
      );

      const builtConfig = agent._buildClientConfig(baseClientConfig);
      const client = yield* AcpClient.create(builtConfig);
      agent.client = client;
      agent._subscribeSessionUpdates();

      yield* Effect.forkDaemon(agent._initSession());

      return agent;
    });

  getId = () => this.id;

  getSocketPath = () => this.socketPath;

  getTerminalManager = () => this._terminalManager;

  setInitialContext = (content: acp.ContentBlock[]) =>
    Ref.set(this.initialContextRef, content);

  private _applyHandoff(content: acp.ContentBlock[]): acp.ContentBlock[] {
    if (!this.pendingHandoffContext) return content;
    const result = [
      { type: "text", text: this.pendingHandoffContext } as acp.ContentBlock,
      ...content,
    ];
    this.pendingHandoffContext = null;
    return result;
  }

  send = (content: acp.ContentBlock[]) => {
    const agent = this;
    const { stateRef, queueRef, initDeferred, client, initialContextRef } =
      this;
    return Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);

      const userText = content
        .filter((b) => b.type === "text")
        .map((b) => (b as any).text as string)
        .join("\n");
      if (userText) {
        agent.eventBuffer.push({
          timestamp: Date.now(),
          data: { kind: "user_prompt", text: userText },
        });
      }

      if (state.kind === "closed") {
        return yield* Effect.fail({
          code: "AGENT_CLOSED" as const,
          message: "Agent is closed",
        });
      }

      if (state.kind === "error") {
        return yield* Effect.fail({
          code: "AGENT_ERROR" as const,
          message: "Agent failed to initialize",
          cause: state.error,
        });
      }

      if (state.kind === "initializing") {
        yield* Deferred.await(initDeferred);
        const newState = yield* Ref.get(stateRef);
        if (newState.kind === "error") {
          return yield* Effect.fail({
            code: "AGENT_ERROR" as const,
            message: "Agent failed to initialize",
            cause: newState.error,
          });
        }
        if (newState.kind === "closed") {
          return yield* Effect.fail({
            message: "Agent is closed",
          });
        }
        if (newState.kind === "ready") {
          yield* sendPrompt({
            stateRef,
            client,
            initialContextRef,
            sessionId: newState.sessionId,
            content: agent._applyHandoff(content),
            onStateChange: agent.onStateChange,
          });
        }
        return;
      }

      if (state.kind === "prompting") {
        yield* Ref.update(queueRef, (q) => [
          ...q,
          ...agent._applyHandoff(content),
        ]);
        return;
      }

      yield* sendPrompt({
        stateRef,
        client,
        initialContextRef,
        sessionId: state.sessionId,
        content: agent._applyHandoff(content),
        onStateChange: agent.onStateChange,
      });
      yield* flushQueue({
        stateRef,
        queueRef,
        client,
        initialContextRef,
        onStateChange: agent.onStateChange,
      });
    });
  };

  getState = () => Ref.get(this.stateRef);

  getDebugState = () => {
    const agent = this;
    return Effect.gen(function* () {
      const state = yield* Ref.get(agent.stateRef);
      return {
        id: agent.id,
        state: state.kind,
        sessionId:
          state.kind === "ready" || state.kind === "prompting"
            ? state.sessionId
            : null,
        command: agent.clientConfig.command,
        args: agent.clientConfig.args,
        cwd: agent.cwd,
        supportsLoadSession: agent.supportsLoadSession,
        hasPendingHandoff: agent.pendingHandoffContext !== null,
        eventBufferSize: agent.eventBuffer.length,
      };
    });
  };

  changeCwd = (newCwd: string) => {
    const agent = this;
    return Effect.gen(function* () {
      agent.cwd = newCwd;
      agent.clientConfig = { ...agent.clientConfig, cwd: newCwd };
      yield* agent._restart();
    });
  };

  changeStartCommand = (command: string, args: string[]) => {
    const agent = this;
    return Effect.gen(function* () {
      yield* agent._generateHandoff();
      yield* agent.store.deleteSessionId(agent.id);
      agent.clientConfig = { ...agent.clientConfig, command, args };
      yield* agent._restart({ freshSession: true });
    });
  };

  setSessionConfigOption = (configId: string, value: string) => {
    const { stateRef, initDeferred, client, onConfigOptions } = this;
    return Effect.gen(function* () {
      yield* Deferred.await(initDeferred);
      const state = yield* Ref.get(stateRef);
      if (state.kind === "error" || state.kind === "closed") return;
      const sessionId =
        state.kind === "ready" || state.kind === "prompting"
          ? state.sessionId
          : null;
      if (!sessionId) return;
      const result = yield* client.setSessionConfigOption({
        sessionId,
        configId,
        value,
      });
      if (
        onConfigOptions &&
        result.configOptions &&
        result.configOptions.length > 0
      ) {
        onConfigOptions(result.configOptions);
      }
    });
  };

  interrupt = () => {
    const { stateRef, initDeferred, client } = this;
    return Effect.gen(function* () {
      yield* Deferred.await(initDeferred);
      const state = yield* Ref.get(stateRef);
      if (state.kind !== "prompting") return;
      yield* client.cancel(state.sessionId);
    });
  };

  close = () => {
    const agent = this;
    const { initDeferred, client, id, socketPath, _terminalManager } = this;
    return Effect.gen(function* () {
      _terminalManager.releaseAll();
      yield* client.close();
      yield* agent._setState({ kind: "closed" });
      yield* Deferred.succeed(initDeferred, void 0);
      if (existsSync(socketPath)) {
        try {
          unlinkSync(socketPath);
        } catch {}
      }
      for (const listener of Agent.destroyListeners) {
        listener(id, socketPath);
      }
    });
  };
}

const sendPrompt = (ctx: {
  stateRef: Ref.Ref<AgentState>;
  client: AcpClient;
  initialContextRef: Ref.Ref<acp.ContentBlock[] | null>;
  sessionId: string;
  content: acp.ContentBlock[];
  onStateChange?: (state: AgentState) => void;
}) =>
  Effect.gen(function* () {
    const {
      stateRef,
      client,
      initialContextRef,
      sessionId,
      content,
      onStateChange,
    } = ctx;
    const prompting: AgentState = { kind: "prompting", sessionId };
    yield* Ref.set(stateRef, prompting);
    onStateChange?.(prompting);

    const initialContext = yield* Ref.get(initialContextRef);
    let prompt = content;
    if (initialContext) {
      prompt = [...initialContext, ...content];
      yield* Ref.set(initialContextRef, null);
    }

    yield* client.prompt({ sessionId, prompt });

    const ready: AgentState = { kind: "ready", sessionId };
    yield* Ref.set(stateRef, ready);
    onStateChange?.(ready);
  });

const flushQueue = (ctx: {
  stateRef: Ref.Ref<AgentState>;
  queueRef: Ref.Ref<acp.ContentBlock[]>;
  client: AcpClient;
  initialContextRef: Ref.Ref<acp.ContentBlock[] | null>;
  onStateChange?: (state: AgentState) => void;
}) =>
  Effect.gen(function* () {
    const { stateRef, queueRef, client, initialContextRef, onStateChange } =
      ctx;
    const queued = yield* Ref.get(queueRef);

    if (queued.length === 0) return;

    const state = yield* Ref.get(stateRef);
    if (state.kind !== "ready") return;

    yield* Ref.set(queueRef, []);
    yield* sendPrompt({
      stateRef,
      client,
      initialContextRef,
      sessionId: state.sessionId,
      content: queued,
      onStateChange,
    });
  });
