import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type RefObject,
} from "react"

type MatchInfo = {
  range: Range
  index: number
}

export function FindInChat({
  scrollRef,
  contentVersion,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  contentVersion?: unknown
}) {
  const [open, setOpen] = useState(false)
  const [multiLine, setMultiLine] = useState(false)
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<MatchInfo[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const matchesRef = useRef(matches)
  matchesRef.current = matches

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      if (multiLine) {
        const ta = textareaRef.current
        if (ta) {
          ta.focus()
          ta.selectionStart = ta.selectionEnd = ta.value.length
        }
      } else {
        inputRef.current?.focus()
      }
    })
  }, [multiLine])

  const close = useCallback(() => {
    setOpen(false)
    setMultiLine(false)
    setQuery("")
    setMatches([])
    setCurrentIndex(0)
    CSS.highlights?.delete("find-matches")
    CSS.highlights?.delete("find-current")
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault()
        setOpen(true)
        setMultiLine(true)
        requestAnimationFrame(() => textareaRef.current?.focus())
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault()
        setOpen(true)
        focusInput()
      }
      if (e.key === "Escape" && open) {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, close, focusInput])

  const search = useCallback(
    (q: string) => {
      CSS.highlights?.delete("find-matches")
      CSS.highlights?.delete("find-current")

      if (!q || !scrollRef.current) {
        setMatches([])
        setCurrentIndex(0)
        return
      }

      const container = scrollRef.current
      const lower = q.toLowerCase()
      const found: MatchInfo[] = []
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
      )

      let node: Text | null
      while ((node = walker.nextNode() as Text | null)) {
        const text = node.textContent?.toLowerCase() ?? ""
        let start = 0
        while (true) {
          const idx = text.indexOf(lower, start)
          if (idx === -1) break
          const range = document.createRange()
          range.setStart(node, idx)
          range.setEnd(node, idx + q.length)
          found.push({ range, index: found.length })
          start = idx + 1
        }
      }

      setMatches(found)
      setCurrentIndex(found.length > 0 ? 0 : -1)

      if (found.length > 0 && CSS.highlights) {
        const allRanges = found.map((m) => m.range)
        CSS.highlights.set("find-matches", new Highlight(...allRanges))
        CSS.highlights.set("find-current", new Highlight(found[0].range))
      }
    },
    [scrollRef],
  )

  useEffect(() => {
    if (!open || multiLine) {
      CSS.highlights?.delete("find-matches")
      CSS.highlights?.delete("find-current")
      if (multiLine) {
        setMatches([])
        setCurrentIndex(0)
      }
      return
    }
    search(query)
  }, [query, open, multiLine, search, contentVersion])

  const scrollToMatch = useCallback(
    (idx: number) => {
      const match = matchesRef.current[idx]
      if (!match || !scrollRef.current) return

      const rect = match.range.getBoundingClientRect()
      const containerRect = scrollRef.current.getBoundingClientRect()
      const relativeTop =
        rect.top - containerRect.top + scrollRef.current.scrollTop
      scrollRef.current.scrollTo({
        top: relativeTop - containerRect.height / 3,
        behavior: "instant",
      })
    },
    [scrollRef],
  )

  const goTo = useCallback(
    (idx: number) => {
      if (matches.length === 0) return
      const wrapped = ((idx % matches.length) + matches.length) % matches.length
      setCurrentIndex(wrapped)

      if (CSS.highlights) {
        CSS.highlights.set(
          "find-current",
          new Highlight(matches[wrapped].range),
        )
      }
      scrollToMatch(wrapped)
    },
    [matches, scrollToMatch],
  )

  const next = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex])
  const prev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex])

  useEffect(() => {
    if (matches.length > 0 && currentIndex === 0) {
      scrollToMatch(0)
    }
  }, [matches, currentIndex, scrollToMatch])

  useEffect(() => {
    if (!open) return
    focusInput()
  }, [multiLine, open, focusInput])

  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "0"
    ta.style.height = ta.scrollHeight + "px"
  }, [])

  useEffect(() => {
    if (multiLine) autoResize()
  }, [query, multiLine, autoResize])

  if (!open) return null

  const sharedKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault()
      setMultiLine((v) => !v)
      return
    }
    if (e.key === "Enter" && e.shiftKey && !multiLine) {
      e.preventDefault()
      setMultiLine(true)
      setQuery((q) => q + "\n")
      return
    }
    if (e.key === "Enter" && !e.shiftKey && !multiLine) {
      e.preventDefault()
      next()
    }
  }

  return (
    <div className="absolute top-2 right-6 z-50 w-[340px]">
      <div
        className="rounded p-px"
        style={
          multiLine
            ? {
                background:
                  "conic-gradient(from 0deg, #ff0000, #ffa500, #ffff00, #00ff00, #0096ff, #8200ff, #ff0000)",
              }
            : undefined
        }
      >
        <div
          className={`flex flex-col gap-1.5 rounded bg-white shadow-xl ${multiLine ? "" : "border border-neutral-300"}`}
        >
          <div className="flex items-start gap-1.5 px-3 py-1.5">
            {multiLine ? (
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={sharedKeyDown}
                placeholder="Ask a question…"
                rows={1}
                className="min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
                autoFocus
              />
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={sharedKeyDown}
                placeholder="Find in chat…"
                className="min-w-0 flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
                autoFocus
              />
            )}

            {!multiLine && (
              <div className="flex shrink-0 items-center gap-1">
                <span className="w-16 text-right text-xs text-neutral-500 tabular-nums whitespace-nowrap">
                  {query
                    ? matches.length > 0
                      ? `${currentIndex + 1} of ${matches.length}`
                      : "0 results"
                    : ""}
                </span>

                <button
                  onClick={prev}
                  disabled={matches.length === 0}
                  className="rounded p-0.5 text-neutral-500 hover:text-neutral-800 disabled:opacity-30"
                  aria-label="Previous match"
                >
                  <ChevronUp />
                </button>
                <button
                  onClick={next}
                  disabled={matches.length === 0}
                  className="rounded p-0.5 text-neutral-500 hover:text-neutral-800 disabled:opacity-30"
                  aria-label="Next match"
                >
                  <ChevronDown />
                </button>
                <button
                  onClick={close}
                  className="rounded p-0.5 text-neutral-500 hover:text-neutral-800"
                  aria-label="Close find"
                >
                  <XIcon />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ChevronUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 10L8 6L12 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
