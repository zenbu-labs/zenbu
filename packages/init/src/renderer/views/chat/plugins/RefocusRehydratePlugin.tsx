import { useEffect, useRef } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { useKyjuClient } from "../../../lib/providers"
import { getDraftFlush } from "./DraftPersistencePlugin"
import { migrateLegacyNodesInEditorState } from "../../../../../shared/editor-state"

/**
 * "Read-your-own-writes" for backgrounded composers. Because InsertService
 * only dispatches the live event to the focused-active session, any insert
 * aimed at a different window/pane lands in `composerDrafts` instead. The
 * target composer must observe that change when it regains focus — this
 * plugin is the observer.
 *
 * Protocol (TODO(crdt): temporary until we have a merge protocol):
 *   1. Blur: the composer is about to stop being authoritative. Flush any
 *      debounced local edits synchronously so they're in the draft before
 *      an external writer touches it.
 *   2. Focus: the composer is about to become authoritative again. Read
 *      the draft and replace editor state — if no one wrote to us while
 *      blurred, this is a no-op; if they did, we pick up the new pills.
 *
 * Because nobody can type into a composer that's not focused, there's no
 * risk of local unsaved edits getting overwritten by step 2.
 */
export function RefocusRehydratePlugin({ agentId }: { agentId: string }) {
  const [editor] = useLexicalComposerContext()
  const client = useKyjuClient()
  const wasFocusedRef = useRef<boolean>(false)
  const lastRehydratedKeyRef = useRef<string>("")

  useEffect(() => {
    if (typeof window === "undefined") return

    const isFocused = () =>
      typeof document !== "undefined" && document.hasFocus()

    const rehydrate = () => {
      const drafts = (client as any).plugin.kernel.composerDrafts.read() ?? {}
      const state = drafts[agentId]?.editorState
      if (!state || typeof state !== "object") return
      const migrated = migrateLegacyNodesInEditorState(state)
      const key = JSON.stringify(migrated)
      // Skip replace when the draft matches what we already have — avoids
      // resetting caret/selection on every focus flicker.
      if (key === lastRehydratedKeyRef.current) return
      lastRehydratedKeyRef.current = key
      try {
        const parsed = editor.parseEditorState(key)
        editor.setEditorState(parsed)
      } catch (err) {
        console.warn("[refocus-rehydrate] parse failed:", err)
      }
    }

    const onFocus = () => {
      if (!wasFocusedRef.current) {
        wasFocusedRef.current = true
        // TODO(crdt): Coarse "reset to server truth" — replace the editor
        // state wholesale because we have no way to diff-and-apply remote
        // ops onto local state.
        rehydrate()
      }
    }

    const onBlur = () => {
      if (wasFocusedRef.current) {
        wasFocusedRef.current = false
        // TODO(crdt): Synchronous flush narrows but doesn't close the
        // race between the debounced write and an external writer.
        const flush = getDraftFlush(agentId)
        if (flush) flush()
        // Remember the baseline so we don't replace editor state on the
        // next focus if no one else wrote.
        const drafts =
          (client as any).plugin.kernel.composerDrafts.read() ?? {}
        const state = drafts[agentId]?.editorState
        lastRehydratedKeyRef.current = state ? JSON.stringify(state) : ""
      }
    }

    // Prime the initial state — treat "already focused on mount" as if we
    // just focused, so the baseline is recorded.
    wasFocusedRef.current = isFocused()
    if (wasFocusedRef.current) {
      const drafts = (client as any).plugin.kernel.composerDrafts.read() ?? {}
      const state = drafts[agentId]?.editorState
      lastRehydratedKeyRef.current = state ? JSON.stringify(state) : ""
    }

    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("blur", onBlur)
    }
  }, [editor, client, agentId])

  return null
}
