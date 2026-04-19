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

// Adds `defaultConfiguration: { model?, thinkingLevel?, mode? }` to each
// agentConfig template. Schema has a default of `{}` (empty selection),
// which is what existing rows get on next read — no custom migrate body
// needed.
const migration: KyjuMigration = {
  version: 28,
  operations: [
    {
      op: "alter",
      key: "agentConfigs",
      changes: {
        typeHash: {
          from: "7e9e42f066b590b4",
          to: "49ce2ae25aa6615c",
        },
      },
    },
  ],
}

export default migration
