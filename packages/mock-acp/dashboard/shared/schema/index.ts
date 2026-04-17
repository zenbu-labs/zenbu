import zod from "zod"
import { createSchema, f, type InferSchema } from "@zenbu/kyju/schema"

export const dashboardSchema = createSchema({
  mockAgentUrl: f.string().default(""),
  mockAgentConnected: f.boolean().default(false),
  views: f
    .array(
      zod.object({
        id: zod.string(),
        type: zod.enum([
          "control-panel",
          "event-viewer",
          "agent-state",
          "prompt-tester",
        ]),
        title: zod.string(),
        active: zod.boolean(),
      }),
    )
    .default([
      { id: "control", type: "control-panel", title: "Control Panel", active: true },
      { id: "events", type: "event-viewer", title: "Events", active: false },
      { id: "state", type: "agent-state", title: "Agent State", active: false },
      { id: "prompt", type: "prompt-tester", title: "Prompt Tester", active: false },
    ]),
  savedPrompts: f
    .array(
      zod.object({
        id: zod.string(),
        label: zod.string(),
        content: zod.string(),
      }),
    )
    .default([]),
  eventFilters: f
    .object(
      zod.object({
        showEmitted: zod.boolean(),
        showReceived: zod.boolean(),
        types: zod.array(zod.string()),
      }),
    )
    .default({
      showEmitted: true,
      showReceived: true,
      types: [],
    }),
})

export const schema = dashboardSchema

export type DashboardSchema = InferSchema<typeof dashboardSchema>
