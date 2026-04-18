import zod from "zod";
import type { Effect } from "effect";
import type { SessionUpdate } from "@agentclientprotocol/sdk";
import type { EffectCollectionNode, KyjuError } from "@zenbu/kyju";
import {
  createSchema,
  f,
  type InferSchema,
  type InferRoot,
} from "@zenbu/kyju/schema";

export const HOT_AGENT_CAP = 100;

export const agentEventSchema = zod.object({
  timestamp: zod.number(),
  data: zod.union([
    zod.object({ kind: zod.literal("user_prompt"), text: zod.string() }),
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
  ]),
});

export type AgentEvent = {
  timestamp: number;
  data:
    | { kind: "user_prompt"; text: string }
    | { kind: "session_update"; update: SessionUpdate }
    | { kind: "interrupted" }
    | { kind: "initialize"; agentCapabilities?: unknown }
    | {
        kind: "new_session";
        sessionId: string;
        configOptions?: unknown;
        modes?: unknown;
      }
    | { kind: "resume_session"; sessionId: string };
};

export const agentTitleSchema = zod.discriminatedUnion("kind", [
  zod.object({ kind: zod.literal("not-available") }),
  zod.object({ kind: zod.literal("generating") }),
  zod.object({ kind: zod.literal("set"), value: zod.string() }),
]);

export type AgentTitle = zod.infer<typeof agentTitleSchema>;

const agentRecordBase = {
  id: zod.string(),
  name: zod.string(),
  startCommand: zod.string(),
  configId: zod.string(),
  status: zod.enum(["idle", "streaming"]).default("idle"),
  processState: zod.string().optional(),
  metadata: zod.record(zod.string(), zod.unknown()).optional(),
  model: zod.string().optional(),
  thinkingLevel: zod.string().optional(),
  mode: zod.string().optional(),
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
 * section and constructs this adapter pointing at that section. Callers can
 * cast their section-scoped client; structurally the kernel's
 * `client.plugin.<section>` fits the expected shape for the fields we read/
 * write, and `readRoot()` / `update()` project onto the same section.
 */
export type AgentDb = {
  readRoot(): AgentRoot;
  update(fn: (root: AgentRoot) => void): Effect.Effect<void, KyjuError>;
  archivedAgents: EffectCollectionNode<ArchivedAgentRecord>;
};
