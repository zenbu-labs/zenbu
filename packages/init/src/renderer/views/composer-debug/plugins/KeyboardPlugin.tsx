import { useEffect } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  $getSelection,
  $isNodeSelection,
  COMMAND_PRIORITY_HIGH,
  DELETE_CHARACTER_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
} from "lexical"

/**
 * Intercepts Ctrl+N / Ctrl+P and dispatches them as ArrowDown / ArrowUp
 * so the LexicalTypeaheadMenuPlugin picks them up for menu navigation.
 */
export function CtrlNPPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
          return false
        }

        if (event.key === "n") {
          event.preventDefault()
          editor.dispatchCommand(KEY_ARROW_DOWN_COMMAND, event)
          return true
        }

        if (event.key === "p") {
          event.preventDefault()
          editor.dispatchCommand(KEY_ARROW_UP_COMMAND, event)
          return true
        }

        return false
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [editor])

  return null
}

/**
 * PlainTextPlugin only handles backspace/delete for RangeSelection.
 * When a DecoratorNode (pill) is selected, Lexical uses NodeSelection,
 * so backspace does nothing. This plugin fills that gap.
 */
export function NodeDeletePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const selection = $getSelection()
      if (!$isNodeSelection(selection)) return false
      event.preventDefault()
      return editor.dispatchCommand(DELETE_CHARACTER_COMMAND, event.type === "keydown")
    }

    return editor.registerCommand(KEY_BACKSPACE_COMMAND, handle, COMMAND_PRIORITY_HIGH)
  }, [editor])

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const selection = $getSelection()
      if (!$isNodeSelection(selection)) return false
      event.preventDefault()
      return editor.dispatchCommand(DELETE_CHARACTER_COMMAND, false)
    }

    return editor.registerCommand(KEY_DELETE_COMMAND, handle, COMMAND_PRIORITY_HIGH)
  }, [editor])

  return null
}

export function AutoFocusPlugin() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    editor.focus()
  }, [editor])
  return null
}
