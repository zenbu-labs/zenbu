/**
 * Generic insert-token payload shared between renderer (composer pills) and
 * main process (InsertService, prompt serialization). One token = one pill in
 * the composer = one structured piece of the outgoing prompt.
 *
 * The payload is fully self-describing:
 *   - `title` / `color` / `blobs` drive the pill chrome — the pill renderer
 *     doesn't need to know the kind to draw a labeled chip with thumbnails.
 *   - `kind` + `data` drive prompt-time serialization via a registry keyed
 *     on `kind` (see `./prompt-serialize.ts`).
 *
 * Round-trip invariant: this object is plain JSON. It is stored verbatim
 * inside a Lexical TokenNode, serialized by that node's exportJSON, and
 * re-imported by importJSON into an identical TokenNode. This is how
 * cross-session inserts survive being written to `composerDrafts` while
 * the target composer is not live.
 */
export type TokenBlob = {
  blobId: string
  mimeType: string
  /**
   * How the pill renderer should treat this blob. `"image"` shows it as an
   * inline thumbnail; `"thumbnail"` is reserved for a smaller preview next
   * to a non-image title (e.g., a file icon). Future roles can be added.
   */
  role?: "image" | "thumbnail"
}

export type TokenPayload = {
  kind: string
  title: string
  color?: string
  data: Record<string, unknown>
  blobs?: TokenBlob[]
}

export function isTokenPayload(x: unknown): x is TokenPayload {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (
    typeof o.kind === "string" &&
    typeof o.title === "string" &&
    o.data !== null &&
    typeof o.data === "object"
  )
}
