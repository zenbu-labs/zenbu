import type { TokenBlob, TokenPayload } from "./tokens"

/**
 * Per-kind serializer that turns a token payload into prompt-time artifacts:
 *   - `toText` goes inline where the pill sat in the user's prose
 *     (e.g. "[File Reference 2: foo.ts]")
 *   - `toTrailer` (optional) is concatenated after the body, one per token —
 *     used for the XML `<file_reference>` block appended after the message
 *   - `toImages` (optional) lifts blobs into the `images` collection so the
 *     agent service can read them from disk and attach them as ACP image
 *     ContentBlocks
 *
 * The serializer ctx carries per-kind counters so output numbering stays
 * stable across the body and trailer.
 */

export type CollectedImage = { blobId: string; mimeType: string }

export type SerializerCtx = {
  counters: Map<string, number>
  next(kind: string): number
}

export type TokenSerializer = {
  kind: string
  toText: (payload: TokenPayload, ctx: SerializerCtx) => string
  toTrailer?: (payload: TokenPayload, ctx: SerializerCtx) => string
  toImages?: (payload: TokenPayload, ctx: SerializerCtx) => CollectedImage[]
}

const serializers = new Map<string, TokenSerializer>()

export function registerSerializer(s: TokenSerializer): void {
  serializers.set(s.kind, s)
}

export function getSerializer(kind: string): TokenSerializer | undefined {
  return serializers.get(kind)
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

type LexJsonNode = {
  type: string
  children?: LexJsonNode[]
  text?: string
  payload?: TokenPayload
  [key: string]: unknown
}

type LexJsonRoot = { root: LexJsonNode }

/**
 * Walk a Lexical editor state JSON and produce the outgoing `{text, images}`
 * tuple the agent service expects. Token nodes dispatch through the registry;
 * text nodes + paragraphs are handled inline (no registration needed).
 *
 * This function is the single authority for "editor state → prompt text".
 * Both the live composer submit path and the backend-from-persisted-draft
 * path call it, guaranteeing they produce identical output for identical
 * input.
 */
export function serializeEditorState(input: unknown): {
  text: string
  images: CollectedImage[]
} {
  const state = input as LexJsonRoot | null
  if (!state?.root?.children) return { text: "", images: [] }

  const ctx = makeCtx()
  const parts: string[] = []
  const trailers: string[] = []
  const images: CollectedImage[] = []
  // Replay ctx for trailer/image passes so numbering matches the body —
  // walking twice with the same counter progression is simpler than
  // threading per-token ids through three collections.
  const bodyCtx = makeCtx()
  const trailerCtx = makeCtx()
  const imageCtx = makeCtx()

  for (let i = 0; i < state.root.children.length; i++) {
    if (i > 0) parts.push("\n")
    const para = state.root.children[i]
    walkForBody(para, parts, bodyCtx)
  }

  for (const para of state.root.children) {
    walkForTrailer(para, trailers, trailerCtx)
  }
  for (const para of state.root.children) {
    walkForImages(para, images, imageCtx)
  }

  let text = parts.join("").trim()
  if (trailers.length > 0) {
    text += "\n"
    for (const t of trailers) text += "\n" + t
  }
  return { text, images }
}

function walkForBody(
  node: LexJsonNode | undefined,
  parts: string[],
  ctx: SerializerCtx,
): void {
  if (!node) return
  if (node.type === "text") {
    parts.push(typeof node.text === "string" ? node.text : "")
    return
  }
  if (node.type === "token") {
    const payload = node.payload as TokenPayload | undefined
    if (!payload) return
    const s = serializers.get(payload.kind)
    if (s) parts.push(s.toText(payload, ctx))
    else parts.push(`[${payload.title}]`)
    return
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) walkForBody(c, parts, ctx)
  }
}

function walkForTrailer(
  node: LexJsonNode | undefined,
  trailers: string[],
  ctx: SerializerCtx,
): void {
  if (!node) return
  if (node.type === "token") {
    const payload = node.payload as TokenPayload | undefined
    if (!payload) return
    const s = serializers.get(payload.kind)
    if (s?.toTrailer) trailers.push(s.toTrailer(payload, ctx))
    else if (s) s.toText(payload, ctx) // keep counter aligned
    return
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) walkForTrailer(c, trailers, ctx)
  }
}

function walkForImages(
  node: LexJsonNode | undefined,
  images: CollectedImage[],
  ctx: SerializerCtx,
): void {
  if (!node) return
  if (node.type === "token") {
    const payload = node.payload as TokenPayload | undefined
    if (!payload) return
    const s = serializers.get(payload.kind)
    if (s?.toImages) images.push(...s.toImages(payload, ctx))
    else if (s) s.toText(payload, ctx)
    return
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) walkForImages(c, images, ctx)
  }
}

// ---- Built-in serializers ----

/**
 * Generic "named reference" — a titled pill whose prompt representation is an
 * XML block with optional attributes and optional body content. Subsumes the
 * per-feature kinds (file, folder, turn summary, future labelled blocks). New
 * contexts that want pill-backed prompt injection should reach for this first;
 * only introduce a new `kind` when the serialization genuinely differs (e.g.
 * images, which produce ACP image content blocks instead of XML).
 *
 * data shape:
 *   tag: string                 // XML element name, e.g. "file_reference"
 *   attrs?: Record<string,string>  // attributes on the open tag
 *   content?: string            // body between open/close tags; omit for self-closing
 *   inlineLabel?: string        // inline placeholder prefix, e.g. "File Reference";
 *                               // when set, body inline reads `[<label> N: <title>]`
 *                               // and the open tag gets `number="N"`. Omit for
 *                               // `[<title>]` inline + no numbering.
 */
function escapeAttr(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

registerSerializer({
  kind: "reference",
  toText(payload, ctx) {
    const data = payload.data as {
      tag?: string
      inlineLabel?: string
    }
    const title = payload.title || "reference"
    if (data.inlineLabel && data.tag) {
      const n = ctx.next(data.tag)
      return `[${data.inlineLabel} ${n}: ${title}]`
    }
    // Unlabeled references still bump the per-tag counter so the trailer's
    // numbering (if it later needs one) stays in lockstep with body order.
    if (data.tag) ctx.next(data.tag)
    return `[${title}]`
  },
  toTrailer(payload, ctx) {
    const data = payload.data as {
      tag?: string
      attrs?: Record<string, string>
      content?: string
      inlineLabel?: string
    }
    if (!data.tag) return ""
    const n = ctx.next(data.tag)
    const numbered = !!data.inlineLabel
    const pairs: string[] = []
    if (numbered) pairs.push(`number="${n}"`)
    for (const [k, v] of Object.entries(data.attrs ?? {})) {
      pairs.push(`${k}="${escapeAttr(String(v))}"`)
    }
    const open = `<${data.tag}${pairs.length ? " " + pairs.join(" ") : ""}`
    if (data.content == null) return `${open} />\n`
    return `${open}>\n${data.content}\n</${data.tag}>\n`
  },
})

registerSerializer({
  kind: "file",
  toText(payload, ctx) {
    const n = ctx.next("file")
    const name =
      (payload.data.name as string | undefined) ?? payload.title ?? "file"
    return `[File Reference ${n}: ${name}]`
  },
  toTrailer(payload, ctx) {
    const n = ctx.next("file")
    const path = (payload.data.path as string | undefined) ?? ""
    const name =
      (payload.data.name as string | undefined) ?? payload.title ?? "file"
    const content = (payload.data.content as string | undefined) ?? ""
    return `<file_reference number="${n}" path="${path}" name="${name}">\n${content}\n</file_reference>\n`
  },
})

registerSerializer({
  kind: "image",
  toText(payload, ctx) {
    // Only "ready" images render a placeholder; still-uploading ones emit
    // nothing so the agent doesn't see a dangling reference.
    const status = payload.data.status as string | undefined
    if (status && status !== "ready") return ""
    const n = ctx.next("image")
    return `[Image ${n}]`
  },
  toImages(payload) {
    const status = payload.data.status as string | undefined
    if (status && status !== "ready") return []
    const out: CollectedImage[] = []
    for (const b of payload.blobs ?? []) {
      if (b.role && b.role !== "image") continue
      out.push({ blobId: b.blobId, mimeType: b.mimeType })
    }
    return out
  },
})

registerSerializer({
  kind: "folder",
  toText(payload) {
    const path = (payload.data.path as string | undefined) ?? ""
    const name =
      (payload.data.name as string | undefined) ?? payload.title ?? "folder"
    return `<folder path="${path}" name="${name}" />`
  },
})

export type { TokenBlob, TokenPayload }
