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
  version: 21,
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
          ],
          "to": [
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
          ]
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    const CODEX_CMD =
      "$ZENBU_BUN $HOME/.zenbu/plugins/zenbu/packages/codex-acp/src/index.ts"
    const CLAUDE_CMD =
      "$ZENBU_BUN $HOME/.zenbu/plugins/zenbu/packages/claude-acp/src/index.ts"

    const result = apply(prev)

    if (Array.isArray(result.agentConfigs)) {
      result.agentConfigs = result.agentConfigs.map((c: any) => {
        if (!c || typeof c !== "object") return c
        const cmd = typeof c.startCommand === "string" ? c.startCommand : ""
        // Rewrite any codex/claude entry still pointing at the tsx-based
        // default (which depends on a user-installed node) to the bundled-bun
        // form. Preserve user-authored commands that don't match.
        const looksLikeTsxDefault =
          cmd.includes("/init/node_modules/.bin/tsx") &&
          (cmd.includes("/codex-acp/") || cmd.includes("/claude-acp/"))
        if (!looksLikeTsxDefault) return c
        if (c.id === "codex") return { ...c, startCommand: CODEX_CMD }
        if (c.id === "claude") return { ...c, startCommand: CLAUDE_CMD }
        return c
      })
    }

    return result
  },
}

export default migration
