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
  version: 1,
  operations: [
    {
      "op": "add",
      "key": "workspaces",
      "kind": "data",
      "hasDefault": true,
      "default": []
    },
    {
      "op": "add",
      "key": "activeWorkspaceId",
      "kind": "data",
      "hasDefault": true,
      "default": ""
    },
    {
      "op": "add",
      "key": "agentConfigs",
      "kind": "data",
      "hasDefault": true,
      "default": [
        {
          "id": "codex-acp",
          "name": "Codex",
          "startCommand": ""
        }
      ]
    },
    {
      "op": "add",
      "key": "agents",
      "kind": "data",
      "hasDefault": true,
      "default": []
    },
    {
      "op": "add",
      "key": "selectedConfigId",
      "kind": "data",
      "hasDefault": true,
      "default": "codex-acp"
    },
    {
      "op": "add",
      "key": "sessions",
      "kind": "data",
      "hasDefault": true,
      "default": {}
    },
    {
      "op": "add",
      "key": "configOptions",
      "kind": "data",
      "hasDefault": true,
      "default": []
    },
    {
      "op": "add",
      "key": "orchestratorViewPath",
      "kind": "data",
      "hasDefault": true,
      "default": "/views/orchestrator/index.html"
    },
    {
      "op": "add",
      "key": "sidebarOpen",
      "kind": "data",
      "hasDefault": true,
      "default": false
    },
    {
      "op": "add",
      "key": "tabSidebarOpen",
      "kind": "data",
      "hasDefault": true,
      "default": true
    },
    {
      "op": "add",
      "key": "sidebarPanel",
      "kind": "data",
      "hasDefault": true,
      "default": "overview"
    },
    {
      "op": "add",
      "key": "viewRegistry",
      "kind": "data",
      "hasDefault": true,
      "default": []
    },
    {
      "op": "add",
      "key": "commands",
      "kind": "data",
      "hasDefault": true,
      "default": []
    }
  ],
}

export default migration
