import zod from "zod";
import type { SessionUpdate } from "@agentclientprotocol/sdk";
import { createSchema, f, makeCollection, type InferSchema, type InferRoot } from "@zenbu/kyju/schema";

const agentEventSchema = {
  timestamp: zod.number(),
  data: zod.union([
    zod.object({ kind: zod.literal("user_prompt"), text: zod.string() }),
    zod.object({ kind: zod.literal("session_update"), update: zod.any() }),
    zod.object({ kind: zod.literal("interrupted") }),
  ]),
};

export type AgentEvent = {
  timestamp: number;
  data:
    | { kind: "user_prompt"; text: string }
    | { kind: "session_update"; update: SessionUpdate }
    | { kind: "interrupted" };
};

const paneSchema = zod.object({
  id: zod.string(),
  type: zod.enum(["leaf", "split"]),
  orientation: zod.enum(["horizontal", "vertical"]).optional(),
  children: zod.array(zod.string()).default([]),
  tabIds: zod.array(zod.string()).default([]),
  activeTabId: zod.string().optional(),
  sizes: zod.array(zod.number()).default([50, 50]),
});

const sessionSchema = zod.object({
  id: zod.string(),
  agentId: zod.string(),
  lastViewedAt: zod.number().nullable().default(null),
});

const windowStateSchema = zod.object({
  id: zod.string(),
  sessions: zod.array(sessionSchema).default([]),
  panes: zod.array(paneSchema).default([]),
  rootPaneId: zod.string().nullable().default(null),
  focusedPaneId: zod.string().nullable().default(null),
  sidebarOpen: zod.boolean().default(false),
  tabSidebarOpen: zod.boolean().default(true),
  sidebarPanel: zod.string().default("overview"),
});

const agentRecordBase = {
  id: zod.string(),
  name: zod.string(),
  startCommand: zod.string(),
  configId: zod.string(),
  status: zod.enum(["idle", "streaming"]).default("idle"),
  metadata: zod.record(zod.string(), zod.unknown()).optional(),
  eventLog: f.collection(zod.object(agentEventSchema)),
  model: zod.string().optional(),
  thinkingLevel: zod.string().optional(),
  mode: zod.string().optional(),
  processState: zod.string().optional(),
  reloadMode: zod.enum(["continue", "keep-alive"]).default("keep-alive"),
  title: zod
    .discriminatedUnion("kind", [
      zod.object({ kind: zod.literal("not-available") }),
      zod.object({ kind: zod.literal("generating") }),
      zod.object({ kind: zod.literal("set"), value: zod.string() }),
    ])
    .default({ kind: "not-available" }),
  lastUserMessageAt: zod.number().optional(),
  lastFinishedAt: zod.number().optional(),
  firstPromptSentAt: zod.number().nullable().default(null),
  sessionId: zod.string().nullable().default(null),
  createdAt: zod.number(),
};

export const appSchema = createSchema({
  agentConfigs: f
    .array(
      zod.object({
        id: zod.string(),
        name: zod.string(),
        startCommand: zod.string(),
        availableModels: zod
          .array(
            zod.object({
              value: zod.string(),
              name: zod.string(),
              description: zod.string().optional(),
            }),
          )
          .default([]),
        availableThinkingLevels: zod
          .array(
            zod.object({
              value: zod.string(),
              name: zod.string(),
              description: zod.string().optional(),
            }),
          )
          .default([]),
        availableModes: zod
          .array(
            zod.object({
              value: zod.string(),
              name: zod.string(),
              description: zod.string().optional(),
            }),
          )
          .default([]),
        iconBlobId: zod.string().optional(),
      }),
    )
    .default([
      {
        id: "codex",
        name: "codex",
        startCommand:
          "$ZENBU_BUN $HOME/.zenbu/plugins/zenbu/packages/codex-acp/src/index.ts",
        availableModels: [],
        availableThinkingLevels: [],
        availableModes: [],
      },
      {
        id: "claude",
        name: "claude",
        startCommand:
          "$ZENBU_BUN $HOME/.zenbu/plugins/zenbu/packages/claude-acp/src/index.ts",
        availableModels: [],
        availableThinkingLevels: [],
        availableModes: [],
      },
    ]),
  agents: f.array(zod.object(agentRecordBase)).default([]),
  archivedAgents: f.collection(
    zod.object({ ...agentRecordBase, archivedAt: zod.number() }),
    { debugName: "archivedAgents" },
  ),
  hotAgentsCap: f.number().default(100),
  skillRoots: f.array(zod.string()).default([]),
  selectedConfigId: f.string().default("claude"),
  summarizationAgentConfigId: f.string().nullable().default(null),
  summarizationModel: f.string().nullable().default(null),
  sessions: f
    .array(
      zod.object({
        id: zod.string(),
        agentId: zod.string(),
      }),
    )
    .default([]),
  orchestratorViewPath: f.string().default("/views/orchestrator/index.html"),
  sidebarOpen: f.boolean().default(false),
  tabSidebarOpen: f.boolean().default(true),
  sidebarPanel: f.string().default("overview"),
  viewRegistry: f
  //
    .array(
      zod.object({
        scope: zod.string(),
        url: zod.string(),
        port: zod.number(),
        icon: zod.string().optional(),
        meta: zod
          .object({
            kind: zod.string().optional(),
          })
          .optional(),
      }),
    )
    .default([]),
  views: f
    .array(
      zod.object({
        id: zod.string(),
        type: zod.string(),
        title: zod.string(),
        createdAt: zod.number(),
        active: zod.boolean(),
        agentId: zod.string().optional(),
        cwd: zod.string().optional(),
      }),
    )
    .default([]),
  panes: f
    .array(
      zod.object({
        id: zod.string(),
        type: zod.enum(["leaf", "split"]),
        orientation: zod.enum(["horizontal", "vertical"]).optional(),
        children: zod.array(zod.string()).default([]),
        tabIds: zod.array(zod.string()).default([]),
        activeTabId: zod.string().optional(),
        sizes: zod.array(zod.number()).default([50, 50]),
      }),
    )
    .default([]),
  rootPaneId: f.string().default(""),
  focusedPaneId: f.string().default(""),
  commands: f
    .array(
      zod.object({
        id: zod.string(),
        name: zod.string(),
        description: zod.string().optional(),
        group: zod.string().optional(),
        shortcut: zod.string().optional(),
        rpcMethod: zod.string(),
        rpcArgs: zod.array(zod.any()).optional(),
      }),
    )
    .default([]),
  chatBlobs: f
    .array(
      zod.object({
        blobId: zod.string(),
        mimeType: zod.string(),
      }),
    )
    .default([]),
  composerDrafts: f
    .record(
      zod.string(),
      zod.object({
        editorState: zod.unknown(),
        chatBlobs: zod
          .array(zod.object({ blobId: zod.string(), mimeType: zod.string() }))
          .default([]),
      }),
    )
    .default({}),
  windowStates: f.array(windowStateSchema).default([]),
  majorMode: f.string().default("fundamental-mode"),
  minorModes: f.array(zod.string()).default([]),
  focusedWindowId: f.string().nullable().default(null),
  shortcutRegistry: f
    .array(
      zod.object({
        id: zod.string(),
        defaultBinding: zod.string(),
        description: zod.string(),
        scope: zod.string(),
      }),
    )
    .default([]),
  shortcutOverrides: f.record(zod.string(), zod.string()).default({}),
  shortcutDisabled: f.array(zod.string()).default([]),
  // Declarative focus-request channel. Writers set target + windowId + nonce;
  // views subscribe via `useFocusOnRequest` and focus their own DOM when a
  // request matches them. Nonce ensures repeated requests re-trigger even
  // when target/windowId are unchanged.
  focusRequestTarget: f.string().nullable().default(null),
  focusRequestWindowId: f.string().nullable().default(null),
  focusRequestNonce: f.string().default(""),
});

export const schema = appSchema;

export type AppSchema = InferSchema<typeof appSchema>;
export type SchemaRoot = InferRoot<AppSchema>;

export type AgentTitle =
  | { kind: "not-available" }
  | { kind: "generating" }
  | { kind: "set"; value: string };
