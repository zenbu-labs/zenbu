import { useCallback, useEffect, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $createNodeSelection, $setSelection } from "lexical"
import type { NodeKey } from "lexical"
import type { TokenPayload } from "../../../../../shared/tokens"
import { useKyjuClient } from "../../../lib/providers"

/**
 * Generic pill. `kind` only drives click affordances (file → open, image →
 * select the node). Chrome comes from `title/color/blobs` so new kinds don't
 * touch the component.
 */
export function TokenPill({
  nodeKey,
  payload,
}: {
  nodeKey: NodeKey
  payload: TokenPayload
}) {
  const [editor] = useLexicalComposerContext()

  const onSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      editor.update(() => {
        const selection = $createNodeSelection()
        selection.add(nodeKey)
        $setSelection(selection)
      })
    },
    [editor, nodeKey],
  )

  const hasInlineImage = (payload.blobs ?? []).some(
    (b) => !b.role || b.role === "image",
  )

  if (hasInlineImage) return <ImageShape payload={payload} onSelect={onSelect} />

  const colorStyles = colorToClasses(payload.color, payload.kind)
  const title = payload.title
  const tooltip = describeTooltip(payload)

  return (
    <span
      className={`inline-flex cursor-pointer items-center gap-1 rounded border px-1 py-px align-bottom text-[11px] font-medium max-w-[220px] ${colorStyles}`}
      title={tooltip}
      onClick={onSelect}
    >
      <KindIcon kind={payload.kind} />
      <span className="truncate">{title}</span>
    </span>
  )
}

function describeTooltip(payload: TokenPayload): string {
  const path = payload.data.path
  if (typeof path === "string" && path) return path
  return payload.title
}

function colorToClasses(color: string | undefined, kind: string): string {
  // Tailwind can't see dynamic classes, so we switch on a fixed palette.
  // Unknown `color` values fall through to kind-based defaults.
  switch (color) {
    case "blue":
      return "border-blue-400/20 bg-blue-500/8 text-blue-600"
    case "amber":
      return "border-amber-400/20 bg-amber-500/10 text-amber-700"
    case "emerald":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-700"
    case "rose":
      return "border-rose-400/20 bg-rose-500/10 text-rose-700"
    case "neutral":
      return "border-neutral-300 bg-neutral-100 text-neutral-700"
  }
  switch (kind) {
    case "file":
      return "border-blue-400/20 bg-blue-500/8 text-blue-600"
    case "folder":
      return "border-amber-400/20 bg-amber-500/10 text-amber-700"
    default:
      return "border-neutral-300 bg-neutral-100 text-neutral-700"
  }
}

function KindIcon({ kind }: { kind: string }) {
  const cls = "h-3 w-3 shrink-0"
  if (kind === "folder") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
    )
  }
  // default: file icon
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      className="h-3 w-3 shrink-0 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
      />
      <path
        d="M8 2a6 6 0 0 1 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ImageShape({
  payload,
  onSelect,
}: {
  payload: TokenPayload
  onSelect: (e: React.MouseEvent) => void
}) {
  const client = useKyjuClient()
  const blob = (payload.blobs ?? []).find(
    (b) => !b.role || b.role === "image",
  )
  const localSrc = (payload.data.localSrc as string | undefined) ?? null
  const uploading = payload.data.status === "uploading" || !blob?.blobId
  const [imgSrc, setImgSrc] = useState<string | null>(localSrc ?? null)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (localSrc) {
      setImgSrc(localSrc)
      return
    }
    if (!blob?.blobId) return
    let revoke: string | null = null
    ;(client as any).getBlobData(blob.blobId).then((data: Uint8Array | null) => {
      if (!data) return
      const url = URL.createObjectURL(
        new Blob([data as BlobPart], { type: blob.mimeType }),
      )
      revoke = url
      setImgSrc(url)
    })
    return () => {
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [localSrc, blob?.blobId, blob?.mimeType, client])

  return (
    <span
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 align-bottom"
      title={uploading ? "Uploading image…" : payload.title}
      onClick={onSelect}
    >
      {uploading ? (
        <Spinner />
      ) : imgSrc && !imgError ? (
        <img
          src={imgSrc}
          alt=""
          className="h-6 max-w-[80px] rounded object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-[10px] text-neutral-500">Image</span>
      )}
    </span>
  )
}
