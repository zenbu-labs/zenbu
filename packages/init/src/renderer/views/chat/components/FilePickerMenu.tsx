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
      className="z-50 min-w-[200px] max-w-[320px] overflow-hidden rounded-sm border border-neutral-300 bg-white shadow-xl"
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
                ? "bg-neutral-100 text-neutral-800"
                : "text-neutral-500 hover:bg-neutral-100"
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
