import { useState, useEffect, useRef, useCallback } from "react"
import { useRpc } from "../../lib/ws-connection"
import { Htop } from "./Htop"

type OutputLine = {
  text: string
  style?: "error" | "success" | "info" | "dim" | "warn" | "header"
}

type HistoryEntry =
  | { kind: "cmd"; text: string }
  | { kind: "output"; lines: OutputLine[]; exitCode: number }

const STYLE_CLASSES: Record<string, string> = {
  error: "text-red-400",
  success: "text-green-400",
  info: "text-blue-400",
  dim: "text-neutral-500",
  warn: "text-amber-400",
  header: "text-cyan-400",
}

function OutputLineView({ line }: { line: OutputLine }) {
  const cls = line.style ? STYLE_CLASSES[line.style] : "text-neutral-300"
  return (
    <div className={`whitespace-pre-wrap break-all ${cls}`}>
      {line.text || "\u00A0"}
    </div>
  )
}

export function Terminal() {
  const rpc = useRpc()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<"terminal" | "htop">("terminal")

  const cmdHistoryRef = useRef<string[]>([])
  const historyIdxRef = useRef(-1)
  const savedInputRef = useRef("")

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 
  useEffect(() => {
    rpc["view-shell"]
      .banner()
      .then((b: any) => {
        setHistory([{ kind: "output", lines: b.lines, exitCode: 0 }])
      })
      .catch(() => {})
  }, [rpc])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history])

  const submit = useCallback(async () => {
    const cmd = input.trim()
    if (!cmd || busy) return

    setInput("")
    historyIdxRef.current = -1
    savedInputRef.current = ""
    cmdHistoryRef.current = [cmd, ...cmdHistoryRef.current.slice(0, 200)]
    setHistory((h) => [...h, { kind: "cmd", text: cmd }])

    if (cmd === "clear") {
      setHistory([])
      return
    }

    if (cmd === "htop") {
      setMode("htop")
      return
    }

    setBusy(true)
    try {
      const result: { lines: OutputLine[]; exitCode: number } =
        await rpc["view-shell"].exec(cmd)
      setHistory((h) => [
        ...h,
        { kind: "output", lines: result.lines, exitCode: result.exitCode },
      ])
    } catch (e: any) {
      setHistory((h) => [
        ...h,
        {
          kind: "output",
          lines: [{ text: String(e), style: "error" as const }],
          exitCode: 1,
        },
      ])
    } finally {
      setBusy(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [input, busy, rpc])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        submit()
        return
      }

      if (e.key === "ArrowUp") {
        e.preventDefault()
        const cmds = cmdHistoryRef.current
        if (cmds.length === 0) return

        if (historyIdxRef.current === -1) {
          savedInputRef.current = input
        }
        const next = Math.min(historyIdxRef.current + 1, cmds.length - 1)
        historyIdxRef.current = next
        setInput(cmds[next]!)
        return
      }

      if (e.key === "ArrowDown") {
        e.preventDefault()
        if (historyIdxRef.current <= 0) {
          historyIdxRef.current = -1
          setInput(savedInputRef.current)
          return
        }
        const next = historyIdxRef.current - 1
        historyIdxRef.current = next
        setInput(cmdHistoryRef.current[next]!)
        return
      }

      if (e.key === "l" && e.ctrlKey) {
        e.preventDefault()
        setHistory([])
        return
      }

      if (e.key === "c" && e.ctrlKey) {
        if (input) {
          setHistory((h) => [...h, { kind: "cmd", text: input + "^C" }])
        }
        setInput("")
        setBusy(false)
        return
      }
    },
    [input, submit],
  )

  if (mode === "htop") {
    return (
      <Htop
        onExit={() => {
          setMode("terminal")
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
      />
    )
  }

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto overflow-x-hidden bg-[#0a0a0a] px-3 pt-2 pb-3 font-mono text-[13px] leading-[1.45] select-text"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "#333 transparent",
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {history.map((entry, i) => {
        if (entry.kind === "cmd") {
          return (
            <div key={i} className="flex gap-2 mt-1">
              <span className="text-white select-none shrink-0">$</span>
              <span className="text-neutral-200">{entry.text}</span>
            </div>
          )
        }
        return (
          <div key={i} className="mb-0.5">
            {entry.lines.map((line, j) => (
              <OutputLineView key={j} line={line} />
            ))}
          </div>
        )
      })}

      <div className="flex items-center gap-2 mt-1">
        <span className="text-white select-none shrink-0">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            historyIdxRef.current = -1
          }}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent text-neutral-200 outline-none caret-white placeholder:text-neutral-700"
          placeholder={busy ? "running…" : ""}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          disabled={busy}
        />
        {busy && (
          <span className="text-neutral-600 animate-pulse select-none">●</span>
        )}
      </div>
    </div>
  )
}
