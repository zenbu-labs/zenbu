import { $getRoot, $isTextNode, $isParagraphNode, type LexicalNode } from "lexical"
import { $isFileReferenceNode } from "./FileReferenceNode"
import { $isImageNode } from "./ImageNode"

type CollectedRef = { path: string; name: string; content: string }
export type CollectedImage = { blobId: string; mimeType: string }

function walkNode(
  node: LexicalNode,
  parts: string[],
  refs: CollectedRef[],
  images: CollectedImage[],
): void {
  if ($isFileReferenceNode(node)) {
    refs.push({
      path: node.getFilePath(),
      name: node.getFileName(),
      content: node.getFileContent(),
    })
    parts.push(`[File Reference ${refs.length}: ${node.getFileName()}]`)
    return
  }

  if ($isImageNode(node)) {
    if (node.getStatus() === "ready") {
      images.push({ blobId: node.getBlobId(), mimeType: node.getMimeType() })
      parts.push(`[Image ${images.length}]`)
    }
    return
  }

  if ($isTextNode(node)) {
    parts.push(node.getTextContent())
    return
  }

  if ($isParagraphNode(node)) {
    const children = node.getChildren()
    for (const child of children) {
      walkNode(child, parts, refs, images)
    }
    return
  }

  parts.push(node.getTextContent())
}

export function serializeEditorContent(): { text: string; images: CollectedImage[] } {
  const root = $getRoot()
  const paragraphs = root.getChildren()
  const refs: CollectedRef[] = []
  const images: CollectedImage[] = []
  const textParts: string[] = []

  for (let i = 0; i < paragraphs.length; i++) {
    if (i > 0) textParts.push("\n")
    const para = paragraphs[i]
    const paraChildren = para.getChildren()
    for (const child of paraChildren) {
      walkNode(child, textParts, refs, images)
    }
  }

  let result = textParts.join("").trim()

  if (refs.length > 0) {
    result += "\n"
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i]
      result += `\n<file_reference number="${i + 1}" path="${ref.path}" name="${ref.name}">\n${ref.content}\n</file_reference>\n`
    }
  }

  return { text: result, images }
}
