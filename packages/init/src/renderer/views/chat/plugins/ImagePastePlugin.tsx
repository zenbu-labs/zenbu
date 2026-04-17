import { useEffect } from "react"
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
  $insertNodes,
  $createTextNode,
} from "lexical"
import { $createImageNode, ImageNode, $isImageNode } from "../lib/ImageNode"
import { useKyjuClient } from "../../../lib/providers"

function $getAdjacentImageNode(backward: boolean): ImageNode | null {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null

  const anchor = selection.anchor
  const node = anchor.getNode()

  if (anchor.type === "element" && $isElementNode(node)) {
    const children = node.getChildren()
    const target = backward ? children[anchor.offset - 1] : children[anchor.offset]
    if ($isImageNode(target)) return target
    return null
  }

  if (backward) {
    if (anchor.offset === 0) {
      const prev = node.getPreviousSibling()
      if ($isImageNode(prev)) return prev
    }
  } else {
    if (anchor.offset === node.getTextContentSize()) {
      const next = node.getNextSibling()
      if ($isImageNode(next)) return next
    }
  }

  return null
}

export function ImagePastePlugin() {
  const [editor] = useLexicalComposerContext()
  const client = useKyjuClient()

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

        imageFile.arrayBuffer().then(async (buffer) => {
          const data = new Uint8Array(buffer)
          const blobId = await (client as any).createBlob(data, true)

          const blobs = client.plugin.kernel.chatBlobs.read() ?? []
          await client.plugin.kernel.chatBlobs.set([
            ...blobs,
            { blobId, mimeType },
          ])

          editor.update(() => {
            const imageNode = $createImageNode(blobId, mimeType, "ready", localSrc)
            const spaceNode = $createTextNode(" ")
            $insertNodes([imageNode, spaceNode])
            spaceNode.select()
          })
        }).catch((err) => {
          console.error("[ImagePaste] failed:", err)
        })

        return true
      },
      COMMAND_PRIORITY_CRITICAL,
    )
  }, [editor, client])

  useEffect(() => {
    const handleDelete = (backward: boolean) => {
      if ($isNodeSelection($getSelection())) {
        const images = $getSelection()!.getNodes().filter($isImageNode)
        if (images.length > 0) {
          for (const node of images) node.remove()
          return true
        }
      }

      const adjacent = $getAdjacentImageNode(backward)
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
    return () => { unregBackspace(); unregDelete() }
  }, [editor])

  return null
}
