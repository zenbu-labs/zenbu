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
  version: 9,
  operations: [
    {
      op: "add",
      key: "views",
      kind: "data",
      hasDefault: true,
      default: [],
    },
    {
      op: "add",
      key: "panes",
      kind: "data",
      hasDefault: true,
      default: [],
    },
    {
      op: "add",
      key: "rootPaneId",
      kind: "data",
      hasDefault: true,
      default: "",
    },
    {
      op: "add",
      key: "focusedPaneId",
      kind: "data",
      hasDefault: true,
      default: "",
    },
  ],
}

export default migration
