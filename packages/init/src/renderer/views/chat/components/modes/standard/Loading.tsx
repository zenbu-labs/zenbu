import { useState, useEffect, useRef } from "react"
import type { MaterializedMessage } from "../../../lib/materialize"

function countWords(s: string): number {
  const trimmed = s.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function countToolTokens(tool: import("../../../lib/materialize").ToolMessageData): number {
  let count = 0
  count += countWords(tool.title)
  count += countWords(tool.subtitle)
  if (tool.rawInput != null) count += countWords(JSON.stringify(tool.rawInput))
  if (tool.rawOutput != null) count += countWords(JSON.stringify(tool.rawOutput))
  if (tool.toolResponse) {
    if (tool.toolResponse.stdout) count += countWords(tool.toolResponse.stdout)
    if (tool.toolResponse.stderr) count += countWords(tool.toolResponse.stderr)
  }
  for (const child of tool.children) count += countToolTokens(child)
  return count
}

function naiveModelTokens(messages: MaterializedMessage[]): number {
  let lastUserIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserIdx = i; break }
  }
  let count = 0
  for (let i = lastUserIdx + 1; i < messages.length; i++) {
    const msg = messages[i]
    if ("content" in msg && typeof msg.content === "string") {
      count += countWords(msg.content)
    }
    if (msg.role === "tool") {
      count += countToolTokens(msg)
    }
  }
  return count
}

function getLastUserMessageTimestamp(messages: MaterializedMessage[]): number | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === "user" && msg.timeSent) return msg.timeSent
  }
  return null
}

function useElapsed(startTimestamp: number | null) {
  const [elapsed, setElapsed] = useState(() =>
    startTimestamp ? Math.floor((Date.now() - startTimestamp) / 1000) : 0,
  )
  const tsRef = useRef(startTimestamp)
  tsRef.current = startTimestamp

  useEffect(() => {
    if (tsRef.current == null) return
    const tick = () => setElapsed(Math.floor((Date.now() - tsRef.current!) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTimestamp])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

export function Loading({ messages }: { messages: MaterializedMessage[] }) {
  const tokens = naiveModelTokens(messages)
  const turnStart = getLastUserMessageTimestamp(messages)
  const time = useElapsed(turnStart)
  return (
    <div className="py-2 flex items-center gap-2 px-3">
      <span className="text-shimmer bg-clip-text text-transparent bg-[length:200%_100%] bg-gradient-to-r from-neutral-400 via-neutral-300 to-neutral-400 text-sm font-medium">
        {time},&nbsp; {tokens.toLocaleString()} Tokens
      </span>
    </div>
  )
}
