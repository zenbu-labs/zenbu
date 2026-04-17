import { useState, useCallback, useRef } from "react"
import type { EditorState, LexicalEditor } from "lexical"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { PillNode } from "./lib/PillNode"
import { TriggerMenuPlugins } from "./plugins/TriggerMenuPlugin"
import { AutoFocusPlugin, CtrlNPPlugin, NodeDeletePlugin } from "./plugins/KeyboardPlugin"
import { DebugPanels } from "./components/DebugPanels"
import { RichPastePlugin } from "./plugins/RichPastePlugin"

const editorConfig = {
  namespace: "composer-debug",
  onError: (error: Error) => console.error("[composer-debug]", error),
  nodes: [PillNode],
}

function EditorRefPlugin({ editorRef }: { editorRef: React.RefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext()
  editorRef.current = editor
  return null
}

export function App() {
  const [editorState, setEditorState] = useState<EditorState | null>(null)
  const editorRef = useRef<LexicalEditor | null>(null)
  const [submitLog, setSubmitLog] = useState<string[]>([])

  const onChange = useCallback((state: EditorState) => {
    setEditorState(state)
  }, [])

  const handleLoadScenario = useCallback((state: object) => {
    const editor = editorRef.current
    if (!editor) return
    const parsed = editor.parseEditorState(JSON.stringify(state))
    editor.setEditorState(parsed)
    setEditorState(parsed)
  }, [])

  return (
    <div className="flex h-full bg-white">
      {/* Left pane: Editor */}
      <div className="flex flex-1 flex-col border-r border-neutral-200">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2">
          <h1 className="text-xs font-semibold text-neutral-700">
            Composer Debug
          </h1>
          <div className="flex items-center gap-2 text-[10px] text-neutral-400">
            <span>Type <kbd className="rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[10px]">@</kbd> for mentions</span>
            <span>Type <kbd className="rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[10px]">/</kbd> for commands</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <LexicalComposer initialConfig={editorConfig}>
            <div className="relative min-h-[200px]">
              <PlainTextPlugin
                contentEditable={
                  <ContentEditable className="min-h-[200px] px-4 pt-3 pb-2 text-sm outline-none" />
                }
                placeholder={
                  <div className="pointer-events-none absolute top-3 left-4 text-sm text-neutral-400">
                    Type a message... Use @ for mentions, / for commands
                  </div>
                }
                ErrorBoundary={({ children }) => <>{children}</>}
              />
            </div>
            <HistoryPlugin />
            <TriggerMenuPlugins />
            <AutoFocusPlugin />
            <CtrlNPPlugin />
            <NodeDeletePlugin />
            <RichPastePlugin />
            <OnChangePlugin onChange={onChange} />
            <EditorRefPlugin editorRef={editorRef} />
          </LexicalComposer>
        </div>

        {/* Submit log */}
        {submitLog.length > 0 && (
          <div className="shrink-0 border-t border-neutral-200 bg-neutral-50 px-4 py-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-medium text-neutral-500">
                Submit Log
              </span>
              <button
                type="button"
                onClick={() => setSubmitLog([])}
                className="text-[10px] text-neutral-400 hover:text-neutral-600"
              >
                Clear
              </button>
            </div>
            <div className="max-h-[100px] overflow-auto">
              {submitLog.map((entry, i) => (
                <div key={i} className="text-[10px] text-neutral-500">
                  {entry}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right pane: Debug panels */}
      <div className="w-[400px] shrink-0">
        {editorRef.current ? (
          <DebugPanels
            editor={editorRef.current}
            editorState={editorState}
            onLoadScenario={handleLoadScenario}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400">
            Loading editor...
          </div>
        )}
      </div>
    </div>
  )
}
