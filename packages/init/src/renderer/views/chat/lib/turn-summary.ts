import type { MaterializedMessage, ToolMessageData } from "./materialize"

export type DiffEntry = {
  path: string
  oldText: string
  newText: string
}

export type TurnData = {
  diffs: DiffEntry[]
  createdFiles: Set<string>
  createdFileContents: Map<string, string>
  editedFiles: Set<string>
}

function collectDiffs(tool: ToolMessageData): DiffEntry[] {
  const diffs: DiffEntry[] = []
  for (const item of tool.contentItems) {
    if (item.type === "diff") {
      diffs.push({ path: item.path, oldText: item.oldText ?? "", newText: item.newText })
    }
  }
  for (const child of tool.children) {
    diffs.push(...collectDiffs(child))
  }
  return diffs
}

function isWriteTool(tool: ToolMessageData): boolean {
  const name = (tool.toolName ?? "").toLowerCase()
  return name === "write" || tool.kind === "create"
}

function getWritePath(tool: ToolMessageData): string | null {
  if (!isWriteTool(tool)) return null
  const input = tool.rawInput as Record<string, any> | null
  return input?.file_path ?? input?.path ?? null
}

/**
 * Aggregate file-edit activity between the last user prompt and the end of
 * the message stream — the "last turn". Returns null when no files changed
 * (so callers can skip rendering / serialization).
 *
 * Pure function; callable from anywhere that has materialized messages.
 */
export function getLastTurnData(messages: MaterializedMessage[]): TurnData | null {
  let lastUserIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserIdx = i; break }
  }
  if (lastUserIdx === -1) return null

  const diffs: DiffEntry[] = []
  const createdFiles = new Set<string>()
  const createdFileContents = new Map<string, string>()
  const editedFiles = new Set<string>()

  for (let i = lastUserIdx + 1; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role !== "tool") continue
    const writePath = getWritePath(msg)
    if (writePath) {
      createdFiles.add(writePath)
      const input = msg.rawInput as Record<string, any> | null
      const content = input?.content ?? input?.contents ?? ""
      if (typeof content === "string" && content) {
        createdFileContents.set(writePath, content)
      }
    }
    const toolDiffs = collectDiffs(msg)
    for (const d of toolDiffs) {
      diffs.push(d)
      if (!createdFiles.has(d.path)) editedFiles.add(d.path)
    }
  }

  if (diffs.length === 0 && createdFiles.size === 0) return null
  return { diffs, createdFiles, createdFileContents, editedFiles }
}
