import { JudgeConfig } from "./types";

export const JUDGE_CONFIGS: JudgeConfig[] = [
  {
    id: "gemini-flash",
    name: "Gemini 3 Flash",
    model: "gemini-3-flash-preview",
    provider: "google",
    description: "Fast, native video — ~85% Video-MME",
    supportsNativeVideo: true,
  },
  {
    id: "gemini-pro",
    name: "Gemini 3.1 Pro",
    model: "gemini-3.1-pro-preview",
    provider: "google",
    description: "Highest quality — ~88% Video-MME",
    supportsNativeVideo: true,
  },
  {
    id: "openai-gpt",
    name: "GPT-5.4",
    model: "gpt-5.4",
    provider: "openai",
    description: "Latest OpenAI — image-based analysis",
    supportsNativeVideo: false,
  },
];

export const JUDGE_SYSTEM_PROMPT = `You are a video verification judge. You are given a video recording and an expectation about what should happen in that video.

Your job is to carefully analyze the video and determine whether the expectation is met.

You MUST respond with a JSON object (no markdown, no code fences) in this exact format:
{
  "verdict": "pass" | "fail" | "inconclusive",
  "confidence": <number between 0 and 1>,
  "reasoning": "<detailed explanation of what you observed>",
  "details": "<specific timestamps or visual elements that support your verdict>"
}

Rules:
- "pass" means the expectation is clearly met in the video
- "fail" means the expectation is clearly NOT met
- "inconclusive" means you cannot determine with reasonable confidence
- Be thorough in your reasoning - describe what you actually see
- Reference specific visual elements, UI states, animations, transitions
- If the video quality is poor or the content is unclear, lean toward "inconclusive"
- For animations: analyze every available frame carefully. Compare element positions, sizes, and opacity between frames to detect motion, transitions, easing curves, and timing. Even subtle per-frame differences reveal animation behavior.
- For UI transitions: note the exact before/after states and whether the transition between them is smooth, instant, or animated`;

export const ORACLE_SYSTEM_PROMPT = `You are the final arbiter in a video verification system. Multiple AI judges have analyzed the same video against the same expectation. You are given their individual verdicts and reasoning.

Your job is to synthesize their findings into a final, authoritative verdict.

You MUST respond with a JSON object (no markdown, no code fences) in this exact format:
{
  "verdict": "pass" | "fail" | "inconclusive",
  "confidence": <number between 0 and 1>,
  "summary": "<one-sentence final determination>",
  "reasoning": "<detailed explanation of how you weighed the judges' opinions>"
}

Rules:
- If all judges agree, your confidence should be high
- If judges disagree, weigh the more detailed reasoning more heavily
- Gemini models with native video access should be weighted more than frame-based analysis
- If the majority says pass with good reasoning, lean pass
- If any judge raises a credible concern about failure, address it explicitly
- Never ignore a dissenting opinion - always explain why you agree or disagree`;
