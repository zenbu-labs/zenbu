import { useState, useMemo, useLayoutEffect, useEffect, useRef } from "react"
import { DiffViewer } from "@zenbu/diffs/react"
import { Streamdown } from "streamdown"
import { tokenizeLines, langFromPath } from "@zenbu/diffs"
import type { SyntaxToken } from "@zenbu/diffs"
import { streamdownProps } from "../lib/streamdown-config"
import type { MaterializedMessage, ToolMessageData, ToolCallContentItem } from "../lib/materialize"

type DiffEntry = {
  path: string
  oldText: string
  newText: string
}

function collectDiffs(tool: ToolMessageData): DiffEntry[] {
  const diffs: DiffEntry[] = []
  for (const item of tool.contentItems) {
    if (item.type === "diff") {
      diffs.push({ path: item.path, oldText: item.oldText ?? "", newText: item.newText })
    }
  }
  for (const child of tool.children) {
    diffs.push(...collectDiffs(child))
  }
  return diffs
}

function isWriteTool(tool: ToolMessageData): boolean {
  const name = (tool.toolName ?? "").toLowerCase()
  return name === "write" || tool.kind === "create"
}

function getWritePath(tool: ToolMessageData): string | null {
  if (!isWriteTool(tool)) return null
  const input = tool.rawInput as Record<string, any> | null
  return input?.file_path ?? input?.path ?? null
}

function fileBasename(p: string): string {
  return p.split("/").pop() ?? p
}

function isMarkdownFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  return ext === "md" || ext === "mdx"
}

function useHighlightedLines(code: string, path: string) {
  const [tokens, setTokens] = useState<SyntaxToken[][] | null>(null)
  const versionRef = useRef(0)

  useEffect(() => {
    const version = ++versionRef.current
    const lang = langFromPath(path)
    if (lang === "text") return
    const lines = code.split("\n")
    tokenizeLines(lines, lang).then((result) => {
      if (version === versionRef.current) setTokens(result)
    }).catch(() => {})
    return () => { versionRef.current++ }
  }, [code, path])

  return tokens
}

function SyntaxView({ code, path }: { code: string; path: string }) {
  const tokens = useHighlightedLines(code, path)
  const lines = code.split("\n")

  return (
    <div
      style={{
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: "var(--diff-font-size, 12px)",
        lineHeight: "var(--diff-line-height, 18px)",
        overflow: "auto",
        tabSize: 2,
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{ display: "flex" }}>
          <span
            style={{
              width: "3px",
              minWidth: "3px",
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, whiteSpace: "pre", overflow: "hidden", paddingLeft: "6px" }}>
            {tokens?.[i] ? (
              tokens[i].map((t, j) => (
                <span key={j} style={t.color ? { color: t.color } : undefined}>{t.text}</span>
              ))
            ) : (
              line || " "
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

function MdToggle({ tab, setTab }: { tab: "preview" | "raw"; setTab: (t: "preview" | "raw") => void }) {
  return (
    <div className="flex items-center gap-0 ml-auto shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setTab("preview") }}
        className={`px-2 py-0.5 text-[11px] rounded-l border border-neutral-300 cursor-pointer ${tab === "preview" ? "bg-white text-neutral-800 font-medium" : "bg-neutral-100 text-neutral-500"}`}
      >
        preview
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setTab("raw") }}
        className={`px-2 py-0.5 text-[11px] rounded-r border border-l-0 border-neutral-300 cursor-pointer ${tab === "raw" ? "bg-white text-neutral-800 font-medium" : "bg-neutral-100 text-neutral-500"}`}
      >
        raw
      </button>
    </div>
  )
}

function CreatedFileEntry({ path, content }: { path: string; content: string }) {
  const isMd = isMarkdownFile(path)
  const [tab, setTab] = useState<"preview" | "raw">(isMd ? "preview" : "raw")

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-1 bg-neutral-50 font-mono min-w-0">
        <span className="text-[11px] text-neutral-600 shrink-0">{fileBasename(path)}</span>
        <span className="text-[10px] text-neutral-300 truncate min-w-0 direction-rtl text-left">{path}</span>
        {isMd && <MdToggle tab={tab} setTab={setTab} />}
      </div>
      <CreatedFileBody path={path} content={content} tab={tab} />
    </div>
  )
}

function CreatedFileBody({ path, content, tab }: { path: string; content: string; tab: "preview" | "raw" }) {
  return tab === "preview" && isMarkdownFile(path) ? (
    <div className="px-5 py-2 text-sm text-neutral-800 leading-relaxed overflow-hidden">
      <Streamdown {...streamdownProps}>{content}</Streamdown>
    </div>
  ) : (
    <div className="text-xs overflow-x-auto">
      <SyntaxView code={content} path={path} />
    </div>
  )
}

function getLastTurnData(messages: MaterializedMessage[]) {
  let lastUserIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserIdx = i; break }
  }
  if (lastUserIdx === -1) return null

  const diffs: DiffEntry[] = []
  const createdFiles = new Set<string>()
  const createdFileContents = new Map<string, string>()
  const editedFiles = new Set<string>()

  for (let i = lastUserIdx + 1; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === "tool") {
      const writePath = getWritePath(msg)
      if (writePath) {
        createdFiles.add(writePath)
        const input = (msg as ToolMessageData).rawInput as Record<string, any> | null
        const content = input?.content ?? input?.contents ?? ""
        if (typeof content === "string" && content) {
          createdFileContents.set(writePath, content)
        }
      }

      const toolDiffs = collectDiffs(msg)
      for (const d of toolDiffs) {
        diffs.push(d)
        if (!createdFiles.has(d.path)) {
          editedFiles.add(d.path)
        }
      }
    }
  }

  if (diffs.length === 0 && createdFiles.size === 0) return null

  return { diffs, createdFiles, createdFileContents, editedFiles }
}

export function TurnSummary({ messages, isLockedToBottom, scrollToBottom }: { messages: MaterializedMessage[]; isLockedToBottom: boolean; scrollToBottom?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const data = useMemo(() => getLastTurnData(messages), [messages])

  useLayoutEffect(() => {
    if (expanded && isLockedToBottom) {
      scrollToBottom?.()
    }
  }, [expanded])

  if (!data) return null

  const lastMessage = messages[messages.length - 1]
  const lastIsInterrupted = lastMessage?.role === "interrupted"

  const { diffs, createdFiles, createdFileContents, editedFiles } = data

  // per-file diff line counts
  const fileStats = new Map<string, { added: number; removed: number }>()
  for (const d of diffs) {
    const stats = fileStats.get(d.path) ?? { added: 0, removed: 0 }
    const oldLines = d.oldText ? d.oldText.split("\n") : []
    const newLines = d.newText.split("\n")
    const oldSet = new Set(oldLines)
    const newSet = new Set(newLines)
    for (const l of newLines) { if (!oldSet.has(l)) stats.added++ }
    for (const l of oldLines) { if (!newSet.has(l)) stats.removed++ }
    fileStats.set(d.path, stats)
  }
  for (const p of createdFiles) {
    if (!fileStats.has(p)) fileStats.set(p, { added: 0, removed: 0 })
  }

  const allFiles = [...fileStats.entries()]

  return (
    <div>
      {!lastIsInterrupted && <div className="border-t border-neutral-300 my-2" />}
      <div className="rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full pr-3 py-1.5 text-sm text-left hover:bg-neutral-100 rounded-md cursor-pointer min-w-0"
      >
        <svg
          className="shrink-0 text-neutral-400 transition-transform"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: expanded ? "rotate(90deg)" : undefined }}
        >
          <path d="M4.5 3L7.5 6L4.5 9" />
        </svg>
        <span className="truncate min-w-0 text-neutral-500">
          {allFiles.slice(0, 4).map(([path, stats], i) => (
            <span key={path}>
              {i > 0 && <span className="text-neutral-600">{", "}</span>}
              <span className="text-neutral-600">{fileBasename(path)}</span>
              {createdFiles.has(path) && !editedFiles.has(path) ? (
                <span className="text-blue-500 ml-0.5">new</span>
              ) : (stats.added > 0 || stats.removed > 0) && (
                <span className="ml-0.5">
                  {stats.added > 0 && <span className="text-green-600">+{stats.added}</span>}
                  {stats.added > 0 && stats.removed > 0 && " "}
                  {stats.removed > 0 && <span className="text-red-500">-{stats.removed}</span>}
                </span>
              )}
            </span>
          ))}
          {allFiles.length > 4 && <span className="text-neutral-400">{` +${allFiles.length - 4} more`}</span>}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-neutral-200 divide-y divide-neutral-200 max-h-[65vh] overflow-y-auto">
          {diffs.map((d, i) => {
            const isCreated = createdFiles.has(d.path)
            const content = isCreated ? (createdFileContents.get(d.path) || d.newText) : ""

            return isCreated ? (
              <CreatedFileEntry key={i} path={d.path} content={content} />
            ) : (
              <div key={i}>
                <div className="flex items-center gap-2 px-3 py-1 bg-neutral-50 font-mono min-w-0">
                  <span className="text-[11px] text-neutral-600 shrink-0">{fileBasename(d.path)}</span>
                  <span className="text-[10px] text-neutral-300 truncate min-w-0 direction-rtl text-left">{d.path}</span>
                </div>
                <div className="text-xs overflow-x-auto">
                  <DiffViewer
                    oldText={d.oldText}
                    newText={d.newText}
                    language={d.path}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
    </div>
  )
}
