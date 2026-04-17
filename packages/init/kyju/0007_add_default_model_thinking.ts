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
  version: 8,
  operations: [
    {
      "op": "alter",
      "key": "agentConfigs",
      "changes": {
        "typeHash": {
          "from": "9e263718cf222c02",
          "to": "3b9dd6b0bb3c0075"
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    return apply(prev);
  },
}

export default migration
