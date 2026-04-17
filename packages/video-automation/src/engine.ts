import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { GoogleGenAI, MediaResolution } from "@google/genai";
import { JUDGE_CONFIGS, JUDGE_SYSTEM_PROMPT, ORACLE_SYSTEM_PROMPT } from "./judges";
import { JudgmentResult, JudgeConfig, OracleResult, Verdict } from "./types";
import { getSession, setSession } from "./store";
import { assertInvariant, logInvariant } from "./invariants";

const VIDEO_FPS = 24; // Max supported by Gemini — captures every frame of animation

export interface VideoAutomationConfig {
  googleApiKey?: string;
  openaiApiKey?: string;
}

let _googleAI: GoogleGenAI | null = null;

function getGoogleAI(config?: VideoAutomationConfig): GoogleGenAI {
  if (!_googleAI) {
    _googleAI = new GoogleGenAI({
      apiKey: config?.googleApiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    });
  }
  return _googleAI;
}

function parseJudgeResponse(text: string): {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  details: string;
} {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      verdict: parsed.verdict || "inconclusive",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning || "",
      details: parsed.details || "",
    };
  } catch {
    const lowerText = text.toLowerCase();
    let verdict: Verdict = "inconclusive";
    if (lowerText.includes('"pass"') || lowerText.includes("verdict: pass")) {
      verdict = "pass";
    } else if (lowerText.includes('"fail"') || lowerText.includes("verdict: fail")) {
      verdict = "fail";
    }
    return {
      verdict,
      confidence: 0.3,
      reasoning: text.slice(0, 500),
      details: "",
    };
  }
}

function parseOracleResponse(text: string): {
  verdict: Verdict;
  confidence: number;
  summary: string;
  reasoning: string;
} {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      verdict: parsed.verdict || "inconclusive",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      summary: parsed.summary || "",
      reasoning: parsed.reasoning || "",
    };
  } catch {
    return {
      verdict: "inconclusive",
      confidence: 0.3,
      summary: "Failed to parse oracle response",
      reasoning: text.slice(0, 500),
    };
  }
}

const VALID_VERDICTS = new Set(["pass", "fail", "inconclusive"]);

async function runSingleJudge(
  sessionId: string,
  config: JudgeConfig,
  videoBase64: string,
  expectation: string,
): Promise<JudgmentResult> {
  const phase = `judge:${config.id}`;
  const start = Date.now();

  logInvariant(sessionId, phase, `Starting judge ${config.id} (${config.model})`);

  // INV: video data must be non-empty base64
  assertInvariant(
    sessionId, phase,
    "video_base64_non_empty",
    videoBase64.length > 0,
    "non-empty base64 string",
    `length=${videoBase64.length}`,
  );

  // INV: expectation must be non-empty
  assertInvariant(
    sessionId, phase,
    "expectation_non_empty",
    expectation.length > 0,
    "non-empty expectation",
    `length=${expectation.length}`,
  );

  try {
    logInvariant(sessionId, phase, `Calling model ${config.model} (provider: ${config.provider})`);

    let responseText: string;

    if (config.provider === "google") {
      // Use native @google/genai SDK for Google models
      // This gives us fps control (up to 24) and MEDIA_RESOLUTION_HIGH
      logInvariant(sessionId, phase, `Using native Google SDK with fps=${VIDEO_FPS}, MEDIA_RESOLUTION_HIGH`);

      const response = await getGoogleAI().models.generateContent({
        model: config.model,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "video/mp4",
                  data: videoBase64,
                },
                videoMetadata: {
                  fps: VIDEO_FPS,
                },
              },
              {
                text: `${JUDGE_SYSTEM_PROMPT}\n\nEXPECTATION TO VERIFY:\n${expectation}\n\nAnalyze the video and determine if this expectation is met. Respond with the JSON format specified above.`,
              },
            ],
          },
        ],
        config: {
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
          maxOutputTokens: 2048,
        },
      });

      responseText = response.text ?? "";
    } else {
      // Use AI SDK for non-Google models (OpenAI etc.)
      const content: Array<
        | { type: "text"; text: string }
        | { type: "file"; data: string; mediaType: string }
      > = [];

      content.push({
        type: "text",
        text: "[Note: This model does not support direct video input. The video data has been provided but may not be fully processed. Please analyze what visual information is available.]",
      });
      content.push({
        type: "file",
        data: videoBase64,
        mediaType: "video/mp4",
      });
      content.push({
        type: "text",
        text: `EXPECTATION TO VERIFY:\n${expectation}\n\nAnalyze the video and determine if this expectation is met. Respond with the JSON format specified in your instructions.`,
      });

      const result = await generateText({
        model: openai(config.model),
        system: JUDGE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user" as const,
            content: content as Array<{ type: "text"; text: string } | { type: "file"; data: string; mediaType: string }>,
          },
        ],
        maxOutputTokens: 2048,
      });

      responseText = result.text;
    }

    // INV: model must return non-empty text
    assertInvariant(
      sessionId, phase,
      "model_returned_text",
      responseText.length > 0,
      "non-empty response text",
      `length=${responseText.length}`,
    );

    logInvariant(sessionId, phase, `Got response (${responseText.length} chars), parsing...`);

    const parsed = parseJudgeResponse(responseText);
    const durationMs = Date.now() - start;

    // INV: verdict must be one of the valid values
    assertInvariant(
      sessionId, phase,
      "verdict_is_valid",
      VALID_VERDICTS.has(parsed.verdict),
      "pass | fail | inconclusive",
      parsed.verdict,
    );

    // INV: confidence must be 0-1
    assertInvariant(
      sessionId, phase,
      "confidence_in_range",
      parsed.confidence >= 0 && parsed.confidence <= 1,
      "0 <= confidence <= 1",
      String(parsed.confidence),
    );

    // INV: reasoning must be non-empty
    assertInvariant(
      sessionId, phase,
      "reasoning_non_empty",
      parsed.reasoning.length > 0,
      "non-empty reasoning",
      `length=${parsed.reasoning.length}`,
    );

    // INV: duration must be positive
    assertInvariant(
      sessionId, phase,
      "duration_positive",
      durationMs > 0,
      "positive duration",
      `${durationMs}ms`,
    );

    logInvariant(sessionId, phase, `Completed: verdict=${parsed.verdict} confidence=${parsed.confidence} in ${durationMs}ms`);

    return {
      judgeId: config.id,
      judgeName: config.name,
      status: "completed",
      verdict: parsed.verdict,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      details: parsed.details,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);

    logInvariant(sessionId, phase, `FAILED after ${durationMs}ms: ${errorMsg}`);

    // INV: failed result must contain an error message
    assertInvariant(
      sessionId, phase,
      "failed_has_error_message",
      errorMsg.length > 0,
      "non-empty error message",
      `length=${errorMsg.length}`,
    );

    return {
      judgeId: config.id,
      judgeName: config.name,
      status: "failed",
      error: errorMsg,
      durationMs,
    };
  }
}

async function runOracle(
  sessionId: string,
  results: JudgmentResult[],
  expectation: string,
): Promise<OracleResult> {
  const phase = "oracle";
  const start = Date.now();

  logInvariant(sessionId, phase, `Starting oracle with ${results.length} judge results`);

  const completedResults = results.filter((r) => r.status === "completed");

  // INV: we must have at least the total results we were given
  assertInvariant(
    sessionId, phase,
    "results_array_non_empty",
    results.length > 0,
    "at least 1 judge result",
    `${results.length} results`,
  );

  logInvariant(sessionId, phase, `${completedResults.length}/${results.length} judges completed`);

  if (completedResults.length === 0) {
    logInvariant(sessionId, phase, "No judges completed — oracle cannot proceed");
    return {
      status: "failed",
      error: "No judges completed successfully",
      durationMs: Date.now() - start,
    };
  }

  if (completedResults.length === 1) {
    const single = completedResults[0];

    // INV: single judge passthrough must have a verdict
    assertInvariant(
      sessionId, phase,
      "single_judge_has_verdict",
      single.verdict !== undefined,
      "defined verdict",
      String(single.verdict),
    );

    logInvariant(sessionId, phase, `Single judge passthrough: ${single.verdict}`);

    return {
      status: "completed",
      verdict: single.verdict,
      confidence: single.confidence,
      summary: `Single judge (${single.judgeName}) determined: ${single.verdict}`,
      reasoning: single.reasoning,
      durationMs: Date.now() - start,
    };
  }

  try {
    const judgesSummary = completedResults
      .map(
        (r) =>
          `## ${r.judgeName} (${r.judgeId})\n- Verdict: ${r.verdict}\n- Confidence: ${r.confidence}\n- Reasoning: ${r.reasoning}\n- Details: ${r.details || "None"}`
      )
      .join("\n\n");

    logInvariant(sessionId, phase, "Calling Claude for synthesis");

    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: ORACLE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `ORIGINAL EXPECTATION:\n${expectation}\n\nJUDGE RESULTS:\n${judgesSummary}\n\nSynthesize these results into a final verdict.`,
        },
      ],
      maxOutputTokens: 2048,
    });

    // INV: oracle must return text
    assertInvariant(
      sessionId, phase,
      "oracle_returned_text",
      result.text.length > 0,
      "non-empty oracle response",
      `length=${result.text.length}`,
    );

    const parsed = parseOracleResponse(result.text);

    // INV: oracle verdict must be valid
    assertInvariant(
      sessionId, phase,
      "oracle_verdict_valid",
      VALID_VERDICTS.has(parsed.verdict),
      "pass | fail | inconclusive",
      parsed.verdict,
    );

    logInvariant(sessionId, phase, `Oracle verdict: ${parsed.verdict} confidence=${parsed.confidence}`);

    return {
      status: "completed",
      verdict: parsed.verdict,
      confidence: parsed.confidence,
      summary: parsed.summary,
      reasoning: parsed.reasoning,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    logInvariant(sessionId, phase, `Oracle model failed, falling back to majority vote: ${error instanceof Error ? error.message : String(error)}`);

    const verdictCounts = { pass: 0, fail: 0, inconclusive: 0 };
    for (const r of completedResults) {
      if (r.verdict) verdictCounts[r.verdict]++;
    }
    const maxVerdict = (Object.entries(verdictCounts) as [string, number][])
      .sort((a, b) => b[1] - a[1])[0][0] as "pass" | "fail" | "inconclusive";

    // INV: fallback verdict must still be valid
    assertInvariant(
      sessionId, phase,
      "fallback_verdict_valid",
      VALID_VERDICTS.has(maxVerdict),
      "pass | fail | inconclusive",
      maxVerdict,
    );

    logInvariant(sessionId, phase, `Fallback verdict: ${maxVerdict}`);

    return {
      status: "completed",
      verdict: maxVerdict,
      confidence: verdictCounts[maxVerdict] / completedResults.length,
      summary: `Majority vote: ${maxVerdict} (oracle model unavailable)`,
      reasoning: `Oracle failed (${error instanceof Error ? error.message : String(error)}). Fell back to majority vote.`,
      durationMs: Date.now() - start,
    };
  }
}

export async function runJudgment(
  sessionId: string,
  videoBase64: string,
  expectation: string,
  judgeIds?: string[],
): Promise<void> {
  const phase = "orchestrator";

  logInvariant(sessionId, phase, `Starting judgment session ${sessionId}`);

  const session = getSession(sessionId);

  // INV: session must exist before we run
  assertInvariant(
    sessionId, phase,
    "session_exists",
    session !== undefined,
    "session to exist in store",
    session ? "exists" : "undefined",
  );

  if (!session) throw new Error(`Session ${sessionId} not found`);

  const configs = judgeIds
    ? JUDGE_CONFIGS.filter((c) => judgeIds.includes(c.id))
    : JUDGE_CONFIGS;

  // INV: at least one judge must be configured
  assertInvariant(
    sessionId, phase,
    "at_least_one_judge",
    configs.length > 0,
    "at least 1 judge config",
    `${configs.length} configs`,
  );

  logInvariant(sessionId, phase, `Running ${configs.length} judges: ${configs.map(c => c.id).join(", ")}`);

  // Transition to running
  session.status = "running";
  session.judges = configs.map((c) => ({
    judgeId: c.id,
    judgeName: c.name,
    status: "processing",
  }));
  session.oracle = { status: "pending" };
  setSession(session);

  // INV: after transition, status must be "running"
  const afterStart = getSession(sessionId);
  assertInvariant(
    sessionId, phase,
    "status_is_running",
    afterStart?.status === "running",
    "running",
    afterStart?.status || "undefined",
  );

  // INV: all judges must start as "processing"
  assertInvariant(
    sessionId, phase,
    "all_judges_processing",
    afterStart?.judges.every((j) => j.status === "processing") ?? false,
    "all judges processing",
    afterStart?.judges.map((j) => `${j.judgeId}:${j.status}`).join(", ") || "none",
  );

  // Run all judges in parallel
  const results = await Promise.allSettled(
    configs.map(async (config) => {
      const result = await runSingleJudge(sessionId, config, videoBase64, expectation);

      // Update session with this judge's result as it completes
      const current = getSession(sessionId);
      if (current) {
        const idx = current.judges.findIndex((j) => j.judgeId === config.id);
        if (idx !== -1) {
          current.judges[idx] = result;
        }
        setSession(current);
      }

      return result;
    })
  );

  // Collect results
  const judgeResults: JudgmentResult[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      judgeId: configs[i].id,
      judgeName: configs[i].name,
      status: "failed" as const,
      error: r.reason?.message || "Unknown error",
    };
  });

  // INV: we must have exactly as many results as judges we ran
  assertInvariant(
    sessionId, phase,
    "result_count_matches_judge_count",
    judgeResults.length === configs.length,
    `${configs.length} results`,
    `${judgeResults.length} results`,
  );

  // INV: every result must have a terminal status
  for (const r of judgeResults) {
    assertInvariant(
      sessionId, phase,
      `judge_${r.judgeId}_terminal_status`,
      r.status === "completed" || r.status === "failed",
      "completed or failed",
      r.status,
    );
  }

  logInvariant(sessionId, phase, `All judges done. Completed: ${judgeResults.filter(r => r.status === "completed").length}, Failed: ${judgeResults.filter(r => r.status === "failed").length}`);

  // Update session before oracle
  const current = getSession(sessionId);
  if (current) {
    current.judges = judgeResults;
    current.oracle = { status: "processing" };
    setSession(current);
  }

  // INV: oracle must be "processing" before we call it
  const beforeOracle = getSession(sessionId);
  assertInvariant(
    sessionId, phase,
    "oracle_is_processing",
    beforeOracle?.oracle.status === "processing",
    "processing",
    beforeOracle?.oracle.status || "undefined",
  );

  // Run oracle
  const oracleResult = await runOracle(sessionId, judgeResults, expectation);

  // INV: oracle must have terminal status
  assertInvariant(
    sessionId, phase,
    "oracle_terminal_status",
    oracleResult.status === "completed" || oracleResult.status === "failed",
    "completed or failed",
    oracleResult.status,
  );

  // Final update
  const final = getSession(sessionId);
  if (final) {
    final.judges = judgeResults;
    final.oracle = oracleResult;
    final.status = "completed";
    setSession(final);
  }

  // INV: final session must be "completed"
  const done = getSession(sessionId);
  assertInvariant(
    sessionId, phase,
    "session_completed",
    done?.status === "completed",
    "completed",
    done?.status || "undefined",
  );

  // INV: final session oracle must match what we computed
  assertInvariant(
    sessionId, phase,
    "oracle_result_stored",
    done?.oracle.status === oracleResult.status,
    oracleResult.status,
    done?.oracle.status || "undefined",
  );

  logInvariant(sessionId, phase, `Session ${sessionId} completed. Oracle verdict: ${oracleResult.verdict || "none"}`);
}

export function createEngine(config?: VideoAutomationConfig) {
  if (config?.googleApiKey) {
    _googleAI = new GoogleGenAI({ apiKey: config.googleApiKey });
  }
  return { runJudgment, runSingleJudge, runOracle };
}
