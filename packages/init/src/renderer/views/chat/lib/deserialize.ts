import { $createParagraphNode, $createTextNode, $getRoot } from "lexical"
import { $createImageNode } from "./ImageNode"
import { $createFileReferenceNode } from "./FileReferenceNode"
import { $createTokenNode } from "./TokenNode"
import type { TokenPayload } from "../../../../../shared/tokens"

type ImageRef = { blobId: string; mimeType: string }

/**
 * Fallback deserializer for user messages that were saved before we started
 * persisting the editor state JSON on the event. Given only `text` + the
 * `images` array, best-effort rehydration:
 *   - `[Image N]` → image pill (original behavior)
 *   - `[File Reference N: name]` → file token pill, reading the matching
 *     `<file_reference number="N" path="…" name="…">…</file_reference>`
 *     block from the trailing XML in the text
 * New submissions take the editorState path and skip this entirely.
 */
export function $deserializeUserMessage(
  text: string,
  images?: ImageRef[],
): void {
  const root = $getRoot()
  root.clear()

  const { body, fileRefs } = extractFileReferenceTrailers(text)
  const lines = body.split("\n")
  const imageRegex = /\[Image (\d+)\]/g
  const fileRegex = /\[File Reference (\d+): [^\]]*\]/g

  for (const line of lines) {
    const paragraph = $createParagraphNode()

    type Hit = {
      start: number
      end: number
      kind: "image" | "file"
      index: number
    }
    const hits: Hit[] = []

    if (images && images.length > 0) {
      let m: RegExpExecArray | null
      imageRegex.lastIndex = 0
      while ((m = imageRegex.exec(line)) !== null) {
        hits.push({
          start: m.index,
          end: imageRegex.lastIndex,
          kind: "image",
          index: parseInt(m[1], 10) - 1,
        })
      }
    }

    fileRegex.lastIndex = 0
    let fm: RegExpExecArray | null
    while ((fm = fileRegex.exec(line)) !== null) {
      hits.push({
        start: fm.index,
        end: fileRegex.lastIndex,
        kind: "file",
        index: parseInt(fm[1], 10) - 1,
      })
    }

    hits.sort((a, b) => a.start - b.start)

    let cursor = 0
    for (const h of hits) {
      if (h.start > cursor) {
        paragraph.append($createTextNode(line.slice(cursor, h.start)))
      }
      if (h.kind === "image" && images?.[h.index]) {
        const img = images[h.index]
        paragraph.append($createImageNode(img.blobId, img.mimeType, "ready"))
      } else if (h.kind === "file" && fileRefs[h.index]) {
        const fr = fileRefs[h.index]
        paragraph.append(
          $createFileReferenceNode(fr.path, fr.name, fr.content),
        )
      } else {
        paragraph.append($createTextNode(line.slice(h.start, h.end)))
      }
      cursor = h.end
    }
    if (cursor < line.length) {
      paragraph.append($createTextNode(line.slice(cursor)))
    }
    root.append(paragraph)
  }
}

/**
 * Pull `<file_reference number="N" path="…" name="…">…</file_reference>`
 * blocks off the end of the user message text. Returns the message body
 * without the trailers plus an indexed array of parsed refs (by `number`).
 */
function extractFileReferenceTrailers(text: string): {
  body: string
  fileRefs: Array<{ path: string; name: string; content: string }>
} {
  const fileRefs: Array<{ path: string; name: string; content: string }> = []
  const re =
    /<file_reference\s+number="(\d+)"\s+path="([^"]*)"\s+name="([^"]*)">\n?([\s\S]*?)\n?<\/file_reference>/g
  let body = text
  let m: RegExpExecArray | null
  const positions: Array<{ start: number; end: number }> = []
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10) - 1
    fileRefs[n] = { path: m[2], name: m[3], content: m[4] }
    positions.push({ start: m.index, end: re.lastIndex })
  }
  // Strip from the tail so offsets in earlier captures stay valid.
  for (let i = positions.length - 1; i >= 0; i--) {
    const { start, end } = positions[i]
    body = body.slice(0, start) + body.slice(end)
  }
  return { body: body.replace(/\n{3,}$/, "\n\n").trimEnd(), fileRefs }
}

/**
 * Preferred deserializer: replay the persisted Lexical editor state JSON
 * directly so every pill (file, image, token) rehydrates with its full
 * payload. Called when the user_prompt event carries `editorState`.
 *
 * Returns false if the state is missing or shaped wrong so the caller can
 * fall back to text-based rendering.
 */
export function hasRehydratableEditorState(state: unknown): boolean {
  if (!state || typeof state !== "object") return false
  return "root" in (state as Record<string, unknown>)
}

export type { TokenPayload }
