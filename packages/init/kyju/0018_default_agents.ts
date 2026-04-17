type MigrationOp =
  | { op: "add"; key: string; kind: "data"; hasDefault: boolean; default?: any }
  | { op: "add"; key: string; kind: "collection"; debugName?: string }
  | { op: "add"; key: string; kind: "blob"; debugName?: string }
  | { op: "remove"; key: string; kind: "collection" | "blob" | "data" }
  | { op: "alter"; key: string; changes: Record<string, any> };

type KyjuMigration = {
  version: number;
  operations?: MigrationOp[];
  migrate?: (prev: any, ctx: { apply: (data: any) => any }) => any;
};

const migration: KyjuMigration = {
  version: 19,
  operations: [
    {
      "op": "alter",
      "key": "agentConfigs",
      "changes": {
        "default": {
          "from": [],
          "to": [
            {
              "id": "codex",
              "name": "codex",
              "startCommand": "{HOME}/.zenbu/plugins/zenbu/packages/init/node_modules/.bin/tsx {HOME}/.zenbu/plugins/zenbu/packages/codex-acp/src/index.ts",
              "availableModels": [],
              "availableThinkingLevels": [],
              "availableModes": []
            },
            {
              "id": "claude",
              "name": "claude",
              "startCommand": "{HOME}/.zenbu/plugins/zenbu/packages/init/node_modules/.bin/tsx {HOME}/.zenbu/plugins/zenbu/packages/claude-acp/src/index.ts",
              "availableModels": [],
              "availableThinkingLevels": [],
              "availableModes": []
            }
          ]
        }
      }
    },
    {
      "op": "alter",
      "key": "selectedConfigId",
      "changes": {
        "default": {
          "from": "codex-acp",
          "to": "codex"
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    const CODEX_TEMPLATE = {
      id: "codex",
      name: "codex",
      startCommand:
        "{HOME}/.zenbu/plugins/zenbu/packages/init/node_modules/.bin/tsx {HOME}/.zenbu/plugins/zenbu/packages/codex-acp/src/index.ts",
      availableModels: [],
      availableThinkingLevels: [],
      availableModes: [],
    }
    const CLAUDE_TEMPLATE = {
      id: "claude",
      name: "claude",
      startCommand:
        "{HOME}/.zenbu/plugins/zenbu/packages/init/node_modules/.bin/tsx {HOME}/.zenbu/plugins/zenbu/packages/claude-acp/src/index.ts",
      availableModels: [],
      availableThinkingLevels: [],
      availableModes: [],
    }

    const result = apply(prev)

    const configs: any[] = Array.isArray(result.agentConfigs) ? result.agentConfigs : []
    const filtered = configs.filter(
      (c: any) =>
        !(c && c.id === "codex-acp" && (!c.startCommand || c.startCommand === "")),
    )
    const hasCodex = filtered.some((c: any) => c && c.id === "codex")
    const hasClaude = filtered.some((c: any) => c && c.id === "claude")
    const next = [...filtered]
    if (!hasCodex) next.unshift(CODEX_TEMPLATE)
    if (!hasClaude) {
      const codexIdx = next.findIndex((c: any) => c && c.id === "codex")
      next.splice(codexIdx + 1, 0, CLAUDE_TEMPLATE)
    }
    result.agentConfigs = next

    if (result.selectedConfigId === "codex-acp") {
      result.selectedConfigId = "codex"
    }

    return result
  },
}

export default migration
