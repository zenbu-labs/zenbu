import type * as acp from "@agentclientprotocol/sdk"
import { nanoid } from "nanoid"
import type { ScenarioStep } from "../../shared/schema.ts"
import { chunkText, sleep } from "./streaming.ts"
import type { SimulationContext } from "./engine.ts"
import { readLiveConfig } from "./engine.ts"

type ToolCallStep = Extract<ScenarioStep, { type: "tool_call" }>

export async function emitToolCall(
  ctx: SimulationContext,
  step: ToolCallStep,
): Promise<void> {
  const toolCallId = `mock_tc_${nanoid(8)}`
  const { conn, sessionId, signal } = ctx

  conn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      title: step.title,
      kind: step.kind,
      status: "pending",
    },
  })

  if (step.requestPermission) {
    const result = await conn.requestPermission({
      sessionId,
      toolCall: {
        toolCallId,
        title: step.title,
        kind: step.kind,
        status: "pending",
      },
      options: [
        { optionId: "allow", name: "Allow", kind: "allow_once" },
        { optionId: "reject", name: "Reject", kind: "reject_once" },
      ],
    })

    const approved =
      result.outcome.outcome === "selected" &&
      result.outcome.optionId === "allow"

    if (!approved) {
      conn.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId,
          title: step.title,
          kind: step.kind,
          status: "completed",
          content: [
            {
              type: "content",
              content: { type: "text", text: "Permission denied by user." },
            },
          ],
        },
      })
      return
    }
  }

  conn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      title: step.title,
      kind: step.kind,
      status: "in_progress",
    },
  })

  const { config, fuzz } = await readLiveConfig(ctx.db)
  await sleep(config.toolCallDelayMs, signal)

  if (step.output) {
    const chunks = chunkText(step.output, config, fuzz)
    for (const chunk of chunks) {
      signal?.throwIfAborted()
      await sleep(chunk.delayMs, signal)
      conn.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId,
          content: [
            {
              type: "content",
              content: { type: "text", text: chunk.text },
            },
          ],
        },
      })
    }
  }

  await sleep(Math.round(step.durationMs * 0.3), signal)

  conn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      title: step.title,
      kind: step.kind,
      status: "completed",
      ...(step.output
        ? {
            content: [
              {
                type: "content" as const,
                content: { type: "text" as const, text: step.output },
              },
            ],
          }
        : {}),
    },
  })
}
