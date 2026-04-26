import { type RefObject } from "react"
import { createPortal } from "react-dom"
import type { FileMenuOption } from "../plugins/FilePickerPlugin"

export function FilePickerMenu({
  anchorElementRef,
  options,
  selectedIndex,
  selectOptionAndCleanUp,
  setHighlightedIndex,
}: {
  anchorElementRef: RefObject<HTMLElement | null>
  options: FileMenuOption[]
  selectedIndex: number | null
  selectOptionAndCleanUp: (option: FileMenuOption) => void
  setHighlightedIndex: (index: number) => void
}) {
  const anchor = anchorElementRef.current
  if (!anchor || options.length === 0) return null

  return createPortal(
    <div
      style={{ position: "absolute", bottom: "calc(100% + 20px)", left: 16 }}
      className="z-50 min-w-[200px] max-w-[320px] overflow-hidden rounded-sm border border-border bg-popover text-popover-foreground shadow-xl"
    >
      <div className="max-h-[240px] overflow-y-auto p-0.5">
        {options.map((option, i) => (
          <button
            key={option.key}
            ref={(el) => option.setRefElement(el)}
            type="button"
            role="option"
            aria-selected={selectedIndex === i}
            className={`flex w-full items-center px-2 py-1 text-left text-xs rounded-[2px] ${
              selectedIndex === i
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            onMouseEnter={() => setHighlightedIndex(i)}
            onClick={() => selectOptionAndCleanUp(option)}
          >
            <span className="truncate font-normal">{option.data.name}</span>
          </button>
        ))}
      </div>
    </div>,
    anchor,
  )
}
