import { useEffect } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
  $getSelection,
  $isRangeSelection,
} from "lexical"
import { $insertDataTransferForRichText } from "@lexical/clipboard"

/**
 * Overrides the PlainTextPlugin's paste handler to support rich paste.
 * This preserves PillNodes (and any other custom nodes) when cutting/pasting.
 *
 * PlainTextPlugin registers PASTE_COMMAND at COMMAND_PRIORITY_EDITOR (0)
 * and calls $insertDataTransferForPlainText which strips all custom nodes.
 *
 * This plugin registers at COMMAND_PRIORITY_HIGH (3) to intercept first
 * and calls $insertDataTransferForRichText which:
 * 1. Tries application/x-lexical-editor JSON (uses importJSON)
 * 2. Falls back to text/html (uses importDOM)
 * 3. Falls back to text/plain
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
        $insertDataTransferForRichText(clipboardData, selection, editor)
        return true
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [editor])

  return null
}
