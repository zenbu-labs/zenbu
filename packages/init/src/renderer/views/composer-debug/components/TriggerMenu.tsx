import { type RefObject } from "react"
import { createPortal } from "react-dom"
import type { PillOption } from "../plugins/TriggerMenuPlugin"

export function TriggerMenuComponent({
  anchorElementRef,
  options,
  selectedIndex,
  selectOptionAndCleanUp,
  setHighlightedIndex,
}: {
  anchorElementRef: RefObject<HTMLElement | null>
  options: PillOption[]
  selectedIndex: number | null
  selectOptionAndCleanUp: (option: PillOption) => void
  setHighlightedIndex: (index: number) => void
}) {
  const anchor = anchorElementRef.current
  if (!anchor || options.length === 0) return null

  return createPortal(
    <div className="z-50 min-w-[180px] max-w-[320px] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
      <div className="max-h-[240px] overflow-y-auto py-1">
        {options.map((option, i) => (
          <button
            key={option.key}
            ref={(el) => option.setRefElement(el)}
            type="button"
            role="option"
            aria-selected={selectedIndex === i}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
              selectedIndex === i
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-50"
            }`}
            onMouseEnter={() => setHighlightedIndex(i)}
            onClick={() => selectOptionAndCleanUp(option)}
          >
            <KindDot kind={option.data.kind} />
            <span className="truncate font-medium">{option.data.label}</span>
            {typeof option.data.payload.description === "string" ? (
              <span className="ml-auto truncate text-[10px] text-neutral-400">
                {option.data.payload.description}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>,
    anchor,
  )
}

function KindDot({ kind }: { kind: string }) {
  const colorMap: Record<string, string> = {
    file: "bg-blue-400",
    command: "bg-amber-400",
    symbol: "bg-purple-400",
    url: "bg-green-400",
    mention: "bg-sky-400",
  }
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${colorMap[kind] ?? "bg-neutral-400"}`}
    />
  )
}
