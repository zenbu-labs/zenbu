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
  version: 7,
  operations: [
    {
      "op": "alter",
      "key": "agents",
      "changes": {
        "typeHash": {
          "from": "700eeb1368c3b502",
          "to": "0a7195412066edc2"
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    return apply(prev);
  },
}

export default migration
