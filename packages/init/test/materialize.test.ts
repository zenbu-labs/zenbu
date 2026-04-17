import { describe, expect, it } from "vitest"
import { materializeMessages } from "../src/renderer/views/chat/lib/materialize"

type TestEvent = Parameters<typeof materializeMessages>[0][number]

function userPrompt(timestamp: number, text: string): TestEvent {
  return {
    timestamp,
    data: { kind: "user_prompt", text },
  }
}

function sessionText(
  timestamp: number,
  sessionUpdate: "user_message_chunk" | "agent_message_chunk" | "agent_thought_chunk",
  text: string,
): TestEvent {
  return {
    timestamp,
    data: {
      kind: "session_update",
      update: {
        sessionUpdate,
        content: { type: "text", text },
      },
    },
  }
}

function keyByContent(messages: ReturnType<typeof materializeMessages>, role: string, content: string) {
  const match = messages.find((message) => message.role === role && "content" in message && message.content === content)
  expect(match).toBeDefined()
  return match?.key
}

describe("materializeMessages", () => {
  it("keeps visible message keys stable when older events are prepended", () => {
    const visible = [
      userPrompt(1000, "latest user"),
      sessionText(1001, "agent_thought_chunk", "latest thought"),
      sessionText(1002, "agent_message_chunk", "latest answer"),
    ]
    const prepended = [
      userPrompt(900, "older user"),
      sessionText(901, "agent_message_chunk", "older answer"),
    ]

    const visibleMessages = materializeMessages(visible)
    const expandedMessages = materializeMessages([...prepended, ...visible])

    expect(keyByContent(expandedMessages, "user", "latest user")).toBe(
      keyByContent(visibleMessages, "user", "latest user"),
    )
    expect(keyByContent(expandedMessages, "thinking", "latest thought")).toBe(
      keyByContent(visibleMessages, "thinking", "latest thought"),
    )
    expect(keyByContent(expandedMessages, "assistant", "latest answer")).toBe(
      keyByContent(visibleMessages, "assistant", "latest answer"),
    )
  })

  it("distinguishes same-role chunks with the same timestamp", () => {
    const messages = materializeMessages([
      sessionText(1000, "agent_message_chunk", "first answer"),
      userPrompt(1001, "separator"),
      sessionText(1000, "agent_message_chunk", "second answer"),
    ])

    const assistantMessages = messages.filter(
      (message): message is Extract<(typeof messages)[number], { role: "assistant" }> =>
        message.role === "assistant",
    )

    expect(assistantMessages).toHaveLength(2)
    expect(assistantMessages[0].key).not.toBe(assistantMessages[1].key)
  })
})
