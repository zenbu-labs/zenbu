import { useCallback, useEffect, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $createNodeSelection, $setSelection } from "lexical"
import type { NodeKey } from "lexical"
import type { ImageStatus } from "../lib/ImageNode"
import { useKyjuClient } from "../../../lib/providers"

function Spinner() {
  return (
    <svg className="h-3 w-3 shrink-0 animate-spin" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ImagePill({
  nodeKey,
  blobId,
  mimeType,
  status,
  localSrc,
}: {
  nodeKey: NodeKey
  blobId: string
  mimeType: string
  status: ImageStatus
  localSrc?: string | null
}) {
  const [editor] = useLexicalComposerContext()
  const client = useKyjuClient()
  const [imgSrc, setImgSrc] = useState<string | null>(localSrc ?? null)
  const [imgError, setImgError] = useState(false)
  const isUploading = status === "uploading"

  useEffect(() => {
    if (localSrc) {
      setImgSrc(localSrc)
      return
    }

    let revoke: string | null = null
    ;(client as any).getBlobData(blobId).then((data: Uint8Array | null) => {
      if (!data) return
      const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mimeType }))
      revoke = url
      setImgSrc(url)
    })

    return () => {
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [localSrc, blobId, mimeType, client])

  const handleClick = useCallback(
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

  return (
    <span
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 align-bottom"
      title={isUploading ? "Uploading image…" : `Image (${mimeType})`}
      onClick={handleClick}
    >
      {isUploading ? (
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
