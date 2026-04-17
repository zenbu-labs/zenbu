import { $createParagraphNode, $createTextNode, $getRoot } from "lexical"
import { $createImageNode } from "./ImageNode"

type ImageRef = { blobId: string; mimeType: string }

/**
 * Populates the current Lexical editor state from a serialized user message.
 * Call inside editor.update() or as an editorState initializer.
 *
 * Parses `[Image N]` placeholders in the text and replaces them with ImageNodes
 * using the corresponding entry from the images array.
 */
export function $deserializeUserMessage(
  text: string,
  images?: ImageRef[],
): void {
  const root = $getRoot()
  root.clear()

  const lines = text.split("\n")

  for (const line of lines) {
    const paragraph = $createParagraphNode()

    if (!images || images.length === 0) {
      if (line.length > 0) {
        paragraph.append($createTextNode(line))
      }
      root.append(paragraph)
      continue
    }

    const regex = /\[Image (\d+)\]/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        paragraph.append($createTextNode(line.slice(lastIndex, match.index)))
      }

      const imageIndex = parseInt(match[1], 10) - 1
      if (images[imageIndex]) {
        const img = images[imageIndex]
        paragraph.append($createImageNode(img.blobId, img.mimeType, "ready"))
      } else {
        paragraph.append($createTextNode(match[0]))
      }

      lastIndex = regex.lastIndex
    }

    if (lastIndex < line.length) {
      paragraph.append($createTextNode(line.slice(lastIndex)))
    }

    root.append(paragraph)
  }
}
