import { type RefObject } from "react"
import { createPortal } from "react-dom"
import type { SlashMenuOption } from "./slash-menu-option"

export function SlashCommandMenu({
  anchorElementRef,
  options,
  selectedIndex,
  selectOptionAndCleanUp,
  setHighlightedIndex,
}: {
  anchorElementRef: RefObject<HTMLElement | null>
  options: SlashMenuOption[]
  selectedIndex: number | null
  selectOptionAndCleanUp: (option: SlashMenuOption) => void
  setHighlightedIndex: (index: number) => void
}) {
  const anchor = anchorElementRef.current
  if (!anchor || options.length === 0) return null

  return createPortal(
    <div
      style={{ position: "absolute", bottom: "calc(100% + 20px)", left: 16 }}
      className="z-50 min-w-[220px] max-w-[340px] overflow-hidden rounded-sm border border-border bg-popover text-popover-foreground shadow-xl"
    >
      <div className="max-h-[240px] overflow-y-auto p-0.5">
        {options.map((option, i) => (
          <button
            key={option.key}
            ref={(el) => option.setRefElement(el)}
            type="button"
            role="option"
            aria-selected={selectedIndex === i}
            className={`flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left text-xs rounded-[2px] ${
              selectedIndex === i
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            onMouseEnter={() => setHighlightedIndex(i)}
            onClick={() => selectOptionAndCleanUp(option)}
          >
            <span className="truncate font-normal">{option.data.label}</span>
          </button>
        ))}
      </div>
    </div>,
    anchor,
  )
}
