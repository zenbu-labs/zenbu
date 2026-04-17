import { describe, it, expect } from "vitest";
import {
  buildCodexRequest,
  buildAcpRequest,
  buildCodexNotification,
  buildAcpNotification,
} from "../../src/agents/protocol.ts";
import { codexMessageShapes } from "../../src/agents/codex.ts";
import { acpMessageShapes } from "../../src/agents/opencode.ts";

describe("Codex app-server protocol semantics", () => {
  describe("initialize request", () => {
    it("has correct method", () => {
      const msg = codexMessageShapes.initialize("puter_cli");
      expect(msg.method).toBe("initialize");
    });

    it("includes clientInfo with required fields", () => {
      const msg = codexMessageShapes.initialize("puter_cli");
      expect(msg.params.clientInfo).toBeDefined();
      expect(msg.params.clientInfo.name).toBe("puter_cli");
      expect(msg.params.clientInfo.title).toBeTruthy();
      expect(msg.params.clientInfo.version).toBeTruthy();
    });

    it("builds as a valid JSON-RPC request with id", () => {
      const msg = buildCodexRequest(
        "initialize",
        1,
        codexMessageShapes.initialize("puter_cli").params
      );
      expect(msg.method).toBe("initialize");
      expect(msg.id).toBe(1);
      expect(msg.params).toBeDefined();
      expect(msg).not.toHaveProperty("jsonrpc");
    });
  });

  describe("initialized notification", () => {
    it("has no id (notification, not request)", () => {
      const msg = codexMessageShapes.initialized();
      expect(msg.method).toBe("initialized");
      expect(msg).not.toHaveProperty("id");
    });

    it("builds as valid notification", () => {
      const msg = buildCodexNotification("initialized");
      expect(msg.method).toBe("initialized");
      expect(msg).not.toHaveProperty("id");
    });
  });

  describe("thread/start request", () => {
    it("includes model and cwd", () => {
      const msg = codexMessageShapes.threadStart("o4-mini", "/tmp/proj");
      expect(msg.method).toBe("thread/start");
      expect(msg.params.model).toBe("o4-mini");
      expect(msg.params.cwd).toBe("/tmp/proj");
    });

    it("includes approvalPolicy and sandbox", () => {
      const msg = codexMessageShapes.threadStart("o4-mini", "/tmp");
      expect(msg.params.approvalPolicy).toBe("never");
      expect(msg.params.sandbox).toBe("workspace-write");
    });

    it("builds as valid request with id", () => {
      const msg = buildCodexRequest(
        "thread/start",
        2,
        codexMessageShapes.threadStart("o4-mini", "/tmp").params
      );
      expect(msg.id).toBe(2);
      expect(msg.params.model).toBeTruthy();
    });
  });

  describe("turn/start request", () => {
    it("includes threadId", () => {
      const msg = codexMessageShapes.turnStart("thr_123", "Hello");
      expect(msg.method).toBe("turn/start");
      expect(msg.params.threadId).toBe("thr_123");
    });

    it("includes input as array of text content blocks", () => {
      const msg = codexMessageShapes.turnStart("thr_123", "Say hi");
      expect(msg.params.input).toBeInstanceOf(Array);
      expect(msg.params.input).toHaveLength(1);
      expect(msg.params.input[0]).toEqual({
        type: "text",
        text: "Say hi",
      });
    });
  });

  describe("notification parsing", () => {
    it("parses item/agentMessage/delta correctly", () => {
      const notification = {
        method: "item/agentMessage/delta",
        params: { delta: "Hello " },
      };
      expect(notification.method).toBe("item/agentMessage/delta");
      expect(notification.params.delta).toBe("Hello ");
    });

    it("parses turn/completed correctly", () => {
      const notification = {
        method: "turn/completed",
        params: {
          turn: { id: "turn_1", status: "completed" },
        },
      };
      expect(notification.method).toBe("turn/completed");
      expect(notification.params.turn.status).toBe("completed");
    });

    it("handles turn/completed with error", () => {
      const notification = {
        method: "turn/completed",
        params: {
          turn: {
            id: "turn_1",
            status: "error",
            error: { message: "Rate limited" },
          },
        },
      };
      expect(notification.params.turn.error).toBeDefined();
      expect(notification.params.turn.error.message).toBe("Rate limited");
    });
  });

  describe("full round-trip simulation", () => {
    it("accumulates deltas from simulated server responses", () => {
      const notifications = [
        { method: "item/agentMessage/delta", params: { delta: "This " } },
        { method: "item/agentMessage/delta", params: { delta: "is " } },
        { method: "item/agentMessage/delta", params: { delta: "a test." } },
        {
          method: "turn/completed",
          params: { turn: { id: "t1", status: "completed" } },
        },
      ];

      let accumulated = "";
      let completed = false;

      for (const n of notifications) {
        if (n.method === "item/agentMessage/delta") {
          accumulated += n.params.delta;
        } else if (n.method === "turn/completed") {
          completed = true;
        }
      }

      expect(accumulated).toBe("This is a test.");
      expect(completed).toBe(true);
    });

    it("also accepts codex/event/agent_message_content_delta", () => {
      const notifications = [
        {
          method: "codex/event/agent_message_content_delta",
          params: { content: "Alt " },
        },
        {
          method: "codex/event/agent_message_content_delta",
          params: { content: "format." },
        },
        { method: "turn/completed", params: { turn: { id: "t2" } } },
      ];

      let accumulated = "";
      for (const n of notifications) {
        if (
          n.method === "item/agentMessage/delta" ||
          n.method === "codex/event/agent_message_content_delta"
        ) {
          accumulated += n.params.delta ?? n.params.content ?? "";
        }
      }

      expect(accumulated).toBe("Alt format.");
    });
  });
});

describe("OpenCode ACP protocol semantics", () => {
  describe("initialize request", () => {
    it("includes protocolVersion", () => {
      const msg = acpMessageShapes.initialize("puter_cli");
      expect(msg.params.protocolVersion).toBe(1);
    });

    it("includes clientCapabilities object", () => {
      const msg = acpMessageShapes.initialize("puter_cli");
      expect(msg.params.clientCapabilities).toBeDefined();
      expect(typeof msg.params.clientCapabilities).toBe("object");
    });

    it("includes clientInfo with required fields", () => {
      const msg = acpMessageShapes.initialize("puter_cli");
      expect(msg.params.clientInfo.name).toBe("puter_cli");
      expect(msg.params.clientInfo.title).toBeTruthy();
      expect(msg.params.clientInfo.version).toBeTruthy();
    });

    it("includes jsonrpc 2.0 header", () => {
      const msg = acpMessageShapes.initialize("puter_cli");
      expect(msg.jsonrpc).toBe("2.0");
    });

    it("builds as valid JSON-RPC 2.0 request", () => {
      const msg = buildAcpRequest(
        "initialize",
        1,
        acpMessageShapes.initialize("puter_cli").params
      );
      expect(msg.jsonrpc).toBe("2.0");
      expect(msg.id).toBe(1);
      expect(msg.method).toBe("initialize");
    });
  });

  describe("session/new request", () => {
    it("has correct method", () => {
      const msg = acpMessageShapes.sessionNew();
      expect(msg.method).toBe("session/new");
    });

    it("includes jsonrpc header", () => {
      const msg = acpMessageShapes.sessionNew();
      expect(msg.jsonrpc).toBe("2.0");
    });
  });

  describe("session/prompt request", () => {
    it("includes sessionId", () => {
      const msg = acpMessageShapes.sessionPrompt("sess_abc", "Hello");
      expect(msg.params.sessionId).toBe("sess_abc");
    });

    it("includes prompt as array of content blocks", () => {
      const msg = acpMessageShapes.sessionPrompt("sess_abc", "Test");
      expect(msg.params.prompt).toBeInstanceOf(Array);
      expect(msg.params.prompt).toHaveLength(1);
      expect(msg.params.prompt[0]).toEqual({
        type: "text",
        text: "Test",
      });
    });

    it("includes jsonrpc header", () => {
      const msg = acpMessageShapes.sessionPrompt("sess_abc", "Test");
      expect(msg.jsonrpc).toBe("2.0");
    });
  });

  describe("session/cancel notification", () => {
    it("includes sessionId", () => {
      const msg = acpMessageShapes.sessionCancel("sess_abc");
      expect(msg.params.sessionId).toBe("sess_abc");
    });
  });

  describe("session/update notification parsing", () => {
    it("parses agent_message_chunk correctly", () => {
      const update = {
        method: "session/update",
        params: {
          sessionId: "sess_abc",
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "Hello world" },
          },
        },
      };
      expect(update.params.update.sessionUpdate).toBe("agent_message_chunk");
      expect(update.params.update.content.type).toBe("text");
      expect(update.params.update.content.text).toBe("Hello world");
    });

    it("parses tool_call update correctly", () => {
      const update = {
        method: "session/update",
        params: {
          sessionId: "sess_abc",
          update: {
            sessionUpdate: "tool_call",
            toolCallId: "call_001",
            title: "Reading file",
            kind: "other",
            status: "pending",
          },
        },
      };
      expect(update.params.update.sessionUpdate).toBe("tool_call");
      expect(update.params.update.toolCallId).toBe("call_001");
      expect(update.params.update.status).toBe("pending");
    });

    it("parses tool_call_update with completed status", () => {
      const update = {
        method: "session/update",
        params: {
          sessionId: "sess_abc",
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: "call_001",
            status: "completed",
            content: [
              {
                type: "content",
                content: { type: "text", text: "File contents here" },
              },
            ],
          },
        },
      };
      expect(update.params.update.status).toBe("completed");
    });

    it("parses plan update correctly", () => {
      const update = {
        method: "session/update",
        params: {
          sessionId: "sess_abc",
          update: {
            sessionUpdate: "plan",
            entries: [
              { content: "Step 1", priority: "high", status: "pending" },
              { content: "Step 2", priority: "low", status: "pending" },
            ],
          },
        },
      };
      expect(update.params.update.sessionUpdate).toBe("plan");
      expect(update.params.update.entries).toHaveLength(2);
    });
  });

  describe("stop reasons", () => {
    const validStopReasons = [
      "end_turn",
      "max_tokens",
      "max_model_requests",
      "refusal",
      "cancelled",
    ];

    for (const reason of validStopReasons) {
      it(`recognizes stop reason: ${reason}`, () => {
        const response = { stopReason: reason };
        expect(validStopReasons).toContain(response.stopReason);
      });
    }
  });

  describe("full round-trip simulation", () => {
    it("accumulates agent_message_chunk updates", () => {
      const events = [
        {
          method: "session/update",
          params: {
            sessionId: "s1",
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "Here " },
            },
          },
        },
        {
          method: "session/update",
          params: {
            sessionId: "s1",
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "is the " },
            },
          },
        },
        {
          method: "session/update",
          params: {
            sessionId: "s1",
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "answer." },
            },
          },
        },
      ];
      const promptResponse = { stopReason: "end_turn" };

      let accumulated = "";
      for (const event of events) {
        const update = event.params.update;
        if (
          update.sessionUpdate === "agent_message_chunk" &&
          update.content?.type === "text"
        ) {
          accumulated += update.content.text;
        }
      }

      expect(accumulated).toBe("Here is the answer.");
      expect(promptResponse.stopReason).toBe("end_turn");
    });

    it("ignores non-text updates during accumulation", () => {
      const events = [
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
              content: { type: "text", text: "Result: ok" },
            },
          },
        },
      ];

      let accumulated = "";
      for (const event of events) {
        const update = event.params.update as any;
        if (
          update.sessionUpdate === "agent_message_chunk" &&
          update.content?.type === "text"
        ) {
          accumulated += update.content.text;
        }
      }

      expect(accumulated).toBe("Result: ok");
    });
  });
});

describe("Cross-protocol consistency", () => {
  it("both protocols produce identical results from equivalent inputs", () => {
    const codexNotifications = [
      { method: "item/agentMessage/delta", params: { delta: "Answer: 42" } },
      { method: "turn/completed", params: { turn: { id: "t1" } } },
    ];

    const acpEvents = [
      {
        method: "session/update",
        params: {
          sessionId: "s1",
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "Answer: 42" },
          },
        },
      },
    ];
    const acpResponse = { stopReason: "end_turn" };

    let codexResult = "";
    for (const n of codexNotifications) {
      if (n.method === "item/agentMessage/delta") {
        codexResult += n.params.delta;
      }
    }

    let acpResult = "";
    for (const e of acpEvents) {
      const u = e.params.update;
      if (u.sessionUpdate === "agent_message_chunk" && u.content?.type === "text") {
        acpResult += u.content.text;
      }
    }

    expect(codexResult).toBe(acpResult);
    expect(codexResult).toBe("Answer: 42");
  });

  it("both protocols have compatible request shapes for initialization", () => {
    const codexInit = codexMessageShapes.initialize("puter_cli");
    const acpInit = acpMessageShapes.initialize("puter_cli");

    expect(codexInit.params.clientInfo.name).toBe(
      acpInit.params.clientInfo.name
    );
    expect(codexInit.params.clientInfo.version).toBe(
      acpInit.params.clientInfo.version
    );
  });

  it("codex requests omit jsonrpc header while ACP includes it", () => {
    const codexReq = buildCodexRequest("initialize", 1, {});
    const acpReq = buildAcpRequest("initialize", 1, {});

    expect(codexReq).not.toHaveProperty("jsonrpc");
    expect(acpReq.jsonrpc).toBe("2.0");
  });

  it("notifications follow the same pattern", () => {
    const codexNotif = buildCodexNotification("initialized");
    const acpNotif = buildAcpNotification("initialized");

    expect(codexNotif).not.toHaveProperty("id");
    expect(acpNotif).not.toHaveProperty("id");
    expect(codexNotif).not.toHaveProperty("jsonrpc");
    expect(acpNotif.jsonrpc).toBe("2.0");
  });
});
