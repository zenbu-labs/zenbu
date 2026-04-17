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
  version: 5,
  operations: [
    {
      "op": "remove",
      "key": "configOptions",
      "kind": "data"
    },
    {
      "op": "alter",
      "key": "agentConfigs",
      "changes": {
        "typeHash": {
          "from": "e837f55d8f70e0e0",
          "to": "9e263718cf222c02"
        }
      }
    },
    {
      "op": "alter",
      "key": "agents",
      "changes": {
        "typeHash": {
          "from": "8bc340ed35971c32",
          "to": "00d004cede2a103f"
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    const oldConfigOptions: any[] = prev.configOptions ?? [];
    const modelOpt = oldConfigOptions.find((o: any) => o.category === "model");
    const thinkingOpt = oldConfigOptions.find((o: any) => o.category === "thought_level");

    const result = apply(prev);

    if (Array.isArray(result.agentConfigs)) {
      result.agentConfigs = result.agentConfigs.map((cfg: any) => ({
        ...cfg,
        availableModels: cfg.availableModels ?? modelOpt?.options ?? [],
        availableThinkingLevels: cfg.availableThinkingLevels ?? thinkingOpt?.options ?? [],
      }));
    }

    if (Array.isArray(result.agents)) {
      result.agents = result.agents.map((agent: any) => ({
        ...agent,
        model: agent.model ?? modelOpt?.currentValue ?? "",
        thinkingLevel: agent.thinkingLevel ?? thinkingOpt?.currentValue ?? "",
      }));
    }

    return result;
  },
}

export default migration
