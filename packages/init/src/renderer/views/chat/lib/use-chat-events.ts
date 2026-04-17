import { useMemo, useState, useCallback } from "react"
import type { ScrollSnapshot } from "./use-auto-scroll"

export type WindowedRange = {
  start: number | null
  end: number | null
}

interface UseWindowedItemsOptions<T> {
  items: T[]
  initialWindow?: number
  batchSize?: number
}

interface UseWindowedItemsResult<T> {
  items: T[]
  hasMoreBefore: boolean
  hasMoreAfter: boolean
  loadOlder: (captureSnapshot: () => ScrollSnapshot | null) => void
  loadNewer: () => void
  freezeTail: () => void
  resumeTail: () => void
  totalCount: number
}

const LIVE_WINDOW: WindowedRange = { start: null, end: null }

export function getWindowedRange(
  total: number,
  initialWindow: number,
  window: WindowedRange,
) {
  const end = window.end === null ? total : Math.max(0, Math.min(window.end, total))
  const start = window.start === null
    ? Math.max(0, end - initialWindow)
    : Math.max(0, Math.min(window.start, end))

  return { start, end }
}

export function freezeWindow(
  total: number,
  initialWindow: number,
  window: WindowedRange,
): WindowedRange {
  return getWindowedRange(total, initialWindow, window)
}

export function loadOlderWindow(
  total: number,
  initialWindow: number,
  batchSize: number,
  window: WindowedRange,
): WindowedRange {
  const current = getWindowedRange(total, initialWindow, window)
  return {
    start: Math.max(0, current.start - batchSize),
    end: current.end,
  }
}

export function loadNewerWindow(
  total: number,
  initialWindow: number,
  batchSize: number,
  window: WindowedRange,
): WindowedRange {
  const current = getWindowedRange(total, initialWindow, window)
  return {
    start: current.start,
    end: Math.min(total, current.end + batchSize),
  }
}

export function useWindowedItems<T>({
  items,
  initialWindow = 200,
  batchSize = 100,
}: UseWindowedItemsOptions<T>): UseWindowedItemsResult<T> {
  const [window, setWindow] = useState<WindowedRange>(LIVE_WINDOW)

  const range = useMemo(
    () => getWindowedRange(items.length, initialWindow, window),
    [items.length, initialWindow, window],
  )

  const visibleItems = useMemo(
    () => items.slice(range.start, range.end),
    [items, range.end, range.start],
  )

  const hasMoreBefore = range.start > 0
  const hasMoreAfter = range.end < items.length

  const freezeTail = useCallback(() => {
    setWindow(prev => freezeWindow(items.length, initialWindow, prev))
  }, [initialWindow, items.length])

  const resumeTail = useCallback(() => {
    setWindow(prev => {
      if (prev.start === null && prev.end === null) return prev
      return LIVE_WINDOW
    })
  }, [])

  const loadOlder = useCallback((captureSnapshot: () => ScrollSnapshot | null) => {
    if (!hasMoreBefore) return
    captureSnapshot()
    setWindow(prev => loadOlderWindow(items.length, initialWindow, batchSize, prev))
  }, [batchSize, hasMoreBefore, initialWindow, items.length])

  const loadNewer = useCallback(() => {
    if (!hasMoreAfter) return
    setWindow(prev => loadNewerWindow(items.length, initialWindow, batchSize, prev))
  }, [batchSize, hasMoreAfter, initialWindow, items.length])

  return {
    items: visibleItems,
    hasMoreBefore,
    hasMoreAfter,
    loadOlder,
    loadNewer,
    freezeTail,
    resumeTail,
    totalCount: items.length,
  }
}
