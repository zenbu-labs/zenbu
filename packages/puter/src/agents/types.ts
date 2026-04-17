export type AgentName = "codex" | "opencode";

export interface PromptOptions {
  onDelta?: (delta: string, accumulated: string) => void;
}

export interface AgentProvider {
  readonly name: AgentName;
  isAvailable(): Promise<boolean>;
  createSession(): Promise<AgentSession>;
}

export interface AgentSession {
  prompt(text: string, opts?: PromptOptions): Promise<string>;
  close(): void;
}
