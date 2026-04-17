type AgentEvent = {
  timestamp: number;
  data:
    | { kind: "user_prompt"; text: string }
    | { kind: "session_update"; update: any }
    | { kind: "interrupted" };
};

export type DiffItem = { path: string; oldText?: string; newText: string };

export type EventBlock =
  | { role: "user"; content: string; blobIds: string[] }
  | { role: "assistant"; content: string; blobIds: string[] }
  | { role: "thinking"; content: string; blobIds: string[] }
  | { role: "tool"; kind: string; title: string; status: string; content: string; diffs: DiffItem[]; blobIds: string[] }
  | { role: "plan"; entries: { content: string; status: string }[]; blobIds: string[] }
  | { role: "interrupted"; blobIds: string[] };

function extractText(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  if ("type" in content && (content as any).type === "text") {
    return (content as any).text ?? "";
  }
  return "";
}

function extractBlobIds(content: unknown): string[] {
  const ids: string[] = [];
  if (!content) return ids;

  if (Array.isArray(content)) {
    for (const item of content) {
      ids.push(...extractBlobIds(item));
    }
    return ids;
  }

  if (typeof content === "object") {
    const obj = content as Record<string, unknown>;
    if (obj.type === "image" && typeof obj.blobId === "string") {
      ids.push(obj.blobId);
    }
    if (typeof obj.blobId === "string" && !ids.includes(obj.blobId)) {
      ids.push(obj.blobId);
    }
    for (const val of Object.values(obj)) {
      if (val && typeof val === "object") {
        ids.push(...extractBlobIds(val));
      }
    }
  }

  return ids;
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

function extractToolContent(content: unknown): { text: string; diffs: DiffItem[] } {
  if (!content || !Array.isArray(content)) return { text: "", diffs: [] };
  const textParts: string[] = [];
  const diffs: DiffItem[] = [];
  for (const item of content as any[]) {
    if (item.type === "diff") {
      diffs.push({
        path: item.path ?? "",
        oldText: item.oldText,
        newText: item.newText ?? "",
      });
    } else if (item.type === "content" && item.content?.type === "text") {
      textParts.push(item.content.text);
    }
  }
  return { text: textParts.join("\n"), diffs };
}

function extractToolResponse(update: any): string {
  const resp = update?._meta?.claudeCode?.toolResponse;
  if (!resp) return "";
  const parts: string[] = [];
  if (resp.stdout) parts.push(resp.stdout);
  if (resp.stderr) parts.push(`[stderr] ${resp.stderr}`);
  return parts.join("\n");
}

function resolveToolKind(update: any, existing: (EventBlock & { role: "tool" }) | undefined): string {
  if (update.kind && update.kind !== "think") return update.kind;
  const metaName = update._meta?.claudeCode?.toolName;
  if (metaName) return metaName.toLowerCase();
  if (existing) return existing.kind;
  if (update.kind === "think") return "task";
  return "other";
}

export function materializeToBlocks(events: AgentEvent[]): EventBlock[] {
  const blocks: EventBlock[] = [];
  const toolState = new Map<string, EventBlock & { role: "tool" }>();

  for (const event of events) {
    if (event.data.kind === "user_prompt") {
      blocks.push({ role: "user", content: event.data.text, blobIds: [] });
      continue;
    }

    if (event.data.kind === "interrupted") {
      blocks.push({ role: "interrupted", blobIds: [] });
      continue;
    }

    const update = event.data.update;
    if (!update) continue;
    const contentBlobIds = update.content ? extractBlobIds(update.content) : [];

    switch (update.sessionUpdate) {
      case "user_message_chunk":
        // User messages are stored as user_prompt events in our event log.
        // user_message_chunk events come from ACP session replay on loadSession
        // and contain duplicates plus protocol noise (slash commands, context files).
        break;

      case "agent_message_chunk": {
        const text = extractText(update.content);
        if (!text) break;
        const last = blocks[blocks.length - 1];
        if (last?.role === "assistant") {
          last.content += text;
          last.blobIds.push(...contentBlobIds);
        } else {
          blocks.push({ role: "assistant", content: text, blobIds: contentBlobIds });
        }
        break;
      }

      case "agent_thought_chunk": {
        const text = extractText(update.content);
        if (!text) break;
        const last = blocks[blocks.length - 1];
        if (last?.role === "thinking") {
          last.content += text;
          last.blobIds.push(...contentBlobIds);
        } else {
          blocks.push({ role: "thinking", content: text, blobIds: contentBlobIds });
        }
        break;
      }

      case "tool_call":
      case "tool_call_update": {
        const existing = toolState.get(update.toolCallId);
        const kind = resolveToolKind(update, existing);
        const title = stripShellWrapper(update.title ?? existing?.title ?? "Tool call");
        const status = update.status ?? existing?.status ?? "pending";
        const extracted = extractToolContent(update.content);
        const responseText = extractToolResponse(update);

        if (existing) {
          if (update.title) existing.title = title;
          existing.status = status;
          existing.kind = kind;
          if (extracted.text) existing.content += (existing.content ? "\n" : "") + extracted.text;
          if (responseText) existing.content += (existing.content ? "\n" : "") + responseText;
          existing.diffs.push(...extracted.diffs);
          existing.blobIds.push(...contentBlobIds);
        } else {
          const text = [extracted.text, responseText].filter(Boolean).join("\n");
          const block: EventBlock & { role: "tool" } = {
            role: "tool",
            kind,
            title,
            status,
            content: text,
            diffs: extracted.diffs,
            blobIds: contentBlobIds,
          };
          toolState.set(update.toolCallId, block);
          blocks.push(block);
        }
        break;
      }

      case "plan": {
        const entries = (update.entries ?? []).map((e: any) => ({
          content: e.content ?? "",
          status: e.status ?? "pending",
        }));
        const existing = blocks.find((b) => b.role === "plan");
        if (existing && existing.role === "plan") {
          existing.entries = entries;
        } else {
          blocks.push({ role: "plan", entries, blobIds: [] });
        }
        break;
      }

      case "usage_update":
        break;

      default:
        break;
    }
  }

  return blocks;
}

export function serializeEventLog(
  events: AgentEvent[],
): { texts: string[]; blobIds: string[] } {
  const blocks = materializeToBlocks(events);
  const texts: string[] = [];
  const allBlobIds: string[] = [];

  for (const block of blocks) {
    allBlobIds.push(...block.blobIds);

    switch (block.role) {
      case "user":
        texts.push(`[user] ${block.content}`);
        break;
      case "assistant":
        texts.push(`[assistant] ${block.content}`);
        break;
      case "thinking":
        texts.push(`[thinking] ${block.content}`);
        break;
      case "tool": {
        const parts = [`[tool:${block.kind}] ${block.title}`];
        if (block.content) parts.push(block.content);
        for (const d of block.diffs) {
          parts.push(`  ${d.path}`);
          if (d.oldText != null) parts.push(`  - ${d.oldText}`);
          parts.push(`  + ${d.newText}`);
        }
        texts.push(parts.join("\n"));
        break;
      }
      case "plan":
        texts.push(`[plan] ${block.entries.map((e) => `${e.status}: ${e.content}`).join("; ")}`);
        break;
      case "interrupted":
        texts.push("[interrupted]");
        break;
    }
  }

  return { texts, blobIds: [...new Set(allBlobIds)] };
}

const DEFAULT_MAX_TOKENS = 250_000;

export function truncateToTokenBudget(
  text: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
): string {
  const maxWords = Math.floor(maxTokens / 2);
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return "[...earlier conversation truncated...]\n" + words.slice(-maxWords).join(" ");
}
