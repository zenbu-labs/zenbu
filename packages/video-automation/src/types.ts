export type JudgeId = string;

export type JudgeProvider = "gemini-flash" | "gemini-pro" | "openai-gpt";

export interface JudgeConfig {
  id: JudgeProvider;
  name: string;
  model: string;
  provider: "google" | "openai";
  description: string;
  supportsNativeVideo: boolean;
}

export type JudgmentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type Verdict = "pass" | "fail" | "inconclusive";

export interface JudgmentResult {
  judgeId: JudgeProvider;
  judgeName: string;
  status: JudgmentStatus;
  verdict?: Verdict;
  confidence?: number;
  reasoning?: string;
  details?: string;
  durationMs?: number;
  error?: string;
}

export interface OracleResult {
  status: JudgmentStatus;
  verdict?: Verdict;
  confidence?: number;
  summary?: string;
  reasoning?: string;
  durationMs?: number;
  error?: string;
}

export interface JudgmentSession {
  id: string;
  createdAt: string;
  expectation: string;
  videoFilename: string;
  videoSize: number;
  judges: JudgmentResult[];
  oracle: OracleResult;
  status: "pending" | "running" | "completed" | "failed";
}
