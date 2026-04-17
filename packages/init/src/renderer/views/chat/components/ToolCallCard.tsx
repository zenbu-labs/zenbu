import { useState } from "react"
import { DiffViewer } from "@zenbu/diffs/react"
import type { ToolCallContentItem } from "../lib/materialize"

const shimmer = "text-shimmer bg-clip-text text-transparent bg-[length:200%_100%] bg-gradient-to-r from-neutral-400 via-neutral-300 to-neutral-400"

function isLoading(status: string) {
  return status !== "completed" && status !== "failed"
}

type Props = {
  title: string
  subtitle: string
  kind: string
  status: string
  contentItems: ToolCallContentItem[]
  rawOutput: unknown
  rawInput?: unknown
  toolName?: string
  toolResponse?: { stdout?: string; stderr?: string } | null
  nested?: boolean
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className="shrink-0 text-neutral-400 opacity-0 group-hover/tool:opacity-100 transition-opacity"
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
  )
}

function fileBasename(p: string): string {
  return p.split("/").pop() ?? p
}

function truncateLines(text: string, max: number): string {
  const lines = text.split("\n")
  if (lines.length <= max) return text
  return lines.slice(0, max).join("\n") + `\n... ${lines.length - max} more lines`
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + "\u2026"
}

function countDiffLines(diffs: (ToolCallContentItem & { type: "diff" })[]) {
  let added = 0
  let removed = 0
  for (const d of diffs) {
    const oldLines = d.oldText ? d.oldText.split("\n") : []
    const newLines = d.newText.split("\n")
    const oldSet = new Set(oldLines)
    const newSet = new Set(newLines)
    for (const line of newLines) {
      if (!oldSet.has(line)) added++
    }
    for (const line of oldLines) {
      if (!newSet.has(line)) removed++
    }
  }
  return { added, removed }
}

function EditCard({ contentItems, title, status }: { contentItems: ToolCallContentItem[]; title: string; status: string }) {
  const [expanded, setExpanded] = useState(false)
  const diffs = contentItems.filter(
    (c): c is ToolCallContentItem & { type: "diff" } => c.type === "diff",
  )

  const paths = [...new Set(diffs.map((d) => d.path))]
  const label = paths.length > 0
    ? paths.map((p) => fileBasename(p)).join(", ")
    : null

  const { added, removed } = countDiffLines(diffs)

  return (
    <div>
      <button
        onClick={() => diffs.length > 0 && setExpanded(!expanded)}
        className={`group/tool flex items-center gap-1.5 py-0.5 text-sm w-full text-left min-w-0 ${diffs.length > 0 ? "cursor-pointer" : ""}`}
      >
        <span className={`shrink-0 ${isLoading(status) ? shimmer : "text-neutral-500"}`}>{status === "completed" ? "Edited" : "Editing"}</span>
        <span className="text-neutral-700 truncate min-w-0">{label}</span>
        {(added > 0 || removed > 0) && (
          <span className="shrink-0 flex items-center gap-0.5">
            {added > 0 && <span className="text-green-600">+{added}</span>}
            {removed > 0 && <span className="text-red-500">-{removed}</span>}
          </span>
        )}
        {diffs.length > 0 && <Chevron expanded={expanded} />}
      </button>
      {expanded && diffs.length > 0 && (
        <div className="mt-1 space-y-1">
          {diffs.map((d, i) => (
            <div key={i} className="rounded border border-neutral-300 overflow-hidden text-xs">
              {paths.length > 1 && (
                <div className="px-2 py-0.5 text-neutral-400 text-[10px] bg-neutral-100/50 font-mono">{d.path}</div>
              )}
              <DiffViewer
                oldText={d.oldText ?? ""}
                newText={d.newText}
                language={d.path}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WriteCard({ rawInput, status }: { rawInput: unknown; status: string }) {
  const input = rawInput as Record<string, any> | null
  const filePath = input?.file_path ?? input?.path ?? ""
  const content = input?.content ?? input?.contents ?? ""
  const lineCount = typeof content === "string" && content ? content.split("\n").length : 0

  return (
    <div>
      <div className="flex items-center gap-1.5 py-0.5 text-sm w-full text-left min-w-0">
        <span className={`shrink-0 ${isLoading(status) ? shimmer : "text-neutral-500"}`}>{status === "completed" ? "Created File" : "Creating File"}</span>
        <span className="text-neutral-700 truncate min-w-0">{fileBasename(filePath)}</span>
        {lineCount > 0 && (
          <span className="shrink-0 text-blue-500">+{lineCount}</span>
        )}
      </div>
    </div>
  )
}

function BashCard({ title, rawInput, toolResponse, status }: {
  title: string
  rawInput: unknown
  toolResponse: { stdout?: string; stderr?: string } | null
  status: string
}) {
  const [expanded, setExpanded] = useState(false)
  const input = rawInput as Record<string, any> | null
  const command = input?.command ?? title
  const bashStatus = status === "failed" ? "completed" : status

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="group/tool flex items-center gap-1.5 py-0.5 text-sm w-full text-left cursor-pointer min-w-0"
      >
        {expanded ? (
          <span className="break-all min-w-0"><span className={isLoading(bashStatus) ? shimmer : "text-neutral-500"}>Bash(</span><span className="text-neutral-700">{command}</span><span className={isLoading(bashStatus) ? shimmer : "text-neutral-500"}>)</span></span>
        ) : (
          <span className="truncate min-w-0"><span className={isLoading(bashStatus) ? shimmer : "text-neutral-500"}>Bash(</span><span className="text-neutral-700">{command}</span><span className={isLoading(bashStatus) ? shimmer : "text-neutral-500"}>)</span></span>
        )}
        <Chevron expanded={expanded} />
      </button>
      {expanded && toolResponse && (toolResponse.stdout || toolResponse.stderr) && (
        <pre className="mt-1 px-2 py-1 text-xs text-neutral-500 bg-neutral-100/50 rounded border border-neutral-200 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
          {toolResponse.stdout || ""}
          {toolResponse.stderr ? `${toolResponse.stdout ? "\n" : ""}${toolResponse.stderr}` : ""}
        </pre>
      )}
    </div>
  )
}

function TaskCard({ title, rawInput, contentItems, status }: {
  title: string
  rawInput: unknown
  contentItems: ToolCallContentItem[]
  status: string
}) {
  const [expanded, setExpanded] = useState(false)
  const input = rawInput as Record<string, any> | null
  const description = input?.description ?? input?.prompt ?? ""
  const promptText = contentItems.find(
    (c): c is ToolCallContentItem & { type: "text" } => c.type === "text",
  )?.text
  const detail = promptText || (typeof description === "string" ? description : "")
  const summary = truncateText(typeof description === "string" ? description : title, 80)

  const isRunning = status !== "completed" && status !== "failed"

  return (
    <div>
      <button
        onClick={() => detail && setExpanded(!expanded)}
        className={`group/tool flex items-center gap-1.5 py-0.5 text-sm w-full text-left ${detail ? "cursor-pointer" : ""}`}
      >
        <span className="break-all">
          <span className={isRunning ? shimmer : "text-neutral-500"}>Task(</span>
          {summary ? (
            <span className="text-neutral-700">{summary}</span>
          ) : (
            <span className={`inline-block align-middle w-24 h-3.5 rounded-sm bg-[length:200%_100%] bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 mx-0.5${isRunning ? " text-shimmer" : ""}`} />
          )}
          <span className={isRunning ? shimmer : "text-neutral-500"}>)</span>
        </span>
        {detail && <Chevron expanded={expanded} />}
      </button>
      {expanded && detail && (
        <pre className="mt-1 px-2 py-1 text-xs text-neutral-500 bg-neutral-100/50 rounded border border-neutral-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
          {truncateLines(detail, 30)}
        </pre>
      )}
    </div>
  )
}

function ReadCard({ title, rawInput, status }: { title: string; rawInput: unknown; status: string }) {
  const [expanded, setExpanded] = useState(false)
  const input = rawInput as Record<string, any> | null
  const cleanTitle = title.replace(/\s*\([\d\s\-–,]+\)\s*$/, "")
  const startLine = input?.offset ?? input?.start_line ?? input?.startLine
  const endLine = input?.limit != null && startLine != null
    ? startLine + input.limit
    : input?.end_line ?? input?.endLine
  const range = startLine != null
    ? endLine != null ? ` ${startLine}-${endLine}` : ` ${startLine}`
    : ""

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 py-0.5 text-sm w-full text-left cursor-pointer min-w-0"
      >
        <span className={`shrink-0 ${isLoading(status) ? shimmer : "text-neutral-500"}`}>Read</span>
        {expanded ? (
          <span className="break-all min-w-0"><span className="text-neutral-700">{cleanTitle}</span>{range && <span className="text-neutral-400">{range}</span>}</span>
        ) : (
          <span className="truncate min-w-0"><span className="text-neutral-700">{cleanTitle}</span>{range && <span className="text-neutral-400">{range}</span>}</span>
        )}
      </button>
    </div>
  )
}

function SearchCard({ title, rawOutput, status }: { title: string; rawOutput: unknown; status: string }) {
  const [expanded, setExpanded] = useState(false)
  const out = rawOutput as Record<string, any> | null
  const matchCount = out?.totalMatches ?? out?.totalFiles

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 py-0.5 text-sm w-full text-left cursor-pointer min-w-0"
      >
        {expanded ? (
          <span className={`break-all min-w-0 ${isLoading(status) ? shimmer : "text-neutral-700"}`}>{title}</span>
        ) : (
          <span className={`truncate min-w-0 ${isLoading(status) ? shimmer : "text-neutral-700"}`}>{title}</span>
        )}
      </button>
    </div>
  )
}

function DefaultCard({ title, status }: { title: string; status: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 py-0.5 text-sm w-full text-left cursor-pointer min-w-0"
      >
        {expanded ? (
          <span className={`break-all min-w-0 ${isLoading(status) ? shimmer : "text-neutral-700"}`}>{title}</span>
        ) : (
          <span className={`truncate min-w-0 ${isLoading(status) ? shimmer : "text-neutral-700"}`}>{title}</span>
        )}
      </button>
    </div>
  )
}

export function ToolCallCard({
  title,
  subtitle,
  kind,
  status,
  contentItems,
  rawOutput,
  rawInput,
  toolName,
  toolResponse,
  nested,
}: Props) {
  const resolvedKind = kind || "other"
  const name = (toolName ?? "").toLowerCase()
  const isTask = resolvedKind === "think" || name === "agent"
  const isBash = resolvedKind === "execute" || name === "bash"
  const isEdit = resolvedKind === "edit" || name === "edit" || resolvedKind === "edit_file"
  const isWrite = name === "write" || resolvedKind === "create"
  const isRead = resolvedKind === "read" || name === "read"
  const isSearch = resolvedKind === "search" || name === "grep" || name === "glob"

  const wrap = (el: React.ReactNode) => (
    <div className={nested ? "pl-4 border-l border-neutral-300" : ""}>{el}</div>
  )

  if (isWrite) return wrap(<WriteCard rawInput={rawInput} status={status} />)
  if (isEdit) return wrap(<EditCard contentItems={contentItems} title={title} status={status} />)
  if (isBash) return wrap(<BashCard title={title} rawInput={rawInput} toolResponse={toolResponse ?? null} status={status} />)
  if (isTask) return wrap(<TaskCard title={title} rawInput={rawInput} contentItems={contentItems} status={status} />)
  if (isRead) return wrap(<ReadCard title={title} rawInput={rawInput} status={status} />)
  if (isSearch) return wrap(<SearchCard title={title} rawOutput={rawOutput} status={status} />)

  return wrap(<DefaultCard title={title} status={status} />)
}
