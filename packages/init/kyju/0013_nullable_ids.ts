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
  version: 14,
  operations: [
    {
      "op": "alter",
      "key": "windowStates",
      "changes": {
        "typeHash": {
          "from": "34340166c485eadc",
          "to": "0a3e064a8f860f04"
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    const result = apply(prev)
    result.windowStates = (result.windowStates ?? []).map((ws: any) => ({
      ...ws,
      rootPaneId: ws.rootPaneId || null,
      focusedPaneId: ws.focusedPaneId || null,
    }))
    return result
  },
}

export default migration
