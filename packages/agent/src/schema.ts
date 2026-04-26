import zod from "zod";
import type { SessionUpdate } from "@agentclientprotocol/sdk";
import type {
  CollectionNode,
  ArrayFieldNode,
} from "@zenbu/kyju";
import {
  createSchema,
  f,
  type InferSchema,
  type InferRoot,
} from "@zenbu/kyju/schema";

export const HOT_AGENT_CAP = 100;

const userPromptImageSchema = zod.object({
  blobId: zod.string(),
  mimeType: zod.string(),
});

export const agentEventSchema = zod.object({
  timestamp: zod.number(),
  data: zod.union([
    zod.object({
      kind: zod.literal("user_prompt"),
      text: zod.string(),
      images: zod.array(userPromptImageSchema).optional(),
      /**
       * Optional Lexical editor state JSON the composer serialized at submit
       * time. When present, the read-only user-message view uses it to
       * rehydrate pills (file refs, images, generic tokens). Plain `text`
       * is still authoritative for what was sent to the agent; editorState
       * is purely a display hint.
       */
      editorState: zod.any().optional(),
    }),
    zod.object({ kind: zod.literal("session_update"), update: zod.any() }),
    zod.object({ kind: zod.literal("interrupted") }),
    zod.object({
      kind: zod.literal("initialize"),
      agentCapabilities: zod.any().optional(),
    }),
    zod.object({
      kind: zod.literal("new_session"),
      sessionId: zod.string(),
      configOptions: zod.any().optional(),
      modes: zod.any().optional(),
    }),
    zod.object({
      kind: zod.literal("resume_session"),
      sessionId: zod.string(),
    }),
    // Permission flow: the agent writes `permission_request` when ACP asks
    // whether a tool call should proceed. The UI renders the request from
    // the event log and, on user input, writes `permission_response` back
    // into the same event log. The Agent class subscribes to its own
    // eventLog and pairs requests with responses via `requestId`.
    zod.object({
      kind: zod.literal("permission_request"),
      requestId: zod.string(),
      toolCall: zod.any(),
      options: zod.any(),
    }),
    zod.object({
      kind: zod.literal("permission_response"),
      requestId: zod.string(),
      outcome: zod.union([
        zod.object({ outcome: zod.literal("cancelled") }),
        zod.object({
          outcome: zod.literal("selected"),
          optionId: zod.string(),
        }),
      ]),
    }),
  ]),
});

export type PermissionOutcome =
  | { outcome: "cancelled" }
  | { outcome: "selected"; optionId: string };

export type AgentEvent = {
  timestamp: number;
  data:
    | {
        kind: "user_prompt";
        text: string;
        images?: { blobId: string; mimeType: string }[];
        editorState?: unknown;
      }
    | { kind: "session_update"; update: SessionUpdate }
    | { kind: "interrupted" }
    | { kind: "initialize"; agentCapabilities?: unknown }
    | {
        kind: "new_session";
        sessionId: string;
        configOptions?: unknown;
        modes?: unknown;
      }
    | { kind: "resume_session"; sessionId: string }
    | {
        kind: "permission_request";
        requestId: string;
        toolCall: unknown;
        options: unknown;
      }
    | {
        kind: "permission_response";
        requestId: string;
        outcome: PermissionOutcome;
      };
};

export const agentTitleSchema = zod.discriminatedUnion("kind", [
  zod.object({ kind: zod.literal("not-available") }),
  zod.object({ kind: zod.literal("generating") }),
  zod.object({ kind: zod.literal("set"), value: zod.string() }),
]);

export type AgentTitle = zod.infer<typeof agentTitleSchema>;

const configOptionSchema = zod.object({
  value: zod.string(),
  name: zod.string(),
  description: zod.string().optional(),
});
export type ConfigOption = zod.infer<typeof configOptionSchema>;

/**
 * Per-kind "default configuration": the user's most recent selection for
 * each axis (model / thinkingLevel / mode), scoped to this agent kind. Set
 * whenever the user picks a value via the composer toolbar, so:
 *
 *   - A brand-new agent of this kind pre-populates its instance selection
 *     from here (no ACP round-trip needed before the UI shows something
 *     sensible).
 *   - Switching an existing agent's `configId` reads the new kind's
 *     `defaultConfiguration` to seed the instance.
 *
 * Both the instance field (`agents[i].model`) and the template default
 * (`agentConfigs[configId].defaultConfiguration.model`) are written on
 * every toolbar change — two sources of truth for two different
 * questions ("what is this agent set to now?" vs "what should a newly
 * spawned agent of this kind default to?").
 */
const configSelectionSchema = zod.object({
  model: zod.string().optional(),
  thinkingLevel: zod.string().optional(),
  mode: zod.string().optional(),
});
export type ConfigSelection = zod.infer<typeof configSelectionSchema>;

export const agentConfigSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  startCommand: zod.string(),
  availableModels: zod.array(configOptionSchema).default([]),
  availableThinkingLevels: zod.array(configOptionSchema).default([]),
  availableModes: zod.array(configOptionSchema).default([]),
  defaultConfiguration: configSelectionSchema.default({}),
  iconBlobId: zod.string().optional(),
});
export type AgentConfigRecord = zod.infer<typeof agentConfigSchema>;

const agentRecordBase = {
  id: zod.string(),
  name: zod.string(),
  startCommand: zod.string(),
  configId: zod.string(),
  status: zod.enum(["idle", "streaming"]).default("idle"),
  processState: zod.string().optional(),
  metadata: zod.record(zod.string(), zod.unknown()).optional(),
  workspaceId: zod.string().optional(),
  model: zod.string().optional(),
  thinkingLevel: zod.string().optional(),
  mode: zod.string().optional(),
  reloadMode: zod.enum(["continue", "keep-alive"]).default("keep-alive"),
  title: agentTitleSchema.default({ kind: "not-available" }),
  lastUserMessageAt: zod.number().optional(),
  lastFinishedAt: zod.number().optional(),
  createdAt: zod.number(),
  sessionId: zod.string().nullable().default(null),
  firstPromptSentAt: zod.number().nullable().default(null),
  eventLog: f.collection(agentEventSchema),
};

export const agentRecordSchema = zod.object(agentRecordBase);
export type AgentRecord = zod.infer<typeof agentRecordSchema>;

export const archivedAgentRecordSchema = zod.object({
  ...agentRecordBase,
  archivedAt: zod.number(),
});
export type ArchivedAgentRecord = zod.infer<typeof archivedAgentRecordSchema>;

export const agentSchemaFragment = {
  agentConfigs: f.array(agentConfigSchema).default([]),
  agents: f.array(agentRecordSchema).default([]),
  archivedAgents: f.collection(archivedAgentRecordSchema, {
    debugName: "archivedAgents",
  }),
  hotAgentsCap: f.number().default(HOT_AGENT_CAP),
  skillRoots: f.array(zod.string()).default([]),
};

export const agentSchema = createSchema(agentSchemaFragment);
export type AgentSchema = InferSchema<typeof agentSchema>;
export type AgentRoot = InferRoot<AgentSchema>;

/**
 * Minimum DB surface the Agent class needs from a Kyju-backed host.
 *
 * The host (typically the kernel) composes `agentSchemaFragment` into its
 * section. The host's section-scoped effect-client (e.g.
 * `kernelClient.plugin.kernel`) structurally satisfies this shape because the
 * kernel schema is a superset of `agentSchemaFragment`. No adapter needed —
 * the client is passed directly.
 *
 * Shape mirrors the relevant slice of `ClientProxy<typeof
 * agentSchemaFragment>`: readRoot/update + per-field promise-returning
 * nodes for the collections we append to.
 */
export type AgentDb = {
  readRoot(): AgentRoot;
  update(fn: (root: AgentRoot) => void): Promise<void>;
  agents: ArrayFieldNode<AgentRecord[], AgentRecord>;
  archivedAgents: CollectionNode<ArchivedAgentRecord>;
};
