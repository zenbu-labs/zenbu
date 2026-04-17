import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter, Readable, Writable } from "node:stream";
import { codexMessageShapes } from "../../src/agents/codex.ts";

describe("CodexProvider", () => {
  describe("isAvailable", () => {
    it("returns true when codex binary exists", async () => {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);

      let available = false;
      try {
        await execAsync("which codex");
        available = true;
      } catch {
        available = false;
      }

      const { CodexProvider } = await import("../../src/agents/codex.ts");
      const provider = new CodexProvider();
      const result = await provider.isAvailable();
      expect(result).toBe(available);
    });
  });

  describe("message shapes", () => {
    it("initialize includes required clientInfo fields", () => {
      const msg = codexMessageShapes.initialize("test_client");
      expect(msg.method).toBe("initialize");
      expect(msg.params.clientInfo).toEqual({
        name: "test_client",
        title: "Puter CLI",
        version: "0.0.1",
      });
    });

    it("initialized is a notification shape (no id)", () => {
      const msg = codexMessageShapes.initialized();
      expect(msg.method).toBe("initialized");
      expect(msg).not.toHaveProperty("id");
    });

    it("thread/start contains all required params", () => {
      const msg = codexMessageShapes.threadStart("gpt-5.4", "/home/user");
      expect(msg.params).toEqual({
        model: "gpt-5.4",
        cwd: "/home/user",
        approvalPolicy: "never",
        sandbox: "workspace-write",
      });
    });

    it("turn/start wraps text in input content block array", () => {
      const msg = codexMessageShapes.turnStart("thr_1", "explain this");
      expect(msg.params.threadId).toBe("thr_1");
      expect(msg.params.input).toEqual([
        { type: "text", text: "explain this" },
      ]);
    });

    it("turn/start preserves exact prompt text", () => {
      const prompt = "What does\nthis multi-line\nprompt do?";
      const msg = codexMessageShapes.turnStart("thr_2", prompt);
      expect(msg.params.input[0].text).toBe(prompt);
    });
  });
});

describe("Codex delta accumulation logic", () => {
  function simulateCodexStream(
    notifications: Array<{ method: string; params: any }>
  ): { text: string; completed: boolean; error?: string } {
    let text = "";
    let completed = false;
    let error: string | undefined;

    for (const n of notifications) {
      if (
        n.method === "item/agentMessage/delta" ||
        n.method === "codex/event/agent_message_content_delta"
      ) {
        text += n.params.delta ?? n.params.content ?? "";
      } else if (n.method === "turn/completed") {
        completed = true;
        if (n.params?.turn?.error) {
          error = n.params.turn.error.message ?? JSON.stringify(n.params.turn.error);
        }
      }
    }

    return { text, completed, error };
  }

  it("accumulates simple deltas", () => {
    const result = simulateCodexStream([
      { method: "item/agentMessage/delta", params: { delta: "Hello " } },
      { method: "item/agentMessage/delta", params: { delta: "world" } },
      { method: "turn/completed", params: { turn: { id: "t1" } } },
    ]);
    expect(result.text).toBe("Hello world");
    expect(result.completed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("handles empty deltas", () => {
    const result = simulateCodexStream([
      { method: "item/agentMessage/delta", params: { delta: "" } },
      { method: "item/agentMessage/delta", params: { delta: "content" } },
      { method: "turn/completed", params: { turn: { id: "t1" } } },
    ]);
    expect(result.text).toBe("content");
  });

  it("detects errors in turn/completed", () => {
    const result = simulateCodexStream([
      { method: "item/agentMessage/delta", params: { delta: "partial" } },
      {
        method: "turn/completed",
        params: {
          turn: { id: "t1", error: { message: "context_length_exceeded" } },
        },
      },
    ]);
    expect(result.text).toBe("partial");
    expect(result.error).toBe("context_length_exceeded");
  });

  it("handles interleaved non-delta notifications", () => {
    const result = simulateCodexStream([
      { method: "item/agentMessage/delta", params: { delta: "start " } },
      { method: "item/started", params: { item: { type: "tool_call" } } },
      { method: "item/completed", params: { item: { type: "tool_call" } } },
      { method: "item/agentMessage/delta", params: { delta: "end" } },
      { method: "turn/completed", params: { turn: { id: "t1" } } },
    ]);
    expect(result.text).toBe("start end");
  });
});
