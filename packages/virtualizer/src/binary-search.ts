import type { VirtualItemPosition } from './types'

export function findIndexForOffset(
  positions: VirtualItemPosition[],
  targetOffset: number,
): number {
  if (positions.length === 0) return 0

  let lo = 0
  let hi = positions.length - 1

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const item = positions[mid]

    if (item.offset + item.size <= targetOffset) {
      lo = mid + 1
    } else if (item.offset > targetOffset) {
      hi = mid - 1
    } else {
      return mid
    }
  }

  return Math.min(lo, positions.length - 1)
}

export function computeVisibleRange(
  positions: VirtualItemPosition[],
  scrollOffset: number,
  containerHeight: number,
  overscan: number,
): [number, number] {
  if (positions.length === 0) return [0, 0]

  const startVisible = findIndexForOffset(positions, scrollOffset)
  const endVisible = findIndexForOffset(positions, scrollOffset + containerHeight)

  const startIndex = Math.max(0, startVisible - overscan)
  const endIndex = Math.min(positions.length - 1, endVisible + overscan)

  return [startIndex, endIndex]
}

export function computeRenderedRange(
  positions: VirtualItemPosition[],
  scrollOffset: number,
  containerHeight: number,
  overscanPx: number,
  retainOverscanPx: number,
  previousRange: [number, number] | null,
): [number, number] {
  if (positions.length === 0) return [0, 0]

  const desiredStart = findIndexForOffset(
    positions,
    Math.max(0, scrollOffset - overscanPx),
  )
  const desiredEnd = findIndexForOffset(
    positions,
    scrollOffset + containerHeight + overscanPx,
  )

  if (!previousRange) {
    return [desiredStart, desiredEnd]
  }

  let start = Math.min(Math.max(0, previousRange[0]), positions.length - 1)
  let end = Math.min(Math.max(0, previousRange[1]), positions.length - 1)

  if (end < start) {
    return [desiredStart, desiredEnd]
  }

  start = Math.min(start, desiredStart)
  end = Math.max(end, desiredEnd)

  const releaseTop = Math.max(0, scrollOffset - overscanPx - retainOverscanPx)
  const releaseBottom = scrollOffset + containerHeight + overscanPx + retainOverscanPx

  while (start < desiredStart) {
    const item = positions[start]
    if (item.offset + item.size > releaseTop) break
    start += 1
  }

  while (end > desiredEnd) {
    const item = positions[end]
    if (item.offset < releaseBottom) break
    end -= 1
  }

  return [start, end]
}
