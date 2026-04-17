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
  version: 15,
  operations: [
    {
      "op": "add",
      "key": "summarizationAgentConfigId",
      "kind": "data",
      "hasDefault": true,
      "default": null
    },
    {
      "op": "add",
      "key": "summarizationModel",
      "kind": "data",
      "hasDefault": true,
      "default": null
    },
    {
      "op": "alter",
      "key": "agents",
      "changes": {
        "typeHash": {
          "from": "9015005331692aed",
          "to": "e56eb4edc79094cf"
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    const result = apply(prev)
    if (Array.isArray(result.agents)) {
      result.agents = result.agents.map((agent: any) => ({
        ...agent,
        title: agent.title ?? { kind: "not-available" },
      }))
    }
    return result
  },
}

export default migration
