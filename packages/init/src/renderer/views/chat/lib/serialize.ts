import { $getRoot, $isTextNode, $isParagraphNode, type LexicalNode } from "lexical"
import { $isFileReferenceNode } from "./FileReferenceNode"
import { $isImageNode } from "./ImageNode"
import { $isTokenNode } from "./TokenNode"
import {
  getSerializer,
  type CollectedImage,
  type SerializerCtx,
} from "../../../../../shared/prompt-serialize"

export type { CollectedImage }

type Trailer = string

type Walker = {
  parts: string[]
  trailers: Trailer[]
  images: CollectedImage[]
  bodyCtx: SerializerCtx
  trailerCtx: SerializerCtx
  imageCtx: SerializerCtx
}

function makeCtx(): SerializerCtx {
  const counters = new Map<string, number>()
  return {
    counters,
    next(kind) {
      const n = (counters.get(kind) ?? 0) + 1
      counters.set(kind, n)
      return n
    },
  }
}

function walkNode(node: LexicalNode, w: Walker): void {
  if ($isTokenNode(node)) {
    const payload = node.getPayload()
    const s = getSerializer(payload.kind)
    if (s) {
      w.parts.push(s.toText(payload, w.bodyCtx))
      if (s.toTrailer) w.trailers.push(s.toTrailer(payload, w.trailerCtx))
      else s.toText(payload, w.trailerCtx)
      if (s.toImages) w.images.push(...s.toImages(payload, w.imageCtx))
      else s.toText(payload, w.imageCtx)
    } else {
      w.parts.push(`[${payload.title}]`)
    }
    return
  }

  // Legacy nodes stay supported during the migration window — both branches
  // produce the same prompt text that the pre-TokenNode code did, so a mixed
  // draft (legacy + new TokenNode) serializes consistently.
  if ($isFileReferenceNode(node)) {
    const n = w.bodyCtx.next("file")
    w.trailerCtx.next("file")
    w.imageCtx.next("file")
    w.parts.push(`[File Reference ${n}: ${node.getFileName()}]`)
    w.trailers.push(
      `<file_reference number="${n}" path="${node.getFilePath()}" name="${node.getFileName()}">\n${node.getFileContent()}\n</file_reference>\n`,
    )
    return
  }

  if ($isImageNode(node)) {
    if (node.getStatus() === "ready") {
      const n = w.bodyCtx.next("image")
      w.trailerCtx.next("image")
      w.imageCtx.next("image")
      w.parts.push(`[Image ${n}]`)
      w.images.push({ blobId: node.getBlobId(), mimeType: node.getMimeType() })
    }
    return
  }

  if ($isTextNode(node)) {
    w.parts.push(node.getTextContent())
    return
  }

  if ($isParagraphNode(node)) {
    const children = node.getChildren()
    for (const child of children) walkNode(child, w)
    return
  }

  w.parts.push(node.getTextContent())
}

export function serializeEditorContent(): {
  text: string
  images: CollectedImage[]
} {
  const root = $getRoot()
  const paragraphs = root.getChildren()
  const w: Walker = {
    parts: [],
    trailers: [],
    images: [],
    bodyCtx: makeCtx(),
    trailerCtx: makeCtx(),
    imageCtx: makeCtx(),
  }

  for (let i = 0; i < paragraphs.length; i++) {
    if (i > 0) w.parts.push("\n")
    const para = paragraphs[i]
    const paraChildren = para.getChildren()
    for (const child of paraChildren) walkNode(child, w)
  }

  let result = w.parts.join("").trim()
  if (w.trailers.length > 0) {
    result += "\n"
    for (const t of w.trailers) result += "\n" + t
  }
  return { text: result, images: w.images }
}
