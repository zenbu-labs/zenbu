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
  version: 10,
  operations: [
    {
      "op": "add",
      "key": "composerDrafts",
      "kind": "data",
      "hasDefault": true,
      "default": {}
    },
    {
      "op": "alter",
      "key": "agentConfigs",
      "changes": {
        "typeHash": {
          "from": "3b9dd6b0bb3c0075",
          "to": "9e263718cf222c02"
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    const result = apply(prev)
    // customize transformation here
    return result
  },
}

export default migration
