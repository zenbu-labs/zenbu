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
  version: 12,
  operations: [
    {
      "op": "add",
      "key": "acpSessions",
      "kind": "data",
      "hasDefault": true,
      "default": {}
    },
    {
      "op": "alter",
      "key": "sessions",
      "changes": {
        "typeHash": {
          "from": "543a2197adc75660",
          "to": "f800dd2720707f96"
        },
        "default": {
          "from": {},
          "to": []
        }
      }
    }
  ],
  migrate(prev, { apply }) {
    const result = apply(prev)
    result.acpSessions = prev.sessions ?? {}
    result.sessions = (prev.views ?? [])
      .filter((v: any) => v.type === "chat")
      .map((v: any) => ({ id: v.id, agentId: v.id }))
    return result
  },
}

export default migration
