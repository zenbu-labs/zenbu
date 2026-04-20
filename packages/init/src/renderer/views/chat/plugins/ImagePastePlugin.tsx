import { useEffect } from "react"
import { nanoid } from "nanoid"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  $getSelection,
  $isRangeSelection,
  $isNodeSelection,
  $isElementNode,
  type LexicalNode,
} from "lexical"
import { ImageNode, $isImageNode } from "../lib/ImageNode"
import { $isTokenNode, TokenNode } from "../lib/TokenNode"
import {
  dispatchTokenInsert,
  dispatchTokenUpgrade,
} from "../lib/token-bus"
import { useKyjuClient, useRpc } from "../../../lib/providers"

/**
 * True for any inline decorator pill this plugin should treat as a unit
 * for delete (backspace swallows the whole pill instead of the character
 * before it). Kept broad so legacy ImageNodes in existing drafts keep
 * working alongside new TokenNodes.
 */
function isPillNode(node: LexicalNode | null | undefined): boolean {
  return $isImageNode(node) || $isTokenNode(node)
}

function $getAdjacentPillNode(backward: boolean): LexicalNode | null {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null

  const anchor = selection.anchor
  const node = anchor.getNode()

  if (anchor.type === "element" && $isElementNode(node)) {
    const children = node.getChildren()
    const target = backward
      ? children[anchor.offset - 1]
      : children[anchor.offset]
    if (isPillNode(target)) return target
    return null
  }

  if (backward) {
    if (anchor.offset === 0) {
      const prev = node.getPreviousSibling()
      if (isPillNode(prev)) return prev
    }
  } else {
    if (anchor.offset === node.getTextContentSize()) {
      const next = node.getNextSibling()
      if (isPillNode(next)) return next
    }
  }

  return null
}

/**
 * Clipboard image → composer pill. Same two-stage UX as before (optimistic
 * "uploading" placeholder, upgraded to "ready" once the blob lands on
 * disk), but now both stages go through the token-bus so a single
 * TokenNode class handles them — the plugin never touches Lexical
 * directly.
 *
 * The local uploading-stub uses `dispatchTokenInsert({source:"paste"})`
 * with a fresh `localId`. When upload finishes, `dispatchTokenUpgrade`
 * with the same `localId` rewrites the payload in place.
 *
 * We still need the agentId + sessionId for the dispatch. We pass the
 * agentId in as a prop; sessionId comes from the paneId URL param same as
 * toolbar-wrapper uses — read lazily at paste time.
 */
export function ImagePastePlugin({ agentId }: { agentId: string } = { agentId: "" }) {
  const [editor] = useLexicalComposerContext()
  const client = useKyjuClient()
  const _rpc = useRpc() // kept so HMR plumbing matches other plugins

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const clipboardData =
          event instanceof ClipboardEvent ? event.clipboardData : null
        if (!clipboardData) return false

        const imageFile = Array.from(clipboardData.files).find((f) =>
          f.type.startsWith("image/"),
        )
        if (!imageFile) return false

        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false

        event.preventDefault()

        const mimeType = imageFile.type
        const localSrc = URL.createObjectURL(imageFile)
        const localId = nanoid()
        const sessionId = resolveSessionIdFromUrl() ?? ""

        // Stage 1: optimistic pill (uploading).
        dispatchTokenInsert({
          sessionId,
          agentId,
          source: "paste",
          localId,
          payload: {
            kind: "image",
            title: "Image",
            data: { status: "uploading", localSrc },
            blobs: [],
          },
        })

        imageFile
          .arrayBuffer()
          .then(async (buffer) => {
            const data = new Uint8Array(buffer)
            const blobId = await (client as any).createBlob(data, true)

            const blobs = client.plugin.kernel.chatBlobs.read() ?? []
            await client.plugin.kernel.chatBlobs.set([
              ...blobs,
              { blobId, mimeType },
            ])

            // Stage 2: upgrade the stub to ready + real blob id.
            dispatchTokenUpgrade({
              sessionId,
              agentId,
              localId,
              payload: {
                kind: "image",
                title: "Image",
                data: { status: "ready", localSrc },
                blobs: [{ blobId, mimeType, role: "image" }],
              },
            })
          })
          .catch((err) => {
            console.error("[ImagePaste] failed:", err)
          })

        return true
      },
      COMMAND_PRIORITY_CRITICAL,
    )
  }, [editor, client, agentId])

  useEffect(() => {
    const handleDelete = (backward: boolean) => {
      const sel = $getSelection()
      if ($isNodeSelection(sel)) {
        const pills = sel.getNodes().filter(isPillNode)
        if (pills.length > 0) {
          for (const node of pills) node.remove()
          return true
        }
      }

      const adjacent = $getAdjacentPillNode(backward)
      if (adjacent) {
        adjacent.remove()
        return true
      }

      return false
    }

    const unregBackspace = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        const handled = handleDelete(true)
        if (handled) event.preventDefault()
        return handled
      },
      COMMAND_PRIORITY_HIGH,
    )
    const unregDelete = editor.registerCommand(
      KEY_DELETE_COMMAND,
      (event) => {
        const handled = handleDelete(false)
        if (handled) event.preventDefault()
        return handled
      },
      COMMAND_PRIORITY_HIGH,
    )
    return () => {
      unregBackspace()
      unregDelete()
    }
  }, [editor])

  return null
}

function resolveSessionIdFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  // sessionId isn't always in the URL today (the chat iframe URL carries
  // paneId). The TokenInsertPlugin filters on agentId only, so leaving
  // sessionId empty here is still correct for local inserts.
  return params.get("sessionId")
}

// Keep the named exports so existing callers that imported ImageNode from
// this module don't need to change.
export { ImageNode }
