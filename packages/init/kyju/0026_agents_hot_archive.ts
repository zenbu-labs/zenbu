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
  version: 27,
  operations: [
    {
      op: "add",
      key: "archivedAgents",
      kind: "collection",
      debugName: "archivedAgents",
    },
    {
      op: "add",
      key: "hotAgentsCap",
      kind: "data",
      hasDefault: true,
      default: 100,
    },
    {
      op: "remove",
      key: "acpSessions",
      kind: "data",
    },
    {
      op: "alter",
      key: "agents",
      changes: {
        typeHash: {
          from: "16f44d0dcf0c065d",
          to: "ae79c207f81ac523",
        },
      },
    },
  ],
}

export default migration
