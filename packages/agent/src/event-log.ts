import { Effect } from "effect";
import type { SessionUpdate } from "@agentclientprotocol/sdk";

export type EventLogError = {
  code: "EVENT_LOG_WRITE_FAILED" | "EVENT_LOG_READ_FAILED";
  message: string;
};

export interface EventLog {
  append: (events: SessionUpdate[]) => Effect.Effect<void, EventLogError>;
  read?: () => Effect.Effect<SessionUpdate[], EventLogError>;
}
