import zod from "zod";
import {
  createSchema,
  f,
  makeCollection,
  type InferSchema,
  type InferRoot,
} from "@zenbu/kyju/schema";
import {
  agentSchemaFragment,
  agentConfigSchema,
} from "@zenbu/agent/src/schema";
export type {
  AgentEvent,
  AgentTitle,
  AgentRecord,
  ArchivedAgentRecord,
} from "@zenbu/agent/src/schema";

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

export const appSchema = createSchema({
  // Agent package owns shapes (`agentConfigs`, `agents`, `archivedAgents`,
  // `hotAgentsCap`, `skillRoots`). Init provides host-specific defaults for
  // `agentConfigs` by overriding the field definition after the spread.
  ...agentSchemaFragment,
  agentConfigs: f.array(agentConfigSchema).default([
    {
      id: "codex",
      name: "codex",
      startCommand:
        "$ZENBU_BUN $HOME/.zenbu/plugins/zenbu/packages/codex-acp/src/index.ts",
      availableModels: [],
      availableThinkingLevels: [],
      availableModes: [],
      defaultConfiguration: {},
    },
    {
      id: "claude",
      name: "claude",
      startCommand:
        "$ZENBU_BUN $HOME/.zenbu/plugins/zenbu/packages/claude-acp/src/index.ts",
      availableModels: [],
      availableThinkingLevels: [],
      availableModes: [],
      defaultConfiguration: {},
    },
  ]),
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
  focusRequestNonce: f.string().default(""), // empty string fixme
});

export const schema = appSchema;

export type AppSchema = InferSchema<typeof appSchema>;
export type SchemaRoot = InferRoot<AppSchema>;
