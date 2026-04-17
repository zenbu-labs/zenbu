import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { Agent } from "@zenbu/agent/src/agent";
import type { EventLog } from "@zenbu/agent/src/event-log";
import type { AgentStore } from "@zenbu/agent/src/store";
import type { TerminalInfo } from "@zenbu/agent/src/terminal";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";
import { HttpService } from "./http";

type ImageRef = { blobId: string; mimeType: string };

const DB_BLOBS_DIR = path.join(process.cwd(), ".zenbu", "db", "blobs");

function parseStartCommand(startCommand: string): {
  command: string;
  args: string[];
} {
  const expanded = startCommand.replace(/\{HOME\}/g, os.homedir());
  const parts = expanded.split(/\s+/);
  return { command: parts[0], args: parts.slice(1) };
}

function extractOptionEntries(
  options: any[],
): { value: string; name: string; description?: string }[] {
  return options
    .filter((o: any) => "value" in o)
    .map((o: any) => ({
      value: o.value,
      name: o.name,
      ...(typeof o.description === "string" && o.description
        ? { description: o.description }
        : {}),
    }));
}

function extractFromAcpConfig(acpOptions: any[]) {
  const modelOpt = acpOptions.find(
    (o: any) => o.category === "model" && o.type === "select",
  );
  const thinkingOpt = acpOptions.find(
    (o: any) => o.category === "thought_level" && o.type === "select",
  );
  const modeOpt = acpOptions.find(
    (o: any) => o.category === "mode" && o.type === "select",
  );
  return {
    availableModels: modelOpt
      ? extractOptionEntries(modelOpt.options ?? [])
      : [],
    availableThinkingLevels: thinkingOpt
      ? extractOptionEntries(thinkingOpt.options ?? [])
      : [],
    availableModes: modeOpt ? extractOptionEntries(modeOpt.options ?? []) : [],
    defaultModel: modelOpt?.currentValue ?? "",
    defaultThinkingLevel: thinkingOpt?.currentValue ?? "",
    defaultMode: modeOpt?.currentValue ?? "",
  };
}

function validateAgentSelections(
  agent: any,
  extracted: ReturnType<typeof extractFromAcpConfig>,
) {
  if (agent.model && extracted.availableModels.length > 0) {
    if (!extracted.availableModels.some((m: any) => m.value === agent.model)) {
      agent.model =
        extracted.defaultModel || extracted.availableModels[0]?.value;
    }
  }
  if (agent.thinkingLevel && extracted.availableThinkingLevels.length > 0) {
    if (
      !extracted.availableThinkingLevels.some(
        (t: any) => t.value === agent.thinkingLevel,
      )
    ) {
      agent.thinkingLevel =
        extracted.defaultThinkingLevel ||
        extracted.availableThinkingLevels[0]?.value;
    }
  }
  if (agent.mode && extracted.availableModes.length > 0) {
    if (!extracted.availableModes.some((m: any) => m.value === agent.mode)) {
      agent.mode = extracted.defaultMode || extracted.availableModes[0]?.value;
    }
  }
}

const SUMMARIZATION_PROMPT = `You will be given a user's first message in a chat session. Generate a very short title (max 6 words) that captures the intent.

Respond with your result wrapped in XML tags:
- If you can generate a title: <title>Your Short Title</title>
- If you cannot (e.g. the message is empty or nonsensical): <error>reason</error>

Do not include anything else in your response outside the XML tags.

User message:
`;

function parseSummarizationResponse(
  text: string,
): { ok: true; title: string } | { ok: false; error: string } {
  const titleMatch = text.match(/<title>([\s\S]*?)<\/title>/);
  if (titleMatch) return { ok: true, title: titleMatch[1].trim() };
  const errorMatch = text.match(/<error>([\s\S]*?)<\/error>/);
  if (errorMatch) return { ok: false, error: errorMatch[1].trim() };
  return { ok: false, error: "No valid XML response found" };
}

export class AgentService extends Service {
  static key = "agent";
  static deps = { db: DbService, http: HttpService };
  declare ctx: { db: DbService; http: HttpService };

  private processes = new Map<string, Agent>();
  private pendingContinues = new Set<string>();
  private hasSentFirst = new Set<string>();

  private getWorkspaceCwd(): string {
    const kernel = this.ctx.db.client.readRoot().plugin.kernel;
    /**
     * we should rethink the concept of workspaces
     * 
     * in my head anytime u select a cwd that should be a workspace
     * but that doesn't make sense, and for the default 
     * configuration there is no concept of workspaces
     * this should be deleted and moved to plugin storage
     */
    const ws = (kernel.workspaces ?? []).find(
      (w) => w.id === kernel.activeWorkspaceId,
    );
    // No workspace context (e.g. spotlight/dock launch): default to ~/.zenbu
    // so the user can start modifying the app itself without first picking a cwd.
    return ws?.cwd ?? path.join(os.homedir(), ".zenbu");
  }

  private async ensureProcess(agentId: string): Promise<Agent> {
    const existing = this.processes.get(agentId);
    if (existing) return existing;

    const client = this.ctx.db.client;
    const kernel = client.readRoot().plugin.kernel;
    const agentConfig = (kernel.agents ?? []).find((a) => a.id === agentId);
    if (!agentConfig?.startCommand) {
      throw new Error(
        `Agent "${agentId}" has no startCommand configured. Set one in Settings.`,
      );
    }
    const { command, args } = parseStartCommand(agentConfig.startCommand);
    const agentCwd =
      typeof agentConfig.metadata?.cwd === "string"
        ? agentConfig.metadata.cwd
        : undefined;
    const cwd = agentCwd || this.getWorkspaceCwd();

    const eventLog: EventLog = {
      append: (events) => {
        //
        const agentNode = client.plugin.kernel.agents.find(
          (a) => a.id === agentId,
        );
        if (!agentNode) return Effect.void;
        return agentNode.eventLog
          .concat(
            events.map((update) => ({
              //
              timestamp: Date.now(),
              data: { kind: "session_update" as const, update },
            })),
          )
          .pipe(
            Effect.mapError((e) => ({
              code: "EVENT_LOG_WRITE_FAILED" as const,
              message: String(e),
            })),
          );
      },
    };

    const store: AgentStore = {
      getSessionId: (id) =>
        Effect.sync(() => {
          const kernel = client.readRoot().plugin.kernel;
          return kernel.acpSessions[id] ?? null;
        }),
      setSessionId: (id, sessionId) =>
        client
          .update((root) => {
            root.plugin.kernel.acpSessions[id] = sessionId;
          })
          .pipe(
            Effect.mapError((e) => ({
              code: "AGENT_STORE_ERROR" as const,
              message: String(e),
            })),
          ),
      deleteSessionId: (id) =>
        client
          .update((root) => {
            delete root.plugin.kernel.acpSessions[id];
          })
          .pipe(
            Effect.mapError((e) => ({
              code: "AGENT_STORE_ERROR" as const,
              message: String(e),
            })),
          ),
    };

    const agent = await Effect.runPromise(
      Agent.create({
        id: agentId,
        clientConfig: {
          command,
          args,
          cwd,
          handlers: {
            requestPermission: async () => ({
              outcome: { outcome: "selected" as const, optionId: "allow" },
            }),
          },
        },
        cwd,
        eventLog,
        store,
        onStateChange: (state) => {
          this.setProcessState(agentId, state.kind);
        },
        onConfigOptions: (options) => {
          const extracted = extractFromAcpConfig(options as any[]);
          // Read pre-existing agent config before updating DB
          const preExisting = (
            client.readRoot().plugin.kernel.agents ?? []
          ).find((a) => a.id === agentId);
          const preModel = preExisting?.model;
          const preThinking = preExisting?.thinkingLevel;
          const preMode = preExisting?.mode;

          Effect.runPromise(
            client.update((root) => {
              const instance = root.plugin.kernel.agents.find(
                (a) => a.id === agentId,
              );
              const configId = instance?.configId;
              if (configId) {
                const template = root.plugin.kernel.agentConfigs.find(
                  (c) => c.id === configId,
                );
                if (template) {
                  template.availableModels = extracted.availableModels;
                  template.availableThinkingLevels =
                    extracted.availableThinkingLevels;
                  template.availableModes = extracted.availableModes;
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
              // Validate all agents with this configId against new available options
              if (configId) {
                for (const agent of root.plugin.kernel.agents) {
                  if (agent.configId !== configId) continue;
                  validateAgentSelections(agent, extracted);
                }
              }
            }),
          ).catch(() => {});

          // Push pre-set config values to ACP only if still valid in new available options
          const process = this.processes.get(agentId);
          if (process) {
            if (
              preModel &&
              preModel !== extracted.defaultModel &&
              (!extracted.availableModels.length ||
                extracted.availableModels.some((m) => m.value === preModel))
            ) {
              Effect.runPromise(
                process.setSessionConfigOption("model", preModel),
              ).catch(() => {});
            }
            if (
              preThinking &&
              preThinking !== extracted.defaultThinkingLevel &&
              (!extracted.availableThinkingLevels.length ||
                extracted.availableThinkingLevels.some(
                  (t) => t.value === preThinking,
                ))
            ) {
              Effect.runPromise(
                process.setSessionConfigOption("reasoning_effort", preThinking),
              ).catch(() => {});
            }
            if (
              preMode &&
              preMode !== extracted.defaultMode &&
              (!extracted.availableModes.length ||
                extracted.availableModes.some((m) => m.value === preMode))
            ) {
              Effect.runPromise(
                process.setSessionConfigOption("mode", preMode),
              ).catch(() => {});
            }
          }
        },
        onConfigChange: (options) => {
          const extracted = extractFromAcpConfig(options as any[]);
          Effect.runPromise(
            client.update((root) => {
              const instance = root.plugin.kernel.agents.find(
                (a) => a.id === agentId,
              );
              if (!instance) return;

              // Overwrite template available options so UI reflects new config
              const configId = instance.configId;
              if (configId) {
                const template = root.plugin.kernel.agentConfigs.find(
                  (c) => c.id === configId,
                );
                if (template) {
                  template.availableModels = extracted.availableModels;
                  template.availableThinkingLevels =
                    extracted.availableThinkingLevels;
                  template.availableModes = extracted.availableModes;
                }
              }

              // Update this agent's current values from ACP
              if (extracted.defaultModel)
                instance.model = extracted.defaultModel;
              if (extracted.defaultThinkingLevel)
                instance.thinkingLevel = extracted.defaultThinkingLevel;
              if (extracted.defaultMode) instance.mode = extracted.defaultMode;

              // Validate all other agents with same configId against new options
              if (configId) {
                for (const agent of root.plugin.kernel.agents) {
                  if (agent.id === agentId || agent.configId !== configId)
                    continue;
                  validateAgentSelections(agent, extracted);
                }
              }
            }),
          ).catch(() => {});
        },
      }),
    );

    this.processes.set(agentId, agent);
    return agent;
  }

  async init(agentId: string) {
    await this.ensureProcess(agentId);
  }

  getProcess(agentId: string): Agent | undefined {
    return this.processes.get(agentId);
  }

  getActiveAgentIds(): string[] {
    return [...this.processes.keys()];
  }

  private async setAgentStatus(agentId: string, status: "idle" | "streaming") {
    const client = this.ctx.db.client;
    await Effect.runPromise(
      client.update((root) => {
        const agent = (root.plugin.kernel.agents ?? []).find(
          (a) => a.id === agentId,
        );
        if (agent) {
          agent.status = status;
          if (status === "idle") {
            agent.lastFinishedAt = Date.now();
          }
        }
      }),
    ).catch(() => {});
  }

  private async setProcessState(agentId: string, processState: string) {
    const client = this.ctx.db.client;
    await Effect.runPromise(
      client.update((root) => {
        const agent = (root.plugin.kernel.agents ?? []).find(
          (a) => a.id === agentId,
        );
        if (agent) agent.processState = processState;
      }),
    ).catch(() => {});
  }

  private async setAgentTitle(
    agentId: string,
    title:
      | { kind: "not-available" }
      | { kind: "generating" }
      | { kind: "set"; value: string },
  ) {
    const client = this.ctx.db.client;
    await Effect.runPromise(
      client.update((root) => {
        const agent = (root.plugin.kernel.agents ?? []).find(
          (a) => a.id === agentId,
        );
        if (agent) agent.title = title;
      }),
    ).catch(() => {});
  }

  private async generateTitle(agentId: string, userMessage: string) {
    const client = this.ctx.db.client;
    const kernel = client.readRoot().plugin.kernel;
    const configId = kernel.summarizationAgentConfigId;
    if (!configId) return;

    const template = (kernel.agentConfigs ?? []).find((c) => c.id === configId);
    if (!template) return;

    await this.setAgentTitle(agentId, { kind: "generating" });

    try {
      const { command, args } = parseStartCommand(template.startCommand);
      const cwd = this.getWorkspaceCwd();

      let collectedText = "";
      const eventLog: EventLog = {
        append: (events) => {
          for (const update of events) {
            const u = update as any;
            if (
              u.sessionUpdate === "agent_message_chunk" &&
              u.content?.type === "text"
            ) {
              collectedText += u.content.text;
            }
          }
          return Effect.void;
        },
      };

      const store: AgentStore = {
        getSessionId: () => Effect.succeed(null),
        setSessionId: () => Effect.void,
        deleteSessionId: () => Effect.void,
      };

      const summaryAgent = await Effect.runPromise(
        Agent.create({
          id: `summarization-${agentId}`,
          clientConfig: {
            command,
            args,
            cwd,
            handlers: {
              requestPermission: async () => ({
                outcome: { outcome: "selected" as const, optionId: "allow" },
              }),
            },
          },
          cwd,
          eventLog,
          store,
        }),
      );

      const model = kernel.summarizationModel;
      if (model) {
        await Effect.runPromise(
          summaryAgent.setSessionConfigOption("model", model),
        ).catch(() => {});
      }

      await Effect.runPromise(
        summaryAgent.send([
          { type: "text", text: SUMMARIZATION_PROMPT + userMessage },
        ]),
      );

      await Effect.runPromise(summaryAgent.close()).catch(() => {});

      const parsed = parseSummarizationResponse(collectedText);
      if (parsed.ok) {
        await this.setAgentTitle(agentId, { kind: "set", value: parsed.title });
      } else {
        console.warn(
          `[agent] title generation failed for ${agentId}: ${parsed.error}`,
        );
        await this.setAgentTitle(agentId, { kind: "not-available" });
      }
    } catch (err) {
      console.error(`[agent] title generation error for ${agentId}:`, err);
      await this.setAgentTitle(agentId, { kind: "not-available" });
    }
  }

  private async readBlobFromDisk(blobId: string): Promise<Buffer | null> {
    const dataPath = path.join(DB_BLOBS_DIR, blobId, "data");
    try {
      return await fsp.readFile(dataPath);
    } catch {
      return null;
    }
  }

  private async getContextBlocks(): Promise<
    Array<{ type: "text"; text: string }>
  > {
    const kernel = this.ctx.db.client.readRoot().plugin.kernel;
    const ws = (kernel.workspaces ?? []).find(
      (w) => w.id === kernel.activeWorkspaceId,
    );
    const files = ws?.contextFiles ?? [];
    if (files.length === 0) return [];

    const blocks: Array<{ type: "text"; text: string }> = [];
    for (const filePath of files) {
      try {
        const content = await fsp.readFile(filePath, "utf-8");
        blocks.push({
          type: "text",
          text: `Context file: ${filePath}\n\n${content}`,
        });
      } catch {
        // skip files that can't be read
      }
    }
    return blocks;
  }

  async send(agentId: string, text: string, images?: ImageRef[]) {
    const agent = await this.ensureProcess(agentId);

    const isFirstMessage = !(this.hasSentFirst ??= new Set()).has(agentId);
    if (isFirstMessage) {
      this.hasSentFirst.add(agentId);
      const contextBlocks = await this.getContextBlocks();
      if (contextBlocks.length > 0) {
        await Effect.runPromise(agent.setInitialContext(contextBlocks as any));
      }
    }

    if (isFirstMessage && text) {
      this.generateTitle(agentId, text).catch((err) => {
        console.error(`[agent] background title generation failed:`, err);
      });
    }

    const contentBlocks: Array<{ type: string; [key: string]: any }> = [];
    if (text) {
      contentBlocks.push({ type: "text", text });
    }

    if (images && images.length > 0) {
      const imageBlocks = await Promise.all(
        images.map(async (img) => {
          const data = await this.readBlobFromDisk(img.blobId);
          if (!data) return null;
          return {
            type: "image" as const,
            mimeType: img.mimeType,
            data: data.toString("base64"),
          };
        }),
      );
      for (const block of imageBlocks) {
        if (block) contentBlocks.push(block);
      }
    }

    if (contentBlocks.length === 0) return;

    await this.setAgentStatus(agentId, "streaming");
    try {
      await Effect.runPromise(agent.send(contentBlocks as any));
    } finally {
      await this.setAgentStatus(agentId, "idle");
    }
  }

  async appendUserPrompt(agentId: string, text: string) {
    const client = this.ctx.db.client;
    const kernel = client.readRoot().plugin.kernel;
    const agents = kernel.agents ?? [];
    const agentIndex = agents.findIndex((a) => a.id === agentId);
    if (agentIndex < 0) return;

    const now = Date.now();
    await Effect.runPromise(
      client.plugin.kernel.agents[agentIndex].eventLog.concat([
        { timestamp: now, data: { kind: "user_prompt", text } },
      ]),
    );
    // set has a bug
    const effect = client.plugin.kernel.agents[
      agentIndex
    ].lastUserMessageAt?.set(now as never);
    effect && (await Effect.runPromise(effect));
  }

  async reload(agentId: string) {
    const agent = this.processes.get(agentId);
    if (agent) {
      await Effect.runPromise(agent.close()).catch(() => {});
      this.processes.delete(agentId);
    }
    await this.ensureProcess(agentId);
  }

  async interrupt(agentId: string, text?: string, images?: ImageRef[]) {
    const agent = this.processes.get(agentId);
    if (!agent) return;
    await Effect.runPromise(agent.interrupt()).catch(() => {});

    const client = this.ctx.db.client;
    const agentNode = client.plugin.kernel.agents.find((a) => a.id === agentId);
    if (agentNode) {
      await Effect.runPromise(
        agentNode.eventLog.concat([
          { timestamp: Date.now(), data: { kind: "interrupted" as const } },
        ]),
      ).catch(() => {});
    }

    await this.setAgentStatus(agentId, "idle");

    // If a prompt was included with the interrupt, append it and send it
    // Server handles ordering so user_prompt appears after the interrupted event
    if (text) {
      await this.appendUserPrompt(agentId, text);
      await this.send(agentId, text, images);
    }
  }

  async changeAgentConfig(agentId: string, newConfigId: string) {
    const client = this.ctx.db.client;
    const kernel = client.readRoot().plugin.kernel;
    const newTemplate = (kernel.agentConfigs ?? []).find(
      (c) => c.id === newConfigId,
    );
    if (!newTemplate) return;

    await Effect.runPromise(
      client.update((root) => {
        const agent = root.plugin.kernel.agents.find((a) => a.id === agentId);
        if (!agent) return;
        agent.configId = newConfigId;
        agent.startCommand = newTemplate.startCommand;
        delete (agent as any).model;
        delete (agent as any).thinkingLevel;
        delete (agent as any).mode;
        agent.processState = "initializing";
        root.plugin.kernel.selectedConfigId = newConfigId;
      }),
    );

    const process = this.processes.get(agentId);
    if (process) {
      const { command, args } = parseStartCommand(newTemplate.startCommand);
      try {
        await Effect.runPromise(process.changeStartCommand(command, args));
      } catch (err) {
        console.error(`[agent] changeStartCommand failed for ${agentId}:`, err);
        await this.setProcessState(agentId, "error");
      }
    } else {
      try {
        await this.ensureProcess(agentId);
      } catch (err) {
        console.error(`[agent] ensureProcess failed for ${agentId}:`, err);
        await this.setProcessState(agentId, "error");
      }
    }
  }

  async setConfigOption(agentId: string, configId: string, value: string) {
    const client = this.ctx.db.client;
    await Effect.runPromise(
      client.update((root) => {
        const agent = root.plugin.kernel.agents.find((a) => a.id === agentId);
        if (!agent) return;
        if (configId === "model") agent.model = value;
        else if (configId === "reasoning_effort") agent.thinkingLevel = value;
        else if (configId === "mode") agent.mode = value;
      }),
    );
    const process = this.processes.get(agentId);
    if (process) {
      await Effect.runPromise(
        process.setSessionConfigOption(configId, value),
      ).catch(() => {});
    }
  }

  async changeCwd(agentId: string, newCwd: string) {
    const client = this.ctx.db.client;
    await Effect.runPromise(
      client.update((root) => {
        const agent = root.plugin.kernel.agents.find((a) => a.id === agentId);
        if (!agent) return;
        if (!agent.metadata) agent.metadata = {};
        agent.metadata.cwd = newCwd;
      }),
    );
    const process = this.processes.get(agentId);
    if (process) {
      await Effect.runPromise(process.changeCwd(newCwd));
    }
  }

  async getAgentDebugInfo(agentId: string) {
    const process = this.processes.get(agentId);
    if (!process) return null;
    return Effect.runPromise(process.getDebugState());
  }

  getTerminals(agentId: string): TerminalInfo[] {
    const agent = this.processes.get(agentId);
    if (!agent) return [];
    return agent.getTerminalManager().getAll();
  }

  getTerminalOutput(
    agentId: string,
    terminalId: string,
  ): {
    output: string;
    truncated: boolean;
    exitStatus: { exitCode: number | null; signal: string | null } | null;
  } | null {
    const agent = this.processes.get(agentId);
    if (!agent) return null;
    const info = agent.getTerminalManager().get(terminalId);
    if (!info) return null;
    return {
      output: info.output,
      truncated: info.truncated,
      exitStatus: info.exitStatus,
    };
  }

  onTerminalOutput(
    agentId: string,
    terminalId: string,
    cb: (chunk: string) => void,
  ): () => void {
    const agent = this.processes.get(agentId);
    if (!agent) return () => {};
    try {
      return agent.getTerminalManager().onOutput(terminalId, cb);
    } catch {
      return () => {};
    }
  }

  evaluate() {
    this.effect("agent-cleanup", () => {
      return async (reason) => {
        if (reason === "reload") {
          for (const [agentId, agent] of this.processes.entries()) {
            const state = await Effect.runPromise(agent.getState());
            if (state.kind === "prompting") {
              console.log(
                `[agent] marking ${agentId} for auto-continue (was prompting)`,
              );
              this.pendingContinues.add(agentId);
            } else {
              console.log(
                `[agent] skipping auto-continue for ${agentId} (state: ${state.kind})`,
              );
            }
          }
        }
        for (const agent of this.processes.values()) {
          await Effect.runPromise(agent.close()).catch(() => {});
        }
        this.processes.clear();
      };
    });

    const pending = [...this.pendingContinues];
    this.pendingContinues.clear();

    if (pending.length > 0) {
      console.log(
        `[agent] auto-continuing ${pending.length} agent(s):`,

        pending,
      );
      Promise.all(
        pending.map(async (agentId) => {
          console.log(`[agent] auto-continue starting for ${agentId}`);
          try {
            await this.appendUserPrompt(agentId, "continue");
            console.log(
              `[agent] auto-continue appended user prompt for ${agentId}`,
            );
            await this.send(agentId, "continue");
            console.log(`[agent] auto-continue sent for ${agentId}`);
          } catch (e) {
            console.error(`[agent] auto-continue failed for ${agentId}:`, e);
          }
        }),
      );
    }

    console.log(`[agent] service ready (${this.processes.size} processes)`);
  }
}

runtime.register(AgentService, (import.meta as any).hot);
