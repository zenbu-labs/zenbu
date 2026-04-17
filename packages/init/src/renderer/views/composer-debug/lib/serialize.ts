import type { EditorState, SerializedEditorState } from "lexical"
import type { PillData } from "./PillNode"

export function serializeEditorState(editorState: EditorState): SerializedEditorState {
  return editorState.toJSON()
}

export function extractPills(editorState: EditorState): PillData[] {
  const pills: PillData[] = []
  const json = editorState.toJSON()

  function walk(node: Record<string, unknown>) {
    if (node.type === "pill" && node.pillData) {
      pills.push(node.pillData as PillData)
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child as Record<string, unknown>)
      }
    }
  }

  walk(json.root as unknown as Record<string, unknown>)
  return pills
}

export type ContentSegment =
  | { type: "text"; content: string }
  | { type: "pill"; data: PillData }

export function extractTextWithPills(editorState: EditorState): ContentSegment[] {
  const segments: ContentSegment[] = []
  const json = editorState.toJSON()

  function walkChildren(children: unknown[]) {
    for (const child of children) {
      const node = child as Record<string, unknown>
      if (node.type === "pill" && node.pillData) {
        segments.push({ type: "pill", data: node.pillData as PillData })
      } else if (node.type === "text" && typeof node.text === "string") {
        segments.push({ type: "text", content: node.text })
      } else if (node.type === "linebreak") {
        segments.push({ type: "text", content: "\n" })
      } else if (Array.isArray(node.children)) {
        walkChildren(node.children)
        if (node.type === "paragraph") {
          segments.push({ type: "text", content: "\n" })
        }
      }
    }
  }

  const root = json.root as unknown as Record<string, unknown>
  if (Array.isArray(root.children)) {
    walkChildren(root.children)
  }

  // Trim trailing newline
  if (segments.length > 0) {
    const last = segments[segments.length - 1]
    if (last.type === "text" && last.content === "\n") {
      segments.pop()
    }
  }

  return segments
}
