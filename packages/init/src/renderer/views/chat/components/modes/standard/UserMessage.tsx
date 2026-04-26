import {
  useRef,
  useState,
  useLayoutEffect,
  useMemo,
  useCallback,
  type MouseEvent,
} from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import type { UserMessageProps } from "../../../lib/chat-components";
import { ImageNode } from "../../../lib/ImageNode";
import { FileReferenceNode } from "../../../lib/FileReferenceNode";
import { TokenNode } from "../../../lib/TokenNode";
import {
  $deserializeUserMessage,
  hasRehydratableEditorState,
} from "../../../lib/deserialize";
import { useRpc } from "../../../../../lib/providers";

const MINIMAP =
  new URLSearchParams(window.location.search).get("minimap") === "true";

function PassthroughErrorBoundary({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ReadOnlyLexicalMessage({
  content,
  images,
  editorState,
}: {
  content: string;
  images: { blobId: string; mimeType: string }[];
  editorState?: unknown;
}) {
  // Stabilize references: materializeMessages rebuilds arrays on every
  // event but the values for a given past user message are immutable.
  const imagesKey = useMemo(() => JSON.stringify(images), [images]);
  const stableImages = useMemo(() => images, [imagesKey]);
  const editorStateKey = useMemo(
    () => (editorState ? JSON.stringify(editorState) : ""),
    [editorState],
  );

  const editorConfig = useMemo(() => {
    const nodes = [ImageNode, FileReferenceNode, TokenNode];
    // Prefer the persisted editor-state JSON: it carries every pill's full
    // payload (color / kind / data) that the flat text can't represent.
    // Lexical accepts a JSON string in the `editorState` config slot and
    // rehydrates via each node class's `importJSON`.
    if (hasRehydratableEditorState(editorState)) {
      return {
        namespace: "user-message-readonly",
        editable: false,
        nodes,
        editorState: editorStateKey,
        onError: (error: Error) => console.error(error),
      };
    }
    return {
      namespace: "user-message-readonly",
      editable: false,
      nodes,
      editorState: () => $deserializeUserMessage(content, stableImages),
      onError: (error: Error) => console.error(error),
    };
  }, [content, stableImages, editorState, editorStateKey]);

  return (
    <LexicalComposer initialConfig={editorConfig}>
      <PlainTextPlugin
        contentEditable={
          <ContentEditable className="outline-none whitespace-pre-wrap wrap-break-word leading-relaxed" />
        }
        placeholder={null}
        ErrorBoundary={PassthroughErrorBoundary}
      />
    </LexicalComposer>
  );
}

export function UserMessage({
  content,
  images,
  editorState,
}: UserMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [copied, setCopied] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const rpc = useRpc();

  // Route through the Lexical renderer when there's structured content —
  // images, a persisted editor state, or a file-reference trailer in the
  // text (legacy events without editorState still use a file pill).
  const hasStructuredContent =
    (images && images.length > 0) ||
    hasRehydratableEditorState(editorState) ||
    content.includes("<file_reference ");

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (el) setOverflows(el.scrollHeight > 120);
  }, [content, images]);

  const handleCopy = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      rpc.window.copyToClipboard(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    [content, rpc],
  );

  return (
    <div className="group/msg py-1">
      <div
        className="group w-full rounded-lg border px-3 py-2 text-(--zenbu-user-message-foreground) border-(--zenbu-user-message-border)"
        onClick={!expanded && overflows ? () => setExpanded(true) : undefined}
        style={{
          backgroundColor: "var(--zenbu-user-message)",
          cursor: !expanded && overflows ? "pointer" : undefined,
        }}
      >
        <div
          className={`relative overflow-hidden ${
            expanded ? "" : "max-h-[120px]"
          }`}
        >
          <div
            ref={innerRef}
            className={
              hasStructuredContent
                ? ""
                : "whitespace-pre-wrap wrap-break-word leading-relaxed"
            }
          >
            {hasStructuredContent ? (
              <ReadOnlyLexicalMessage
                content={content}
                images={images ?? []}
                editorState={editorState}
              />
            ) : (
              content
            )}
          </div>
          {!expanded && overflows && (
            <div
              className="absolute inset-x-0 bottom-0 h-10"
              style={{
                background:
                  "linear-gradient(to top, var(--zenbu-user-message), transparent)",
              }}
            >
              <div className="absolute inset-x-0 -bottom-1 flex items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3.5 5.5L7 9l3.5-3.5" />
                </svg>
              </div>
            </div>
          )}
        </div>
        {expanded && overflows && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="flex w-full items-center justify-center pt-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
            className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded transition-colors"
          >
            {copied ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
