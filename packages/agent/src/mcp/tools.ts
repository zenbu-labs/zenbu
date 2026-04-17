import { z } from "zod";

export type ToolContext = Record<string, unknown>;

export type ToolHandler<TInput = unknown, TCtx extends ToolContext = ToolContext> = (
  input: TInput,
  ctx: TCtx,
) => Promise<CallToolResult>;

export type ToolDef<TInput = unknown, TCtx extends ToolContext = ToolContext> = {
  description: string;
  input: z.ZodType<TInput>;
  handler: ToolHandler<TInput, TCtx>;
};

export type ToolImplementation<TCtx extends ToolContext = ToolContext> = {
  tools: Record<string, ToolDef<any, TCtx>>;
};

export type CallToolResult = {
  content: Array<{ type: "text"; text: string } | { type: string; [key: string]: unknown }>;
  isError?: boolean;
};

export type McpToolSchema = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export function defineTools<TCtx extends ToolContext = ToolContext>(
  defs: Record<string, ToolDef<any, TCtx>>,
): ToolImplementation<TCtx> {
  return { tools: defs };
}

export function toolsToListResponse(impl: ToolImplementation<any>): { tools: McpToolSchema[] } {
  const tools: McpToolSchema[] = [];
  for (const [name, def] of Object.entries(impl.tools)) {
    tools.push({
      name,
      description: def.description,
      inputSchema: z.toJSONSchema(def.input, { target: "draft-07" }) as Record<string, unknown>,
    });
  }
  return { tools };
}

export async function handleToolCall<TCtx extends ToolContext>(
  impl: ToolImplementation<TCtx>,
  name: string,
  args: unknown,
  ctx: TCtx,
): Promise<CallToolResult> {
  const def = impl.tools[name];
  if (!def) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  const parsed = def.input.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Invalid arguments: ${JSON.stringify(parsed.error)}` }],
      isError: true,
    };
  }
  return def.handler(parsed.data, ctx);
}
