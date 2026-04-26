import { useEffect, useRef, useState } from "react"

type ReloadMode = "continue" | "keep-alive"

type ReloadMenuItem = {
  id: string
  label: string
  run: () => void | Promise<void>
}

export function ReloadMenu({
  open,
  anchorEl,
  reloadMode,
  onReloadAgent,
  onToggleHotReload,
  onClose,
}: {
  open: boolean
  anchorEl: HTMLElement | null
  reloadMode: ReloadMode
  onReloadAgent: () => void | Promise<void>
  onToggleHotReload: () => void | Promise<void>
  onClose: () => void
}) {
  const [highlighted, setHighlighted] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const hotReloadEnabled = reloadMode === "keep-alive"
  const items: ReloadMenuItem[] = [
    {
      id: "reload",
      label: "Reload agent",
      run: onReloadAgent,
    },
    {
      id: "toggle-hot",
      label: hotReloadEnabled
        ? "Disable agent hot reloading"
        : "Enable agent hot reloading",
      run: onToggleHotReload,
    },
  ]

  useEffect(() => {
    if (!open) return
    setHighlighted(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        e.stopPropagation()
        setHighlighted((i) => (i + 1) % items.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        e.stopPropagation()
        setHighlighted((i) => (i - 1 + items.length) % items.length)
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        e.stopPropagation()
        const item = items[highlighted]
        if (item) {
          Promise.resolve(item.run()).finally(onClose)
        }
        return
      }
    }
    window.addEventListener("keydown", handler, true)
    return () => window.removeEventListener("keydown", handler, true)
  }, [open, highlighted, items, onClose])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const root = rootRef.current
      if (!root) return
      if (root.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener("mousedown", onClick, true)
    return () => window.removeEventListener("mousedown", onClick, true)
  }, [open, onClose])

  if (!open || !anchorEl) return null

  return (
    <div
      ref={rootRef}
      style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 16 }}
      className="z-50 min-w-[240px] max-w-[340px] overflow-hidden rounded-sm border border-border bg-popover text-popover-foreground shadow-xl"
    >
      <div className="max-h-[240px] overflow-y-auto p-0.5">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={highlighted === i}
            className={`flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left text-xs rounded-[2px] ${
              highlighted === i
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            onMouseEnter={() => setHighlighted(i)}
            onClick={() => {
              Promise.resolve(item.run()).finally(onClose)
            }}
          >
            <span className="truncate font-normal">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
