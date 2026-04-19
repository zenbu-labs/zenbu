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
  version: 29,
  operations: [
    {
      "op": "alter",
      "key": "agentConfigs",
      "changes": {
        "default": {
          "from": [
            {
              "id": "codex",
              "name": "codex",
              "startCommand": "$ZENBU_BUN $HOME/.zenbu/plugins/zenbu/packages/codex-acp/src/index.ts",
              "availableModels": [],
              "availableThinkingLevels": [],
              "availableModes": []
            },
            {
              "id": "claude",
              "name": "claude",
              "startCommand": "$ZENBU_BUN $HOME/.zenbu/plugins/zenbu/packages/claude-acp/src/index.ts",
              "availableModels": [],
              "availableThinkingLevels": [],
              "availableModes": []
            }
          ],
          "to": [
            {
              "id": "codex",
              "name": "codex",
              "startCommand": "$ZENBU_BUN $HOME/.zenbu/plugins/zenbu/packages/codex-acp/src/index.ts",
              "availableModels": [],
              "availableThinkingLevels": [],
              "availableModes": [],
              "defaultConfiguration": {}
            },
            {
              "id": "claude",
              "name": "claude",
              "startCommand": "$ZENBU_BUN $HOME/.zenbu/plugins/zenbu/packages/claude-acp/src/index.ts",
              "availableModels": [],
              "availableThinkingLevels": [],
              "availableModes": [],
              "defaultConfiguration": {}
            },
            {
              "id": "cursor",
              "name": "cursor",
              "startCommand": "agent acp",
              "availableModels": [],
              "availableThinkingLevels": [],
              "availableModes": [],
              "defaultConfiguration": {}
            },
            {
              "id": "opencode",
              "name": "opencode",
              "startCommand": "opencode acp",
              "availableModels": [],
              "availableThinkingLevels": [],
              "availableModes": [],
              "defaultConfiguration": {}
            },
            {
              "id": "copilot",
              "name": "copilot",
              "startCommand": "copilot --acp",
              "availableModels": [],
              "availableThinkingLevels": [],
              "availableModes": [],
              "defaultConfiguration": {}
            }
          ]
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    const result = apply(prev)

    const TEMPLATES = [
      {
        id: "cursor",
        name: "cursor",
        startCommand: "agent acp",
        availableModels: [],
        availableThinkingLevels: [],
        availableModes: [],
        defaultConfiguration: {},
      },
      {
        id: "opencode",
        name: "opencode",
        startCommand: "opencode acp",
        availableModels: [],
        availableThinkingLevels: [],
        availableModes: [],
        defaultConfiguration: {},
      },
      {
        id: "copilot",
        name: "copilot",
        startCommand: "copilot --acp",
        availableModels: [],
        availableThinkingLevels: [],
        availableModes: [],
        defaultConfiguration: {},
      },
    ]

    const configs: any[] = Array.isArray(result.agentConfigs) ? result.agentConfigs : []
    const next = [...configs]
    for (const tmpl of TEMPLATES) {
      if (!next.some((c: any) => c && c.id === tmpl.id)) next.push(tmpl)
    }
    result.agentConfigs = next

    return result
  },
}

export default migration
