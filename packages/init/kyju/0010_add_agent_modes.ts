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
  version: 11,
  operations: [
    {
      "op": "alter",
      "key": "agentConfigs",
      "changes": {
        "typeHash": {
          "from": "9e263718cf222c02",
          "to": "00b5854b29cc0843"
        }
      }
    },
    {
      "op": "alter",
      "key": "agents",
      "changes": {
        "typeHash": {
          "from": "0a7195412066edc2",
          "to": "9015005331692aed"
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
