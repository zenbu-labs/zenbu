import { useEffect } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
  $getSelection,
  $isRangeSelection,
} from "lexical"
import {
  $insertDataTransferForRichText,
  $insertDataTransferForPlainText,
} from "@lexical/clipboard"

/**
 * Overrides PlainTextPlugin's paste handler to preserve FileReferenceNodes.
 * PlainTextPlugin uses $insertDataTransferForPlainText which strips custom nodes.
 * This intercepts at HIGH priority and uses the rich-text variant only when
 * application/x-lexical-editor JSON is present (i.e. our custom nodes like
 * FileReferenceNode). For regular text/HTML pastes (e.g. code blocks from
 * websites) we fall back to plain text to avoid inheriting monospace styling.
 */
export function RichPastePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false

        const clipboardData =
          event instanceof ClipboardEvent ? event.clipboardData : null
        if (!clipboardData) return false

        event.preventDefault()

        if (clipboardData.types.includes("application/x-lexical-editor")) {
          $insertDataTransferForRichText(clipboardData, selection, editor)
        } else {
          $insertDataTransferForPlainText(clipboardData, selection)
        }

        return true
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [editor])

  return null
}
