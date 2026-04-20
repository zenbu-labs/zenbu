import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import type * as acp from "@agentclientprotocol/sdk";
import { Agent } from "@zenbu/agent/src/agent";
import type { AgentDb } from "@zenbu/agent/src/schema";
import type { TerminalInfo } from "@zenbu/agent/src/terminal";
import { discoverSkills, formatSkillsPrompt } from "@zenbu/agent/src/skills";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";
import { HttpService } from "./http";
import { validSelectionFromTemplate } from "../../../shared/agent-ops";

const DEFAULT_SKILL_ROOT = path.join(
  os.homedir(),
  ".zenbu",
  "plugins",
  "zenbu",
  "skills",
);

type ImageRef = { blobId: string; mimeType: string };

const DB_BLOBS_DIR = path.join(process.cwd(), ".zenbu", "db", "blobs");
const PATHS_JSON = path.join(os.homedir(), ".zenbu", ".internal", "paths.json");

type ZenbuPaths = { bunPath?: string; pnpmPath?: string };

function readZenbuPaths(): ZenbuPaths {
  try {
    return JSON.parse(fs.readFileSync(PATHS_JSON, "utf8")) as ZenbuPaths;
  } catch {
    return {};
  }
}

function buildAcpEnv(): Record<string, string> {
  const paths = readZenbuPaths();
  const env: Record<string, string> = {};
  if (paths.bunPath) env.ZENBU_BUN = paths.bunPath;
  if (paths.pnpmPath) env.ZENBU_PNPM = paths.pnpmPath;
  return env;
}


function expandVars(input: string, extraEnv: Record<string, string>): string {
  // Expand $VAR / ${VAR} against process.env + extraEnv, leading ~ against
  // home, and legacy {HOME} for older stored configs.
  const env = { ...process.env, ...extraEnv };
  let out = input.replace(/\{HOME\}/g, os.homedir());
  out = out.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
    (_, name) => env[name] ?? "",
  );
  out = out.replace(
    /\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (_, name) => env[name] ?? "",
  );
  // Expand `~` only when it's the start of a token (standalone or followed by /).
  out = out.replace(/(^|\s)~(?=\/|\s|$)/g, (_, pre) => `${pre}${os.homedir()}`);
  return out;
}

function parseStartCommand(
  startCommand: string,
  extraEnv: Record<string, string>,
): { command: string; args: string[] } {
  const expanded = expandVars(startCommand, extraEnv);
  const parts = expanded.split(/\s+/).filter(Boolean);
  return { command: parts[0] ?? "", args: parts.slice(1) };
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

  /**
   * Project the kernel-section effect-client into the shape the Agent class
   * expects. Top-level `readRoot`/`update` are on the root client; section
   * field nodes (`agents`, `archivedAgents`) are on `client.plugin.kernel`.
   * The Agent class only cares about the agent fragment's surface.
   */
  private agentDb(): AgentDb {
    const client = this.ctx.db.client;
    return {
      readRoot: () => client.readRoot().plugin.kernel,
      update: (fn) =>
        client.update((root) => {
          fn(root.plugin.kernel);
        }),
      agents: client.plugin.kernel.agents,
      archivedAgents: client.plugin.kernel.archivedAgents,
    };
  }

  private async ensureProcess(agentId: string): Promise<Agent> {
    const existing = this.processes.get(agentId);
    if (existing) return existing;

    const client = this.ctx.db.client;
    const kernel = client.readRoot().plugin.kernel;
    const agentConfig = kernel.agents.find((a) => a.id === agentId);
    if (!agentConfig?.startCommand) {
      throw new Error(
        `Agent "${agentId}" has no startCommand configured. Set one in Settings.`,
      );
    }
    const extraEnv = buildAcpEnv();
    const { command, args } = parseStartCommand(
      agentConfig.startCommand,
      extraEnv,
    );
    const agentCwd =
      typeof agentConfig.metadata?.cwd === "string"
        ? agentConfig.metadata.cwd
        : undefined;
    const cwd = agentCwd || path.join(os.homedir(), ".zenbu");

    const firstPromptPreamble = () =>
      Effect.tryPromise({
        try: async () => {
          const configuredRoots = client.readRoot().plugin.kernel.skillRoots;
          const roots =
            configuredRoots.length > 0 ? configuredRoots : [DEFAULT_SKILL_ROOT];
          const { skills } = await discoverSkills(roots);
          const text = formatSkillsPrompt(skills);
          if (!text) return [] as acp.ContentBlock[];
          return [{ type: "text", text } as acp.ContentBlock];
        },
        catch: (err) => err,
      });

    const agent = await Effect.runPromise(
      Agent.create({
        id: agentId,
        clientConfig: {
          command,
          args,
          cwd,
          env: extraEnv,
        },
        cwd,
        db: this.agentDb(),
        mcpProxyCommand: readZenbuPaths().bunPath,
        firstPromptPreamble,
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

  /**
   * Used only for pre-Agent-creation failures (startCommand parsing errors,
   * ensureProcess throwing before the Agent instance exists). Once the
   * Agent class is running, it syncs `processState` / `status` / `lastFinishedAt`
   * itself from its state machine via `_setState`.
   */
  private async markProcessErrored(agentId: string) {
    const client = this.ctx.db.client;
    await Effect.runPromise(
      client.update((root) => {
        const agent = root.plugin.kernel.agents.find((a) => a.id === agentId);
        if (agent) agent.processState = "error";
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
        const agent = root.plugin.kernel.agents.find((a) => a.id === agentId);
        if (agent) agent.title = title;
      }),
    ).catch(() => {});
  }

  private async generateTitle(agentId: string, userMessage: string) {
    const client = this.ctx.db.client;
    const kernel = client.readRoot().plugin.kernel;
    const agentNode = kernel.agents.find((a) => a.id === agentId);

    // If the user hasn't picked a dedicated summarization config, reuse the
    // agent's own config + model — gives every user a working title out of
    // the box without extra setup.
    const configId = kernel.summarizationAgentConfigId ?? agentNode?.configId;
    if (!configId) return;

    const template = kernel.agentConfigs.find((c) => c.id === configId);
    if (!template) return;

    await this.setAgentTitle(agentId, { kind: "generating" });

    try {
      const extraEnv = buildAcpEnv();
      const { command, args } = parseStartCommand(
        template.startCommand,
        extraEnv,
      );
      const agentCwd =
        typeof agentNode?.metadata?.cwd === "string"
          ? agentNode.metadata.cwd
          : undefined;
      const cwd = agentCwd || path.join(os.homedir(), ".zenbu");

      let collectedText = "";
      // Ephemeral sub-agent: no `db`, no persistence. Hooks into
      // onSessionUpdate to accumulate assistant text.
      const summaryAgent = await Effect.runPromise(
        Agent.create({
          id: `summarization-${agentId}`,
          clientConfig: {
            command,
            args,
            cwd,
            env: extraEnv,
            // Summarization is ephemeral (no `db`) so it can't route
            // permission requests via the event log. Leave `handlers`
            // empty; AcpClient's auto-allow default kicks in. In practice
            // the summarization sub-agent has no tools so this never
            // fires.
          },
          cwd,
          onSessionUpdate: (update) => {
            const u = update ;
            if (
              u.sessionUpdate === "agent_message_chunk" &&
              u.content?.type === "text"
            ) {
              collectedText += u.content.text;
            }
          },
          mcpProxyCommand: readZenbuPaths().bunPath,
        }),
      );

      const model = kernel.summarizationModel ?? agentNode?.model;
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

  async send(agentId: string, text: string, images?: ImageRef[]) {
    const agent = await this.ensureProcess(agentId);

    // "First message" = the agent's first-prompt latch hasn't fired yet,
    // persisted on the record itself (`firstPromptSentAt`). The Agent class
    // flips this during send(); reading it here BEFORE dispatch gives us
    // the pre-send value. Used solely to gate one-shot title generation.
    const kernel = this.ctx.db.client.readRoot().plugin.kernel;
    const isFirstMessage =
      kernel.agents.find((a) => a.id === agentId)?.firstPromptSentAt == null;

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

    // status ("streaming" while prompting, "idle" otherwise) and
    // lastFinishedAt are now maintained by the Agent class via its state
    // machine, so no pre/post wrapping is needed here.
    await Effect.runPromise(agent.send(contentBlocks as any));
  }

  async appendUserPrompt(agentId: string, text: string) {
    const client = this.ctx.db.client;
    const agentNode = client.plugin.kernel.agents.find((a) => a.id === agentId);
    if (!agentNode) return;

    const now = Date.now();
    await Effect.runPromise(
      agentNode.eventLog.concat([
        { timestamp: now, data: { kind: "user_prompt", text } },
      ]),
    );
    // set has a bug
    const effect = agentNode.lastUserMessageAt?.set(now as never);
    effect && (await Effect.runPromise(effect));
  }

  async setReloadMode(agentId: string, mode: "continue" | "keep-alive") {
    const client = this.ctx.db.client;
    await Effect.runPromise(
      client.update((root) => {
        const a = root.plugin.kernel.agents.find((x) => x.id === agentId);
        if (a) a.reloadMode = mode;
      }),
    );
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

    // `status` flips back to "idle" automatically when the Agent's state
    // machine transitions out of "prompting" (see _setState in the agent
    // class).

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
    const newTemplate = kernel.agentConfigs.find((c) => c.id === newConfigId);
    if (!newTemplate) return;

    // Seed the instance from the NEW kind's defaultConfiguration so the
    // toolbar has sensible values the moment the switch lands, rather than
    // three empty selects until ACP handshakes.
    const seeded = validSelectionFromTemplate(newTemplate);

    await Effect.runPromise(
      client.update((root) => {
        const agent = root.plugin.kernel.agents.find((a) => a.id === agentId);
        if (!agent) return;
        agent.configId = newConfigId;
        agent.startCommand = newTemplate.startCommand;
        agent.model = seeded.model;
        agent.thinkingLevel = seeded.thinkingLevel;
        agent.mode = seeded.mode;
        agent.processState = "initializing";
        root.plugin.kernel.selectedConfigId = newConfigId;
      }),
    );

    const process = this.processes.get(agentId);
    if (process) {
      const { command, args } = parseStartCommand(
        newTemplate.startCommand,
        buildAcpEnv(),
      );
      try {
        await Effect.runPromise(process.changeStartCommand(command, args));
      } catch (err) {
        console.error(`[agent] changeStartCommand failed for ${agentId}:`, err);
        await this.markProcessErrored(agentId);
      }
    } else {
      try {
        await this.ensureProcess(agentId);
      } catch (err) {
        console.error(`[agent] ensureProcess failed for ${agentId}:`, err);
        await this.markProcessErrored(agentId);
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

  // Writes only the template's `defaultConfiguration` — no instance update,
  // no ACP call. Used by the mode combobox's "set as default" affordance,
  // which is intentionally split from `setConfigOption` so picking a mode
  // for one agent doesn't silently change what every new agent of this
  // kind starts in.
  async setDefaultConfigOption(
    configTemplateId: string,
    configId: string,
    value: string,
  ) {
    const client = this.ctx.db.client;
    await Effect.runPromise(
      client.update((root) => {
        const template = root.plugin.kernel.agentConfigs.find(
          (c) => c.id === configTemplateId,
        );
        if (!template) return;
        if (!template.defaultConfiguration) template.defaultConfiguration = {};
        if (configId === "model") template.defaultConfiguration.model = value;
        else if (configId === "reasoning_effort")
          template.defaultConfiguration.thinkingLevel = value;
        else if (configId === "mode")
          template.defaultConfiguration.mode = value;
      }),
    );
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
        if (reason === "shutdown") {
          for (const agent of this.processes.values()) {
            await Effect.runPromise(agent.close()).catch(() => {});
          }
          this.processes.clear();
          return;
        }

        const kernel = this.ctx.db.client.readRoot().plugin.kernel;
        for (const [agentId, agent] of [...this.processes.entries()]) {
          const record = kernel.agents.find((a) => a.id === agentId);
          const mode = record?.reloadMode ?? "keep-alive";
          if (mode === "keep-alive") {
            console.log(`[agent] keeping ${agentId} alive across reload`);
            continue;
          }
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
          await Effect.runPromise(agent.close()).catch(() => {});
          this.processes.delete(agentId);
        }
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
