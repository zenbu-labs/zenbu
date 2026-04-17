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
  version: 16,
  operations: [
    {
      "op": "alter",
      "key": "agents",
      "changes": {
        "typeHash": {
          "from": "e56eb4edc79094cf",
          "to": "a6733662b2c054e6"
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
