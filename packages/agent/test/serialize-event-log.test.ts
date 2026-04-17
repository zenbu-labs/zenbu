import { describe, it, expect } from "vitest";
import {
  materializeToBlocks,
  serializeEventLog,
  truncateToTokenBudget,
} from "../src/serialize-event-log.ts";

describe("materializeToBlocks", () => {
  it("handles user prompts", () => {
    const events = [
      { timestamp: 1, data: { kind: "user_prompt" as const, text: "hello" } },
    ];
    const blocks = materializeToBlocks(events);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ role: "user", content: "hello", blobIds: [] });
  });

  it("handles agent message chunks and merges consecutive ones", () => {
    const events = [
      {
        timestamp: 1,
        data: {
          kind: "session_update" as const,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "Hello" },
          },
        },
      },
      {
        timestamp: 2,
        data: {
          kind: "session_update" as const,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: " world" },
          },
        },
      },
    ];
    const blocks = materializeToBlocks(events);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].role).toBe("assistant");
    if (blocks[0].role === "assistant") {
      expect(blocks[0].content).toBe("Hello world");
    }
  });

  it("handles interrupted events", () => {
    const events = [
      { timestamp: 1, data: { kind: "interrupted" as const } },
    ];
    const blocks = materializeToBlocks(events);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].role).toBe("interrupted");
  });

  it("handles mixed user and assistant blocks", () => {
    const events = [
      { timestamp: 1, data: { kind: "user_prompt" as const, text: "Question?" } },
      {
        timestamp: 2,
        data: {
          kind: "session_update" as const,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "Answer." },
          },
        },
      },
      { timestamp: 3, data: { kind: "user_prompt" as const, text: "Follow-up?" } },
    ];
    const blocks = materializeToBlocks(events);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].role).toBe("user");
    expect(blocks[1].role).toBe("assistant");
    expect(blocks[2].role).toBe("user");
  });

  it("handles tool call events", () => {
    const events = [
      {
        timestamp: 1,
        data: {
          kind: "session_update" as const,
          update: {
            sessionUpdate: "tool_call",
            toolCallId: "tc1",
            kind: "shell",
            title: "ls -la",
            status: "completed",
            content: [],
          },
        },
      },
    ];
    const blocks = materializeToBlocks(events);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].role).toBe("tool");
    if (blocks[0].role === "tool") {
      expect(blocks[0].kind).toBe("shell");
      expect(blocks[0].title).toBe("ls -la");
    }
  });

  it("ignores usage_update events", () => {
    const events = [
      {
        timestamp: 1,
        data: {
          kind: "session_update" as const,
          update: { sessionUpdate: "usage_update", tokens: 100 },
        },
      },
    ];
    const blocks = materializeToBlocks(events);
    expect(blocks).toHaveLength(0);
  });
});

describe("serializeEventLog", () => {
  it("produces prefixed text lines for each block type", () => {
    const events = [
      { timestamp: 1, data: { kind: "user_prompt" as const, text: "Hello" } },
      {
        timestamp: 2,
        data: {
          kind: "session_update" as const,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "Hi there" },
          },
        },
      },
      { timestamp: 3, data: { kind: "interrupted" as const } },
    ];
    const { texts, blobIds } = serializeEventLog(events);
    expect(texts).toHaveLength(3);
    expect(texts[0]).toBe("[user] Hello");
    expect(texts[1]).toBe("[assistant] Hi there");
    expect(texts[2]).toBe("[interrupted]");
    expect(blobIds).toHaveLength(0);
  });

  it("includes tool kind and title", () => {
    const events = [
      {
        timestamp: 1,
        data: {
          kind: "session_update" as const,
          update: {
            sessionUpdate: "tool_call",
            toolCallId: "tc1",
            kind: "shell",
            title: "cat file.txt",
            status: "completed",
            content: [],
          },
        },
      },
    ];
    const { texts } = serializeEventLog(events);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("[tool:shell]");
    expect(texts[0]).toContain("cat file.txt");
  });

  it("returns empty arrays for no events", () => {
    const { texts, blobIds } = serializeEventLog([]);
    expect(texts).toHaveLength(0);
    expect(blobIds).toHaveLength(0);
  });
});

describe("truncateToTokenBudget", () => {
  it("returns text unchanged when within budget", () => {
    const text = "hello world foo bar";
    expect(truncateToTokenBudget(text, 100)).toBe(text);
  });

  it("truncates from the start and keeps most recent words", () => {
    const words = Array.from({ length: 100 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const result = truncateToTokenBudget(text, 20);
    expect(result).toContain("[...earlier conversation truncated...]");
    expect(result).toContain("word99");
    expect(result).toContain("word90");
    expect(result).not.toContain("word0 ");
  });

  it("uses 2-tokens-per-word heuristic", () => {
    const words = Array.from({ length: 200 }, (_, i) => `w${i}`);
    const text = words.join(" ");
    const result = truncateToTokenBudget(text, 100);
    const resultWords = result.split(/\s+/);
    const prefixWords = "[...earlier conversation truncated...]".split(/\s+/).length;
    expect(resultWords.length).toBeLessThanOrEqual(50 + prefixWords + 1);
  });

  it("handles large inputs efficiently", () => {
    const words = Array.from({ length: 200_000 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const start = Date.now();
    const result = truncateToTokenBudget(text, 100_000);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
    expect(result).toContain("word199999");
    expect(result).toContain("[...earlier conversation truncated...]");
  });
});
