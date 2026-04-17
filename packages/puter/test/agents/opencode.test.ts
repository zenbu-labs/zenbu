import { describe, it, expect } from "vitest";
import { acpMessageShapes } from "../../src/agents/opencode.ts";

describe("OpenCodeProvider", () => {
  describe("isAvailable", () => {
    it("returns true when opencode binary exists", async () => {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);

      let available = false;
      try {
        await execAsync("which opencode");
        available = true;
      } catch {
        available = false;
      }

      const { OpenCodeProvider } = await import(
        "../../src/agents/opencode.ts"
      );
      const provider = new OpenCodeProvider();
      const result = await provider.isAvailable();
      expect(result).toBe(available);
    });
  });

  describe("message shapes", () => {
    it("initialize includes protocolVersion", () => {
      const msg = acpMessageShapes.initialize("test_client");
      expect(msg.params.protocolVersion).toBe(1);
    });

    it("initialize includes clientCapabilities", () => {
      const msg = acpMessageShapes.initialize("test_client");
      expect(msg.params.clientCapabilities).toBeDefined();
    });

    it("initialize includes clientInfo", () => {
      const msg = acpMessageShapes.initialize("test_client");
      expect(msg.params.clientInfo).toEqual({
        name: "test_client",
        title: "Puter CLI",
        version: "0.0.1",
      });
    });

    it("session/new has empty params", () => {
      const msg = acpMessageShapes.sessionNew();
      expect(msg.method).toBe("session/new");
      expect(msg.params).toEqual({});
    });

    it("session/prompt wraps text in content block array", () => {
      const msg = acpMessageShapes.sessionPrompt("sess_1", "explain");
      expect(msg.params.sessionId).toBe("sess_1");
      expect(msg.params.prompt).toEqual([
        { type: "text", text: "explain" },
      ]);
    });

    it("session/cancel includes sessionId", () => {
      const msg = acpMessageShapes.sessionCancel("sess_1");
      expect(msg.method).toBe("session/cancel");
      expect(msg.params.sessionId).toBe("sess_1");
    });

    it("all messages include jsonrpc 2.0", () => {
      expect(acpMessageShapes.initialize("x").jsonrpc).toBe("2.0");
      expect(acpMessageShapes.sessionNew().jsonrpc).toBe("2.0");
      expect(acpMessageShapes.sessionPrompt("s", "t").jsonrpc).toBe("2.0");
      expect(acpMessageShapes.sessionCancel("s").jsonrpc).toBe("2.0");
    });
  });
});

describe("ACP session/update accumulation logic", () => {
  type AcpUpdate = {
    method: string;
    params: {
      sessionId: string;
      update: {
        sessionUpdate: string;
        content?: { type: string; text?: string };
        [key: string]: any;
      };
    };
  };

  function simulateAcpStream(
    events: AcpUpdate[],
    stopReason: string
  ): { text: string; stopReason: string } {
    let text = "";

    for (const event of events) {
      const update = event.params.update;
      if (
        update.sessionUpdate === "agent_message_chunk" &&
        update.content?.type === "text"
      ) {
        text += update.content.text ?? "";
      }
    }

    return { text, stopReason };
  }

  it("accumulates text chunks", () => {
    const result = simulateAcpStream(
      [
        {
          method: "session/update",
          params: {
            sessionId: "s1",
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "Hello " },
            },
          },
        },
        {
          method: "session/update",
          params: {
            sessionId: "s1",
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "world" },
            },
          },
        },
      ],
      "end_turn"
    );
    expect(result.text).toBe("Hello world");
    expect(result.stopReason).toBe("end_turn");
  });

  it("handles empty text chunks", () => {
    const result = simulateAcpStream(
      [
        {
          method: "session/update",
          params: {
            sessionId: "s1",
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "" },
            },
          },
        },
        {
          method: "session/update",
          params: {
            sessionId: "s1",
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "after empty" },
            },
          },
        },
      ],
      "end_turn"
    );
    expect(result.text).toBe("after empty");
  });

  it("ignores tool_call updates", () => {
    const result = simulateAcpStream(
      [
        {
          method: "session/update",
          params: {
            sessionId: "s1",
            update: {
              sessionUpdate: "tool_call",
              toolCallId: "c1",
              title: "Read file",
              kind: "other",
              status: "pending",
            },
          },
        },
        {
          method: "session/update",
          params: {
            sessionId: "s1",
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "only this" },
            },
          },
        },
      ],
      "end_turn"
    );
    expect(result.text).toBe("only this");
  });

  it("handles cancelled stop reason", () => {
    const result = simulateAcpStream(
      [
        {
          method: "session/update",
          params: {
            sessionId: "s1",
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "partial" },
            },
          },
        },
      ],
      "cancelled"
    );
    expect(result.text).toBe("partial");
    expect(result.stopReason).toBe("cancelled");
  });

  it("handles max_tokens stop reason", () => {
    const result = simulateAcpStream([], "max_tokens");
    expect(result.text).toBe("");
    expect(result.stopReason).toBe("max_tokens");
  });
});
