import { Effect } from "effect";

export type AgentStoreError = {
  code: "AGENT_STORE_ERROR";
  message: string;
};

export interface AgentStore {
  getSessionId: (agentId: string) => Effect.Effect<string | null, AgentStoreError>;
  setSessionId: (agentId: string, sessionId: string) => Effect.Effect<void, AgentStoreError>;
  deleteSessionId: (agentId: string) => Effect.Effect<void, AgentStoreError>;
}
