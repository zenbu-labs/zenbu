import { Effect, Ref, Deferred, Cause } from "effect";
import { nanoid } from "nanoid";
import { unlinkSync, existsSync } from "node:fs";
import type * as acp from "@agentclientprotocol/sdk";
import { AcpClient, type AcpClientConfig, PROTOCOL_VERSION } from "./client.ts";
import type { AgentDb, AgentEvent, ConfigOption } from "./schema.ts";
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
  /**
   * Kyju-backed persistence. Structurally, the host's section-scoped
   * effect-client (e.g. `kernelClient.plugin.kernel`) satisfies this shape.
   * When omitted the agent runs in ephemeral mode: sessionId + first-prompt
   * latch live in-memory only, event log writes are no-ops, and no
   * agent/config record state is synced to the DB.
   */
  db?: AgentDb;
  /**
   * Absolute path to a node-compatible runtime (node, bun, etc.) used to
   * execute the MCP proxy script. The proxy is a small `require("net")` CJS
   * shim that bridges stdio to the agent's unix socket.
   *
   * If omitted, the proxy MCP server is not registered
   */
  mcpProxyCommand?: string;
  /**
   * Called when the agent transitions between states. Pure observer — the
   * Agent class handles its own DB state sync (status/processState fields
   * on the agent record) when `db` is present.
   */
  onStateChange?: (state: AgentState) => void;
  /**
   * Called for every ACP session update the agent receives. Used by one-shot
   * sub-agents (e.g. title summarization) that need to observe the stream
   * but don't persist anything. In the default flow the DB-backed event log
   * is the observer.
   */
  onSessionUpdate?: (update: acp.SessionUpdate) => void;
  /**
   * Invoked once on the first prompt to this agent. Returned content blocks
   * are prepended to the user's prompt. Use for skill routing metadata or
   * other "system-prompt-ish" preamble that ACP has no first-class slot for.
   * Blocks the send until it resolves; failures are non-fatal (logged).
   *
   * The "has this already fired" decision is durable via `db` when present
   * (checks / writes `firstPromptSentAt` on the agent record); otherwise
   * scoped to this Agent instance.
   */
  firstPromptPreamble?: () => Effect.Effect<acp.ContentBlock[], unknown>;
};

type AcpConfigExtract = {
  availableModels: ConfigOption[];
  availableThinkingLevels: ConfigOption[];
  availableModes: ConfigOption[];
  defaultModel: string;
  defaultThinkingLevel: string;
  defaultMode: string;
};

/** Extract structured values from the raw ACP configOptions array. */
function extractAcpConfig(acpOptions: any[]): AcpConfigExtract {
  const modelOpt = acpOptions.find(
    (o: any) => o.category === "model" && o.type === "select",
  );
  const thinkingOpt = acpOptions.find(
    (o: any) => o.category === "thought_level" && o.type === "select",
  );
  const modeOpt = acpOptions.find(
    (o: any) => o.category === "mode" && o.type === "select",
  );
  const mapOptions = (options: any[]): ConfigOption[] =>
    options
      .filter((o: any) => "value" in o)
      .map((o: any) => ({
        value: o.value,
        name: o.name,
        ...(typeof o.description === "string" && o.description
          ? { description: o.description }
          : {}),
      }));
  return {
    availableModels: modelOpt ? mapOptions(modelOpt.options ?? []) : [],
    availableThinkingLevels: thinkingOpt
      ? mapOptions(thinkingOpt.options ?? [])
      : [],
    availableModes: modeOpt ? mapOptions(modeOpt.options ?? []) : [],
    defaultModel: modelOpt?.currentValue ?? "",
    defaultThinkingLevel: thinkingOpt?.currentValue ?? "",
    defaultMode: modeOpt?.currentValue ?? "",
  };
}

/** If the agent's current selection is no longer valid against ACP's
 * available options, snap back to the new default. Mutates in place. */
function reconcileInstanceSelections(
  agent: { model?: string; thinkingLevel?: string; mode?: string },
  extracted: AcpConfigExtract,
) {
  if (agent.model && extracted.availableModels.length > 0) {
    if (!extracted.availableModels.some((m) => m.value === agent.model)) {
      agent.model =
        extracted.defaultModel || extracted.availableModels[0]?.value;
    }
  }
  if (agent.thinkingLevel && extracted.availableThinkingLevels.length > 0) {
    if (
      !extracted.availableThinkingLevels.some(
        (t) => t.value === agent.thinkingLevel,
      )
    ) {
      agent.thinkingLevel =
        extracted.defaultThinkingLevel ||
        extracted.availableThinkingLevels[0]?.value;
    }
  }
  if (agent.mode && extracted.availableModes.length > 0) {
    if (!extracted.availableModes.some((m) => m.value === agent.mode)) {
      agent.mode = extracted.defaultMode || extracted.availableModes[0]?.value;
    }
  }
}

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
  private db: AgentDb | undefined;
  private cwd: string;
  private mcpServers: acp.McpServer[];
  private onStateChange?: (state: AgentState) => void;
  private onSessionUpdate?: (update: acp.SessionUpdate) => void;
  private _terminalManager: TerminalManager;
  private initialContextRef: Ref.Ref<acp.ContentBlock[] | null>;
  private firstPromptPreamble?: () => Effect.Effect<
    acp.ContentBlock[],
    unknown
  >;
  // Ephemeral-mode fallbacks used when `db` is absent.
  private _ephemeralSessionId: string | null = null;
  private _ephemeralFirstFired = false;
  private supportsLoadSession = false;
  private pendingHandoffContext: string | null = null;
  private eventBuffer: AgentEvent[] = [];

  private _unsubSessionUpdate: (() => void) | null = null;
  private _unsubEventLog: (() => void) | null = null;

  /**
   * Pending permission requests awaiting a `permission_response` event in
   * the event log. When the request goes out we stash a deferred here keyed
   * by requestId; our eventLog subscription resolves it when the user (or
   * any writer) records the response.
   */
  private _pendingPermissions = new Map<
    string,
    (outcome: import("./schema.ts").PermissionOutcome) => void
  >();

  private constructor(
    id: string,
    socketPath: string,
    stateRef: Ref.Ref<AgentState>,
    queueRef: Ref.Ref<acp.ContentBlock[]>,
    initDeferred: Deferred.Deferred<void>,
    client: AcpClient,
    clientConfig: AcpClientConfig,
    db: AgentDb | undefined,
    cwd: string,
    mcpServers: acp.McpServer[],
    terminalManager: TerminalManager,
    initialContextRef: Ref.Ref<acp.ContentBlock[] | null>,
    onStateChange?: (state: AgentState) => void,
    onSessionUpdate?: (update: acp.SessionUpdate) => void,
    firstPromptPreamble?: () => Effect.Effect<acp.ContentBlock[], unknown>,
  ) {
    this.id = id;
    this.socketPath = socketPath;
    this.stateRef = stateRef;
    this.queueRef = queueRef;
    this.initDeferred = initDeferred;
    this.client = client;
    this.clientConfig = clientConfig;
    this.db = db;
    this.cwd = cwd;
    this.mcpServers = mcpServers;
    this._terminalManager = terminalManager;
    this.initialContextRef = initialContextRef;
    this.onStateChange = onStateChange;
    this.onSessionUpdate = onSessionUpdate;
    this.firstPromptPreamble = firstPromptPreamble;
  }

  /**
   * Session/first-prompt/event-log persistence — consolidated from the old
   * AgentStore/EventLog/FirstPromptLatch interfaces. All four methods
   * no-op cleanly when `db` is absent (ephemeral mode).
   */
  private _getSessionId(): string | null {
    if (this.db) {
      return (
        this.db.readRoot().agents.find((a) => a.id === this.id)?.sessionId ??
        null
      );
    }
    return this._ephemeralSessionId;
  }

  private _setSessionId(sessionId: string | null): Effect.Effect<void, never> {
    if (!this.db) {
      this._ephemeralSessionId = sessionId;
      return Effect.void;
    }
    return this.db
      .update((root) => {
        const a = root.agents.find((x) => x.id === this.id);
        if (a) a.sessionId = sessionId;
      })
      .pipe(
        Effect.tapError((err) =>
          Effect.sync(() =>
            console.warn(`[agent ${this.id}] setSessionId failed:`, err),
          ),
        ),
        Effect.catchAll(() => Effect.void),
      );
  }

  private _firstPromptHasFired(): boolean {
    if (this.db) {
      return (
        this.db.readRoot().agents.find((a) => a.id === this.id)
          ?.firstPromptSentAt != null
      );
    }
    return this._ephemeralFirstFired;
  }

  private _firstPromptMarkFired(): Effect.Effect<void, never> {
    if (!this.db) {
      this._ephemeralFirstFired = true;
      return Effect.void;
    }
    return this.db
      .update((root) => {
        const a = root.agents.find((x) => x.id === this.id);
        if (a) a.firstPromptSentAt = Date.now();
      })
      .pipe(
        Effect.tapError((err) =>
          Effect.sync(() =>
            console.warn(
              `[agent ${this.id}] firstPrompt markFired failed:`,
              err,
            ),
          ),
        ),
        Effect.catchAll(() => Effect.void),
      );
  }

  private _appendEventLog(events: AgentEvent[]): void {
    if (!this.db || events.length === 0) return;
    const node = this.db.agents.find((a) => a.id === this.id);
    if (!node) return;
    Effect.runFork(
      node.eventLog.concat(events).pipe(
        Effect.tapError((err) =>
          Effect.sync(() =>
            console.warn(`[agent ${this.id}] eventLog.concat failed:`, err),
          ),
        ),
        Effect.catchAll(() => Effect.void),
      ),
    );
  }

  private _subscribeSessionUpdates() {
    this._unsubSessionUpdate?.();
    this._unsubSessionUpdate = this.client.onSessionUpdate(
      (e: acp.SessionNotification) => {
        const event: AgentEvent = {
          timestamp: Date.now(),
          data: { kind: "session_update", update: e.update },
        };
        this.eventBuffer.push(event);
        this._appendEventLog([event]);
        this.onSessionUpdate?.(e.update);

        const update = e.update as any;
        if (update?.configOptions) {
          Effect.runFork(this._reconcileConfigChange(update.configOptions));
        }
      },
    );
  }

  private _logSyntheticEvent(data: AgentEvent["data"]) {
    const event: AgentEvent = { timestamp: Date.now(), data };
    this.eventBuffer.push(event);
    this._appendEventLog([event]);
  }

  private _setState = (state: AgentState) => {
    const agent = this;
    return Effect.gen(function* () {
      yield* Ref.set(agent.stateRef, state);
      agent.onStateChange?.(state);
      // Sync the state projection onto the agent's DB record:
      //   processState: string form of the state machine kind
      //   status:       "streaming" while prompting, "idle" otherwise
      //   lastFinishedAt: timestamp of the last transition away from "prompting"
      if (agent.db) {
        const status: "idle" | "streaming" =
          state.kind === "prompting" ? "streaming" : "idle";
        yield* agent.db
          .update((root) => {
            const a = root.agents.find((x) => x.id === agent.id);
            if (!a) return;
            a.processState = state.kind;
            const previousStatus = a.status;
            a.status = status;
            if (previousStatus === "streaming" && status === "idle") {
              a.lastFinishedAt = Date.now();
            }
          })
          .pipe(
            Effect.tapError((err) =>
              Effect.sync(() =>
                console.warn(`[agent ${agent.id}] state sync failed:`, err),
              ),
            ),
            Effect.catchAll(() => Effect.void),
          );
      }
    });
  };

  /**
   * Reconcile ACP-advertised config options with the DB on session start.
   *
   * ACP sends `configOptions` in its newSession response; this is our
   * authoritative list of available models / thinking levels / modes. We:
   *   - Overwrite the template's availableModels/ThinkingLevels/Modes so the
   *     UI reflects what ACP currently offers.
   *   - Seed defaults onto the agent instance for any currently-unset fields.
   *   - Re-validate all sibling agents sharing the same configId (e.g. stale
   *     `model` values get snapped to the new default if removed).
   *   - Push the user's pre-existing selections back to ACP when they're
   *     still in the available set (e.g. we remember "gpt-5" across session
   *     re-inits).
   */
  private _reconcileConfigOptions = (
    options: any[],
    sessionId: string,
  ): Effect.Effect<void, never> => {
    const agent = this;
    return Effect.gen(function* () {
      if (!agent.db) return;
      const extracted = extractAcpConfig(options);

      const preExisting = agent.db
        .readRoot()
        .agents.find((a) => a.id === agent.id);
      const preModel = preExisting?.model;
      const preThinking = preExisting?.thinkingLevel;
      const preMode = preExisting?.mode;

      yield* agent.db
        .update((root) => {
          const instance = root.agents.find((a) => a.id === agent.id);
          const configId = instance?.configId;
          if (configId) {
            const template = root.agentConfigs.find((c) => c.id === configId);
            if (template) {
              template.availableModels = extracted.availableModels;
              template.availableThinkingLevels =
                extracted.availableThinkingLevels;
              template.availableModes = extracted.availableModes;
              // Bootstrap the template's defaultConfiguration on first
              // handshake for this kind — so newly-created agents have
              // something to seed from before the user has ever picked a
              // value explicitly. The user's own toolbar selections (via
              // setSessionConfigOption) still take precedence because they
              // overwrite these fields unconditionally.
              if (!template.defaultConfiguration) {
                template.defaultConfiguration = {};
              }
              if (!template.defaultConfiguration.model && extracted.defaultModel) {
                template.defaultConfiguration.model = extracted.defaultModel;
              }
              if (
                !template.defaultConfiguration.thinkingLevel &&
                extracted.defaultThinkingLevel
              ) {
                template.defaultConfiguration.thinkingLevel =
                  extracted.defaultThinkingLevel;
              }
              if (!template.defaultConfiguration.mode && extracted.defaultMode) {
                template.defaultConfiguration.mode = extracted.defaultMode;
              }
            }
          }
          if (instance) {
            if (!instance.model && extracted.defaultModel) {
              instance.model = extracted.defaultModel;
            }
            if (!instance.thinkingLevel && extracted.defaultThinkingLevel) {
              instance.thinkingLevel = extracted.defaultThinkingLevel;
            }
            if (!instance.mode && extracted.defaultMode) {
              instance.mode = extracted.defaultMode;
            }
          }
          if (configId) {
            for (const sibling of root.agents) {
              if (sibling.configId !== configId) continue;
              reconcileInstanceSelections(sibling, extracted);
            }
          }
        })
        .pipe(Effect.catchAll(() => Effect.void));

      // Restore user-preferred selections to ACP if still valid. Calls the
      // low-level AcpClient directly (not `setSessionConfigOption`) because
      // we're inside `_initSession` and the high-level method waits on
      // `initDeferred`, which wouldn't resolve until this function returns —
      // deadlock.
      const pushAcp = (configId: string, value: string) =>
        agent.client
          .setSessionConfigOption({ sessionId, configId, value })
          .pipe(Effect.catchAll(() => Effect.succeed({ configOptions: [] })));

      if (
        preModel &&
        preModel !== extracted.defaultModel &&
        (!extracted.availableModels.length ||
          extracted.availableModels.some((m) => m.value === preModel))
      ) {
        yield* pushAcp("model", preModel);
      }
      if (
        preThinking &&
        preThinking !== extracted.defaultThinkingLevel &&
        (!extracted.availableThinkingLevels.length ||
          extracted.availableThinkingLevels.some(
            (t) => t.value === preThinking,
          ))
      ) {
        yield* pushAcp("reasoning_effort", preThinking);
      }
      if (
        preMode &&
        preMode !== extracted.defaultMode &&
        (!extracted.availableModes.length ||
          extracted.availableModes.some((m) => m.value === preMode))
      ) {
        yield* pushAcp("mode", preMode);
      }
    });
  };

  /**
   * React to mid-session ACP config changes (e.g. the user switched models
   * in the ACP-side UI). Overwrites both the template's available options
   * and this agent instance's current selection, and snaps sibling agents
   * to the new defaults if their current selections fell out of range.
   */
  private _reconcileConfigChange = (options: any[]) => {
    const agent = this;
    return Effect.gen(function* () {
      if (!agent.db) return;
      const extracted = extractAcpConfig(options);

      yield* agent.db
        .update((root) => {
          const instance = root.agents.find((a) => a.id === agent.id);
          if (!instance) return;

          const configId = instance.configId;
          if (configId) {
            const template = root.agentConfigs.find((c) => c.id === configId);
            if (template) {
              template.availableModels = extracted.availableModels;
              template.availableThinkingLevels =
                extracted.availableThinkingLevels;
              template.availableModes = extracted.availableModes;
            }
          }

          if (extracted.defaultModel) instance.model = extracted.defaultModel;
          if (extracted.defaultThinkingLevel)
            instance.thinkingLevel = extracted.defaultThinkingLevel;
          if (extracted.defaultMode) instance.mode = extracted.defaultMode;

          if (configId) {
            for (const sibling of root.agents) {
              if (sibling.id === agent.id || sibling.configId !== configId)
                continue;
              reconcileInstanceSelections(sibling, extracted);
            }
          }
        })
        .pipe(Effect.catchAll(() => Effect.void));
    });
  };

  private _buildClientConfig(base: AcpClientConfig): AcpClientConfig {
    const tm = this._terminalManager;
    const agent = this;
    return {
      ...base,
      handlers: {
        // Default permission handler routes through the event log (so the
        // UI can render the prompt and the user's response flows back via
        // a synthetic event). Only applied when the caller didn't supply
        // one AND we have a DB — without a DB there's no event log to
        // write to, so AcpClient's fallback (auto-allow) takes over.
        ...(base.handlers?.requestPermission || !agent.db
          ? {}
          : {
              requestPermission: (params: acp.RequestPermissionRequest) =>
                agent._handleRequestPermission(params),
            }),
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

  /**
   * Default permission handler. Writes a `permission_request` event into
   * the agent's eventLog and returns a promise that resolves when a
   * matching `permission_response` lands (via our eventLog subscription).
   *
   * The UI reads the request out of the event log via the standard
   * materializer and, when the user clicks a choice, writes the response
   * as another event — no direct RPC to the agent process needed.
   */
  private _handleRequestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    const requestId = nanoid();
    const promise = new Promise<acp.RequestPermissionResponse>((resolve) => {
      this._pendingPermissions.set(requestId, (outcome) => {
        resolve({ outcome } as acp.RequestPermissionResponse);
      });
    });
    this._logSyntheticEvent({
      kind: "permission_request",
      requestId,
      toolCall: params.toolCall,
      options: params.options,
    });
    return promise;
  }

  /**
   * Subscribe to the agent's own eventLog so we can react to
   * `permission_response` events. Fires once per agent instance after the
   * row exists in the DB. No-op in ephemeral mode (no db, no eventLog
   * collection, no permission flow — AcpClient's auto-allow default wins).
   */
  private _subscribeEventLog() {
    if (!this.db) return;
    this._unsubEventLog?.();
    const node = this.db.agents.find((a) => a.id === this.id);
    if (!node) return;
    this._unsubEventLog = node.eventLog.subscribeData(({ newItems }) => {
      for (const item of newItems as AgentEvent[]) {
        if (item.data?.kind !== "permission_response") continue;
        const { requestId, outcome } = item.data;
        const resolver = this._pendingPermissions.get(requestId);
        if (resolver) {
          this._pendingPermissions.delete(requestId);
          resolver(outcome);
        }
      }
    });
  }

  private _initSession = (opts?: { freshSession?: boolean }) => {
    const agent = this;
    return Effect.gen(function* () {
      const initResult = yield* agent.client.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          terminal: true,
          auth: { terminal: true },
        },
      });
      agent.supportsLoadSession = !!initResult.agentCapabilities?.loadSession;
      agent._logSyntheticEvent({
        kind: "initialize",
        agentCapabilities: initResult.agentCapabilities,
      });

      const advertisedAuthMethods = initResult.authMethods ?? [];

      const existingSessionId = opts?.freshSession
        ? null
        : agent._getSessionId();

      let sessionId: string;
      if (existingSessionId) {
        if (!agent.supportsLoadSession) {
          yield* agent._generateHandoff();
          const session = yield* agent.client.newSession({
            cwd: agent.cwd,
            mcpServers: agent.mcpServers,
          });
          sessionId = session.sessionId;
          yield* agent._setSessionId(sessionId);
          agent._logSyntheticEvent({
            kind: "new_session",
            sessionId,
            configOptions: session.configOptions,
            modes: session.modes,
          });
          if (session.configOptions) {
            yield* agent._reconcileConfigOptions(
              session.configOptions,
              sessionId,
            );
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
            agent._logSyntheticEvent({ kind: "resume_session", sessionId });
            // ACP doesn't accept initial mode/model/thinking in the resume
            // request — each session starts fresh on those axes until we
            // push our persisted selections back via setSessionConfigOption.
            // Without this, a relaunched agent reverts to ACP's defaults
            // for permission mode / model / thinking even though the DB
            // still records the user's picks.
            if (resumeResult.right.configOptions) {
              yield* agent._reconcileConfigOptions(
                resumeResult.right.configOptions,
                sessionId,
              );
            }
          } else {
            yield* agent._generateHandoff();
            const session = yield* agent.client.newSession({
              cwd: agent.cwd,
              mcpServers: agent.mcpServers,
            });
            sessionId = session.sessionId;
            yield* agent._setSessionId(sessionId);
            agent._logSyntheticEvent({
              kind: "new_session",
              sessionId,
              configOptions: session.configOptions,
              modes: session.modes,
            });
            if (session.configOptions) {
              yield* agent._reconcileConfigOptions(
                session.configOptions,
                sessionId,
              );
            }
          }
        }
      } else {
        const session = yield* agent.client.newSession({
          cwd: agent.cwd,
          mcpServers: agent.mcpServers,
        });
        sessionId = session.sessionId;
        yield* agent._setSessionId(sessionId);
        agent._logSyntheticEvent({
          kind: "new_session",
          sessionId,
          configOptions: session.configOptions,
          modes: session.modes,
        });
        if (session.configOptions) {
          yield* agent._reconcileConfigOptions(
            session.configOptions,
            sessionId,
          );
        }
      }

      yield* agent._setState({ kind: "ready", sessionId });
      yield* flushQueue({
        stateRef: agent.stateRef,
        queueRef: agent.queueRef,
        client: agent.client,
        initialContextRef: agent.initialContextRef,
        setState: agent._setState,
        preamble: agent._computePreamble(),
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
      agent._subscribeEventLog();

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

      // The zenbu MCP proxy exposes our in-process tool registry to the ACP
      // agent via stdio. It's only wired if BOTH conditions hold:
      //   1. Some caller registered tools (hasToolListeners) — otherwise
      //      there's nothing to expose.
      //   2. The host explicitly provided `mcpProxyCommand` pointing at a
      //      node-compatible runtime. Without this we can't safely spawn the
      //      proxy script; users may not have node on PATH. Silent fallback
      //      to "node" would cause ENOENT mid-handshake.
      let mcpServers: acp.McpServer[];
      if (hasToolListeners && config.mcpProxyCommand) {
        const proxyScriptPath = writeProxyScript(socketPath);
        const proxyMcpServer = {
          type: "stdio" as const,
          name: "zenbu",
          command: config.mcpProxyCommand,
          args: [proxyScriptPath],
          env: [],
        };
        mcpServers = [proxyMcpServer, ...(config.mcpServers ?? [])];
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
        config.db,
        config.cwd,
        mcpServers,
        terminalManager,
        initialContextRef,
        config.onStateChange,
        config.onSessionUpdate,
        config.firstPromptPreamble,
      );

      const builtConfig = agent._buildClientConfig(baseClientConfig);
      const client = yield* AcpClient.create(builtConfig);
      agent.client = client;
      agent._subscribeSessionUpdates();
      agent._subscribeEventLog();

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

  /**
   * Resolve the first-prompt preamble for the next send. Checks the latch
   * (durable when `db` is present, in-memory otherwise), invokes the
   * provider once, and marks the latch even on failure/empty-result to
   * avoid retrying on every send.
   */
  private _computePreamble = () => {
    const agent = this;
    return Effect.gen(function* () {
      if (!agent.firstPromptPreamble) return [] as acp.ContentBlock[];

      if (agent._firstPromptHasFired()) return [] as acp.ContentBlock[];

      const blocks = yield* agent.firstPromptPreamble().pipe(
        Effect.catchAll((err) => {
          console.warn("[agent] firstPromptPreamble failed:", err);
          return Effect.succeed([] as acp.ContentBlock[]);
        }),
      );

      yield* agent._firstPromptMarkFired();
      return blocks;
    });
  };

  send = (content: acp.ContentBlock[]) => {
    const agent = this;
    const { stateRef, queueRef, initDeferred, client, initialContextRef } =
      this;
    return Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);

      const userText = content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
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
            setState: agent._setState,
            preamble: agent._computePreamble(),
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
        setState: agent._setState,
        preamble: agent._computePreamble(),
      });
      yield* flushQueue({
        stateRef,
        queueRef,
        client,
        initialContextRef,
        setState: agent._setState,
        preamble: agent._computePreamble(),
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
      yield* agent._setSessionId(null);
      agent.clientConfig = { ...agent.clientConfig, command, args };
      yield* agent._restart({ freshSession: true });
    });
  };

  setSessionConfigOption = (
    configId: string,
    value: string,
  ): Effect.Effect<void, unknown> => {
    const agent = this;
    const { stateRef, initDeferred, client } = this;
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

      // Mirror the user's selection onto the live instance state
      // (`agents[i].{model|thinkingLevel|mode}`).
      //
      // For model/thinkingLevel we also write the template default so a
      // freshly-spawned agent of the same kind starts with the user's most
      // recent pick. Mode is deliberately excluded: selecting a mode for
      // one agent must not silently change what every new agent defaults
      // to. The mode default is seeded once from ACP on first handshake
      // (see `_reconcileConfigOptions`) and otherwise only changes via an
      // explicit "set as default" action in the UI.
      //
      // ACP configId -> record field mapping:
      //   "model" -> model
      //   "reasoning_effort" -> thinkingLevel
      //   "mode" -> mode
      if (agent.db) {
        yield* agent.db
          .update((root) => {
            const a = root.agents.find((x) => x.id === agent.id);
            if (!a) return;
            if (configId === "model") a.model = value;
            else if (configId === "reasoning_effort") a.thinkingLevel = value;
            else if (configId === "mode") a.mode = value;

            const template = root.agentConfigs.find((c) => c.id === a.configId);
            if (template) {
              if (!template.defaultConfiguration) {
                template.defaultConfiguration = {};
              }
              if (configId === "model") {
                template.defaultConfiguration.model = value;
              } else if (configId === "reasoning_effort") {
                template.defaultConfiguration.thinkingLevel = value;
              }
            }
          })
          .pipe(Effect.catchAll(() => Effect.void));
      }

      // ACP may return refreshed configOptions in the response — reconcile
      // them the same way we do for the initial newSession.configOptions.
      if (result.configOptions && result.configOptions.length > 0) {
        yield* agent._reconcileConfigOptions(result.configOptions, sessionId);
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
      agent._unsubSessionUpdate?.();
      agent._unsubSessionUpdate = null;
      agent._unsubEventLog?.();
      agent._unsubEventLog = null;
      // Any permission requests still waiting for a response will never
      // resolve; reject them so upstream awaiters unwind instead of
      // hanging. (Hanging would leak memory + fiber resources.)
      for (const [, resolve] of agent._pendingPermissions) {
        resolve({ outcome: "cancelled" });
      }
      agent._pendingPermissions.clear();
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

type SetState = (state: AgentState) => Effect.Effect<void, never>;

const sendPrompt = (ctx: {
  stateRef: Ref.Ref<AgentState>;
  client: AcpClient;
  initialContextRef: Ref.Ref<acp.ContentBlock[] | null>;
  sessionId: string;
  content: acp.ContentBlock[];
  setState: SetState;
  preamble?: Effect.Effect<acp.ContentBlock[], unknown>;
}) =>
  Effect.gen(function* () {
    const {
      client,
      initialContextRef,
      sessionId,
      content,
      setState,
      preamble,
    } = ctx;
    yield* setState({ kind: "prompting", sessionId });

    const initialContext = yield* Ref.get(initialContextRef);
    let prompt = content;
    if (initialContext) {
      prompt = [...initialContext, ...content];
      yield* Ref.set(initialContextRef, null);
    }
    if (preamble) {
      const blocks = yield* preamble.pipe(
        Effect.catchAll(() => Effect.succeed([] as acp.ContentBlock[])),
      );
      if (blocks.length > 0) {
        prompt = [...blocks, ...prompt];
      }
    }

    yield* client.prompt({ sessionId, prompt });

    yield* setState({ kind: "ready", sessionId });
  });

const flushQueue = (ctx: {
  stateRef: Ref.Ref<AgentState>;
  queueRef: Ref.Ref<acp.ContentBlock[]>;
  client: AcpClient;
  initialContextRef: Ref.Ref<acp.ContentBlock[] | null>;
  setState: SetState;
  preamble?: Effect.Effect<acp.ContentBlock[], unknown>;
}) =>
  Effect.gen(function* () {
    const {
      stateRef,
      queueRef,
      client,
      initialContextRef,
      setState,
      preamble,
    } = ctx;
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
      setState,
      preamble,
    });
  });
