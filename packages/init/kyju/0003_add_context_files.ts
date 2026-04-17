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
  version: 4,
  operations: [
    {
      "op": "alter",
      "key": "workspaces",
      "changes": {
        "typeHash": {
          "from": "8aa29350309b812d",
          "to": "847367838d366288"
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    const result = apply(prev);
    if (Array.isArray(result.workspaces)) {
      result.workspaces = result.workspaces.map((ws: any) => ({
        ...ws,
        contextFiles: ws.contextFiles ?? [],
      }));
    }
    return result;
  },
}

export default migration
