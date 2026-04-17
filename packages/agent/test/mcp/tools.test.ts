import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  defineTools,
  toolsToListResponse,
  handleToolCall,
  type ToolContext,
} from "../../src/mcp/tools.ts";

function makeTestTools() {
  return defineTools({
    greet: {
      description: "Greet a user",
      input: z.object({ name: z.string() }),
      handler: async ({ name }) => ({
        content: [{ type: "text" as const, text: `Hello ${name}!` }],
      }),
    },
    add: {
      description: "Add two numbers",
      input: z.object({ a: z.number(), b: z.number() }),
      handler: async ({ a, b }) => ({
        content: [{ type: "text" as const, text: String(a + b) }],
      }),
    },
  });
}

describe("defineTools", () => {
  it("creates a ToolImplementation from definitions", () => {
    const impl = makeTestTools();
    expect(Object.keys(impl.tools)).toEqual(["greet", "add"]);
    expect(impl.tools.greet.description).toBe("Greet a user");
  });
});

describe("toolsToListResponse", () => {
  it("produces an MCP-compatible tools/list response", () => {
    const impl = makeTestTools();
    const response = toolsToListResponse(impl);

    expect(response.tools).toHaveLength(2);

    const greet = response.tools.find((t) => t.name === "greet")!;
    expect(greet.description).toBe("Greet a user");
    expect(greet.inputSchema).toBeDefined();
    expect((greet.inputSchema as any).type).toBe("object");
    expect((greet.inputSchema as any).properties.name).toBeDefined();

    const add = response.tools.find((t) => t.name === "add")!;
    expect(add.inputSchema).toBeDefined();
    expect((add.inputSchema as any).properties.a).toBeDefined();
    expect((add.inputSchema as any).properties.b).toBeDefined();
  });
});

describe("handleToolCall", () => {
  it("routes to the correct handler and returns result", async () => {
    const impl = makeTestTools();
    const result = await handleToolCall(impl, "greet", { name: "Alice" }, {});
    expect(result.content).toEqual([{ type: "text", text: "Hello Alice!" }]);
  });

  it("validates input against the Zod schema", async () => {
    const impl = makeTestTools();
    const result = await handleToolCall(impl, "add", { a: "not a number", b: 2 }, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
  });

  it("returns an error for unknown tools", async () => {
    const impl = makeTestTools();
    const result = await handleToolCall(impl, "nonexistent", {}, {});
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toContain("Unknown tool");
  });

  it("passes context to the handler", async () => {
    type Ctx = ToolContext & { userId: string };
    const impl = defineTools<Ctx>({
      whoami: {
        description: "Get current user",
        input: z.object({}),
        handler: async (_input, ctx) => ({
          content: [{ type: "text" as const, text: ctx.userId }],
        }),
      },
    });
    const result = await handleToolCall(impl, "whoami", {}, { userId: "user-42" });
    expect(result.content).toEqual([{ type: "text", text: "user-42" }]);
  });
});
