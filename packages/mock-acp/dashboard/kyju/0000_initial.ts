import type { KyjuMigration } from "@zenbu/kyju/migrations"

const migration: KyjuMigration = {
  version: 1,
  operations: [
    { op: "add", key: "mockAgentUrl", kind: "data", hasDefault: true, default: "" },
    { op: "add", key: "mockAgentConnected", kind: "data", hasDefault: true, default: false },
    {
      op: "add",
      key: "views",
      kind: "data",
      hasDefault: true,
      default: [
        { id: "control", type: "control-panel", title: "Control Panel", active: true },
        { id: "events", type: "event-viewer", title: "Events", active: false },
        { id: "state", type: "agent-state", title: "Agent State", active: false },
        { id: "prompt", type: "prompt-tester", title: "Prompt Tester", active: false },
      ],
    },
    { op: "add", key: "savedPrompts", kind: "data", hasDefault: true, default: [] },
    {
      op: "add",
      key: "eventFilters",
      kind: "data",
      hasDefault: true,
      default: { showEmitted: true, showReceived: true, types: [] },
    },
  ],
}

export default migration
