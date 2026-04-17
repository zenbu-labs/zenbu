import { useRef, useState, useLayoutEffect, useMemo, useCallback, type MouseEvent } from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import type { UserMessageProps } from "../../../lib/chat-components"
import { ImageNode } from "../../../lib/ImageNode"
import { $deserializeUserMessage } from "../../../lib/deserialize"

const MINIMAP = new URLSearchParams(window.location.search).get("minimap") === "true"
const BUBBLE_BG = "rgb(255, 255, 255)"

function PassthroughErrorBoundary({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function ReadOnlyLexicalMessage({
  content,
  images,
}: {
  content: string
  images: { blobId: string; mimeType: string }[]
}) {
  // Stabilize images reference — materializeMessages creates new arrays on every event,
  // but the values don't change for a given user message.
  const imagesKey = useMemo(
    () => JSON.stringify(images),
    [images],
  )
  const stableImages = useMemo(() => images, [imagesKey])

  const editorConfig = useMemo(
    () => ({
      namespace: "user-message-readonly",
      editable: false,
      nodes: [ImageNode],
      editorState: () => $deserializeUserMessage(content, stableImages),
      onError: (error: Error) => console.error(error),
    }),
    [content, stableImages],
  )

  return (
    <LexicalComposer initialConfig={editorConfig}>
      <PlainTextPlugin
        contentEditable={
          <ContentEditable className="outline-none whitespace-pre-wrap break-words leading-relaxed" />
        }
        placeholder={null}
        ErrorBoundary={PassthroughErrorBoundary}
      />
    </LexicalComposer>
  )
}

export function UserMessage({ content, images }: UserMessageProps) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const [copied, setCopied] = useState(false)
  const innerRef = useRef<HTMLDivElement>(null)

  const hasImages = images && images.length > 0

  useLayoutEffect(() => {
    const el = innerRef.current
    if (el) setOverflows(el.scrollHeight > 120)
  }, [content, images])

  const handleCopy = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [content])

  return (
    <div
      className="group/msg py-1"
    >
      <div
        className="group w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
        onClick={!expanded && overflows ? () => setExpanded(true) : undefined}
        style={{
          backgroundColor: BUBBLE_BG,
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
          cursor: !expanded && overflows ? "pointer" : undefined,
        }}
      >
        <div
          className={`relative overflow-hidden ${expanded ? "" : "max-h-[120px]"}`}
        >
          <div
            ref={innerRef}
            className={hasImages ? "" : "whitespace-pre-wrap break-words leading-relaxed"}
          >
            {hasImages ? (
              <ReadOnlyLexicalMessage content={content} images={images} />
            ) : (
              content
            )}
          </div>
          {!expanded && overflows && (
            <div
              className="absolute inset-x-0 bottom-0 h-10"
              style={{
                background: `linear-gradient(to top, ${BUBBLE_BG}, transparent)`,
              }}
            >
              <div className="absolute inset-x-0 -bottom-1 flex items-center justify-center text-neutral-500 opacity-0 transition-opacity group-hover:opacity-100">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 5.5L7 9l3.5-3.5" />
                </svg>
              </div>
            </div>
          )}
        </div>
        {expanded && overflows && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
            className="flex w-full items-center justify-center pt-1.5 text-neutral-500 hover:text-neutral-600 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 9L7 5.5 10.5 9" />
            </svg>
          </button>
        )}
      </div>
      <div className="relative h-2 flex justify-end">
        <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover/msg:opacity-100">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-neutral-400 hover:text-neutral-600 cursor-pointer rounded transition-colors"
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          )}
        </button>
        </div>
      </div>
    </div>
  )
}
