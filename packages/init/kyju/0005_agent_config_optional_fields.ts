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
  version: 6,
  operations: [
    {
      "op": "alter",
      "key": "agentConfigs",
      "changes": {
        "default": {
          "from": [
            {
              "id": "codex-acp",
              "name": "Codex",
              "startCommand": ""
            }
          ],
          "to": []
        }
      }
    },
    {
      "op": "alter",
      "key": "agents",
      "changes": {
        "typeHash": {
          "from": "00d004cede2a103f",
          "to": "700eeb1368c3b502"
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    return apply(prev);
  },
}

export default migration
