import type { SessionUpdate } from "@agentclientprotocol/sdk";

export type ToolCallContentItem =
  | { type: "text"; text: string }
  | { type: "diff"; path: string; oldText?: string; newText: string };

export type PlanEntry = {
  content: string;
  status: string;
  priority?: "high" | "medium" | "low";
  documentPath?: string;
  documentPreview?: string;
};

export type PermissionOption = {
  optionId: string;
  label: string;
  kind: "allow_once" | "allow_always" | "reject_once" | "reject_always";
};

type MessageIdentity = {
  key?: string;
};

export type ToolMessageData = MessageIdentity & {
  role: "tool";
  toolCallId: string;
  title: string;
  subtitle: string;
  kind: string;
  status: string;
  contentItems: ToolCallContentItem[];
  rawOutput: unknown;
  rawInput: unknown;
  toolName: string;
  toolResponse: { stdout?: string; stderr?: string } | null;
  children: ToolMessageData[];
};

export type MaterializedMessage =
  | (MessageIdentity & { role: "user"; content: string; images?: { blobId: string; mimeType: string }[]; timeSent?: number })
  | (MessageIdentity & { role: "assistant"; content: string })
  | (MessageIdentity & { role: "thinking"; content: string })
  | ToolMessageData
  | (MessageIdentity & { role: "plan"; entries: PlanEntry[] })
  | (MessageIdentity & {
      role: "permission_request";
      toolCallId: string;
      title: string;
      kind: string;
      description: string;
      options: PermissionOption[];
    })
  | (MessageIdentity & {
      role: "ask_question";
      toolCallId: string;
      question: string;
    })
  | (MessageIdentity & { role: "interrupted" });

type AgentEvent = {
  timestamp: number;
  data:
    | { kind: "user_prompt"; text: string; images?: { blobId: string; mimeType: string }[] }
    | { kind: "session_update"; update: SessionUpdate }
    | { kind: "interrupted" };
};

function extractText(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  if ("type" in content && (content as any).type === "text") {
    return (content as any).text ?? "";
  }
  return "";
}

function stripShellWrapper(command: string): string {
  const match = command.match(
    /^\/(?:bin|usr\/bin)\/(?:zsh|bash|sh)\s+-\w*c\s+([\s\S]+)$/,
  );
  if (!match) return command;
  let inner = match[1].trim();
  if (
    (inner.startsWith("'") && inner.endsWith("'")) ||
    (inner.startsWith('"') && inner.endsWith('"'))
  ) {
    inner = inner.slice(1, -1);
  }
  return inner;
}

function extractToolCallContent(content: unknown): ToolCallContentItem[] {
  if (!content || !Array.isArray(content)) return [];
  return content
    .map((item: any): ToolCallContentItem | null => {
      if (item.type === "diff") {
        return {
          type: "diff",
          path: item.path ?? "",
          oldText: item.oldText,
          newText: item.newText ?? "",
        };
      }
      if (item.type === "content" && item.content?.type === "text") {
        return { type: "text", text: item.content.text };
      }
      return null;
    })
    .filter((item): item is ToolCallContentItem => item !== null);
}

type ToolMessage = ToolMessageData;

function fileBasename(p: string): string {
  return p.split("/").pop() ?? p;
}

function deriveSubtitle(
  kind: string,
  contentItems: ToolCallContentItem[],
  rawOutput: unknown,
): string {
  if (kind === "edit") {
    const paths = contentItems
      .filter(
        (c): c is ToolCallContentItem & { type: "diff" } => c.type === "diff",
      )
      .map((c) => fileBasename(c.path))
      .filter(Boolean);
    if (paths.length > 0) return [...new Set(paths)].join(", ");
  }

  if (kind === "read" && rawOutput && typeof rawOutput === "object") {
    const out = rawOutput as Record<string, unknown>;
    if (typeof out.content === "string" && out.content.length > 0) {
      const lines = out.content.split("\n").filter((l) => l.trim().length > 0);
      return `${lines.length} lines`;
    }
  }

  if (kind === "search" && rawOutput && typeof rawOutput === "object") {
    const out = rawOutput as Record<string, unknown>;
    if (typeof out.totalMatches === "number")
      return `${out.totalMatches} matches`;
    if (typeof out.totalFiles === "number") return `${out.totalFiles} files`;
  }

  return "";
}

function deriveTitle(kind: string, originalTitle: string): string {
  switch (kind) {
    case "read":
      return fileBasename(originalTitle);
    case "edit":
      return "Edited";
    case "search":
      return originalTitle;
    default:
      return originalTitle;
  }
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createMessageSeed(event: AgentEvent): string {
  if (event.data.kind === "user_prompt") {
    const imageSeed = event.data.images
      ?.map((image) => `${image.blobId}:${image.mimeType}`)
      .join("|") ?? "";
    return `user_prompt:${event.data.text}:${imageSeed}`;
  }

  if (event.data.kind === "interrupted") {
    return "interrupted";
  }

  const update = event.data.update as any;
  const content = update?.content;
  if (content?.type === "text") {
    return `${update?.sessionUpdate ?? "unknown"}:${content.text ?? ""}`;
  }
  if (content?.type === "image") {
    return `${update?.sessionUpdate ?? "unknown"}:image:${content.mimeType ?? ""}:${content.uri ?? ""}:${content.data?.length ?? 0}`;
  }
  return `${update?.sessionUpdate ?? "unknown"}:${typeof content === "string" ? content : ""}`;
}

function createStableEventKey(prefix: string, event: AgentEvent): string {
  return `${prefix}-${event.timestamp}-${hashString(createMessageSeed(event))}`;
}

export function materializeMessages(
  events: AgentEvent[],
): MaterializedMessage[] {
  const messages: MaterializedMessage[] = [];
  const toolCalls = new Map<string, ToolMessage>();
  let currentTurnToolCalls: ToolMessage[] = [];

  for (const event of events) {
    if (event.data.kind === "user_prompt") {
      currentTurnToolCalls = [];
      messages.push({
        key: createStableEventKey("user", event),
        role: "user",
        content: event.data.text,
        images: event.data.images,
        timeSent: event.timestamp,
      });
      continue;
    }

    if (event.data.kind === "interrupted") {
      for (const tc of currentTurnToolCalls) {
        if (tc.status !== "completed" && tc.status !== "failed") {
          tc.status = "failed";
        }
      }
      messages.push({
        key: createStableEventKey("interrupted", event),
        role: "interrupted",
      });
      continue;
    }

    const update = event.data.update;

    switch (update.sessionUpdate) {
      case "user_message_chunk": {
        const text = extractText(update.content);
        if (!text) break;
        const last = messages[messages.length - 1];
        if (last?.role === "user") {
          last.content += text;
        } else {
          messages.push({
            key: createStableEventKey("user", event),
            role: "user",
            content: text,
            timeSent: event.timestamp,
          });
        }
        break;
      }

      case "agent_message_chunk": {
        const text = extractText(update.content);
        if (!text) break;
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          last.content += text;
        } else {
          messages.push({
            key: createStableEventKey("assistant", event),
            role: "assistant",
            content: text,
          });
        }
        break;
      }

      case "agent_thought_chunk": {
        const text = extractText(update.content);
        if (!text) break;
        const last = messages[messages.length - 1];
        if (last?.role === "thinking") {
          last.content += text;
        } else {
          messages.push({
            key: createStableEventKey("thinking", event),
            role: "thinking",
            content: text,
          });
        }
        break;
      }

      case "tool_call":
      case "tool_call_update": {
        const newItems = extractToolCallContent(update.content);
        const rawOut = (update as any).rawOutput;
        const rawIn = (update as any).rawInput;
        const meta = (update as any)._meta?.claudeCode;
        const metaToolName = meta?.toolName ?? "";
        const metaResponse = meta?.toolResponse ?? null;
        const parentId = meta?.parentToolUseId as string | undefined;
        const existing = toolCalls.get(update.toolCallId);
        if (existing) {
          if (update.title)
            existing.title = deriveTitle(
              existing.kind,
              stripShellWrapper(update.title),
            );
          if (update.status) existing.status = update.status;
          if ((update as any).kind) {
            existing.kind = (update as any).kind;
            if ((existing.toolName || metaToolName).toLowerCase() === "write") existing.kind = "create";
          }
          if (newItems.length > 0) {
            existing.contentItems = [...existing.contentItems, ...newItems];
          }
          if (rawOut !== undefined) existing.rawOutput = rawOut;
          if (rawIn !== undefined) existing.rawInput = rawIn;
          if (metaToolName) existing.toolName = metaToolName;
          if (metaResponse) existing.toolResponse = metaResponse;
          existing.subtitle = deriveSubtitle(
            existing.kind,
            existing.contentItems,
            existing.rawOutput,
          );
        } else {
          let kind: string = (update as any).kind ?? "other";
          if (metaToolName.toLowerCase() === "write" && kind !== "create") kind = "create";
          const strippedTitle = stripShellWrapper(update.title ?? "Tool call");
          const tc: ToolMessage = {
            key: `tool-${update.toolCallId}`,
            role: "tool",
            toolCallId: update.toolCallId,
            title: deriveTitle(kind, strippedTitle),
            subtitle: "",
            kind,
            status: update.status ?? "pending",
            contentItems: newItems,
            rawOutput: rawOut ?? null,
            rawInput: rawIn ?? null,
            toolName: metaToolName,
            toolResponse: metaResponse,
            children: [],
          };
          tc.subtitle = deriveSubtitle(tc.kind, tc.contentItems, tc.rawOutput);
          toolCalls.set(update.toolCallId, tc);
          currentTurnToolCalls.push(tc);
          const parent = parentId ? toolCalls.get(parentId) : undefined;
          if (parent) {
            parent.children.push(tc);
          } else {
            messages.push(tc);
          }
        }
        break;
      }

      case "plan": {
        const planMsg = {
          key: "plan",
          role: "plan" as const,
          entries:
            (update as any).entries?.map((e: any) => ({
              content: e.content ?? "",
              status: e.status ?? "pending",
            })) ?? [],
        };
        const planIdx = messages.findIndex((m) => m.role === "plan");
        if (planIdx !== -1) {
          messages[planIdx] = planMsg;
        } else {
          messages.push(planMsg);
        }
        break;
      }

      default:
        break;
    }
  }

  return messages;
}
