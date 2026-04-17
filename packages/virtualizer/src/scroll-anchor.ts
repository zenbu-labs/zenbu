import type { ScrollAnchor, VirtualItemPosition } from './types'
import { findIndexForOffset } from './binary-search'

export function captureAnchor(
  positions: VirtualItemPosition[],
  scrollOffset: number,
): ScrollAnchor | null {
  if (positions.length === 0) return null

  const index = findIndexForOffset(positions, scrollOffset)
  if (index >= positions.length) return null

  const item = positions[index]
  return {
    anchorKey: item.key,
    offsetFromItemTop: scrollOffset - item.offset,
    anchorIndex: index,
  }
}

export function resolveAnchor(
  anchor: ScrollAnchor,
  positions: VirtualItemPosition[],
  keyToIndex: Map<string, number>,
): number | null {
  const index = keyToIndex.get(anchor.anchorKey)
  if (index === undefined) return null

  const item = positions[index]
  return item.offset + anchor.offsetFromItemTop
}

export function computeScrollAdjustment(
  anchor: ScrollAnchor,
  oldPositions: VirtualItemPosition[],
  newPositions: VirtualItemPosition[],
  keyToNewIndex: Map<string, number>,
): number {
  const newIndex = keyToNewIndex.get(anchor.anchorKey)
  if (newIndex === undefined) return 0

  const oldItem = oldPositions[anchor.anchorIndex]
  if (!oldItem) return 0

  const oldAnchorOffset = oldItem.offset
  const newAnchorOffset = newPositions[newIndex].offset

  return newAnchorOffset - oldAnchorOffset
}
