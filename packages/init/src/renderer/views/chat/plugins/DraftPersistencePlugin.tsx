import { useEffect, useRef, useCallback } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { useKyjuClient } from "../../../lib/providers"

const DEBOUNCE_MS = 300
const MAX_STALE_MS = 4000

function isEditorStateEmpty(state: any): boolean {
  const root = state.root
  if (!root?.children?.length) return true
  for (const block of root.children) {
    if (!block.children?.length) continue
    for (const inline of block.children) {
      if (inline.type === "linebreak") continue
      if (inline.type === "text") {
        if (inline.text && inline.text.trim() !== "") return false
      } else {
        // FileReferenceNode, ImageNode, or any other non-text node = content
        return false
      }
    }
  }
  return true
}

export function DraftPersistencePlugin({ agentId }: { agentId: string }) {
  const [editor] = useLexicalComposerContext()
  const client = useKyjuClient()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleRef = useRef<number | null>(null)
  const lastSaveRef = useRef<number>(Date.now())

  const saveDraft = useCallback(() => {
    lastSaveRef.current = Date.now()
    const state = editor.getEditorState().toJSON()
    const chatBlobs = client.plugin.kernel.chatBlobs.read() ?? []

    if (isEditorStateEmpty(state) && chatBlobs.length === 0) {
      const drafts = client.plugin.kernel.composerDrafts.read() ?? {}
      if (drafts[agentId]) {
        const next = { ...drafts }
        delete next[agentId]
        client.plugin.kernel.composerDrafts.set(next)
      }
      return
    }

    const drafts = client.plugin.kernel.composerDrafts.read() ?? {}
    client.plugin.kernel.composerDrafts.set({
      ...drafts,
      [agentId]: { editorState: state, chatBlobs },
    })
  }, [editor, client, agentId])

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (idleRef.current != null) {
      cancelIdleCallback(idleRef.current)
      idleRef.current = null
    }
  }, [])

  const scheduleSave = useCallback(() => {
    cancelPending()
    const stale = Date.now() - lastSaveRef.current >= MAX_STALE_MS
    if (stale) {
      // Stale — save on next idle, with a timeout fallback
      idleRef.current = requestIdleCallback(() => {
        idleRef.current = null
        saveDraft()
      }, { timeout: DEBOUNCE_MS })
    } else {
      timerRef.current = setTimeout(saveDraft, DEBOUNCE_MS)
    }
  }, [saveDraft, cancelPending])

  useEffect(() => {
    const unregister = editor.registerUpdateListener(scheduleSave)
    return () => {
      unregister()
    }
  }, [editor, scheduleSave])

  // Flush on unmount if anything is pending
  useEffect(() => {
    return () => {
      if (timerRef.current || idleRef.current != null) {
        cancelPending()
        saveDraft()
      }
    }
  }, [saveDraft, cancelPending])

  return null
}

export function getInitialEditorState(
  client: any,
  agentId: string,
): string | null {
  const drafts = client.plugin.kernel.composerDrafts.read() ?? {}
  const draft = drafts[agentId]
  if (!draft?.editorState) return null
  return JSON.stringify(draft.editorState)
}

export function restoreChatBlobs(client: any, agentId: string): void {
  const drafts = client.plugin.kernel.composerDrafts.read() ?? {}
  const draft = drafts[agentId]
  const chatBlobs = draft?.chatBlobs ?? []
  client.plugin.kernel.chatBlobs.set(chatBlobs)
}

/** Check if a persisted draft has real content (for use outside the chat view) */
export function draftHasContent(draft: { editorState?: any; chatBlobs?: any[] } | undefined): boolean {
  if (!draft) return false
  if (draft.chatBlobs?.length) return true
  if (!draft.editorState) return false
  return !isEditorStateEmpty(draft.editorState)
}
