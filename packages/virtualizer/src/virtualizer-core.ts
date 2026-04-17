import type {
  MaterializedItem,
  VirtualItemPosition,
  ScrollState,
  ScrollEvent,
  ViewportSnapshot,
} from './types'
import type { MeasurementCacheImpl } from './measurement-cache'
import { computeRenderedRange, computeVisibleRange } from './binary-search'
import { captureAnchor, computeScrollAdjustment } from './scroll-anchor'
import { assertPositionConsistency, assertMaterializedItems } from './invariants'

export class VirtualizerCore<TView> {
  private positions: VirtualItemPosition[] = []
  private keyToIndex = new Map<string, number>()
  private containerHeight = 0
  private scrollOffset = 0
  private _scrollState: ScrollState = { type: 'locked-to-bottom' }
  private _visibleRange: [number, number] = [0, 0]
  private _renderedRange: [number, number] = [0, 0]

  constructor(
    private measurementCache: MeasurementCacheImpl,
    private estimateHeight: number | ((item: MaterializedItem<TView>) => number),
    private overscan: number,
    private overscanPx: number | null,
    private retainOverscanPx: number | null,
    private bottomThreshold: number,
  ) {}

  get scrollState(): ScrollState {
    return this._scrollState
  }

  set scrollState(state: ScrollState) {
    this._scrollState = state
  }

  setEstimateHeight(
    estimateHeight: number | ((item: MaterializedItem<TView>) => number),
  ): void {
    this.estimateHeight = estimateHeight
  }

  get visibleRange(): [number, number] {
    return this._visibleRange
  }

  get renderedRange(): [number, number] {
    return this._renderedRange
  }

  recomputePositions(
    items: MaterializedItem<TView>[],
  ): { positions: VirtualItemPosition[]; scrollAdjustment: number } {
    assertMaterializedItems(items, 'VirtualizerCore.recomputePositions input')
    const oldPositions = this.positions
    const newPositions: VirtualItemPosition[] = []
    const newKeyToIndex = new Map<string, number>()
    let cumulativeOffset = 0

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const cached = this.measurementCache.get(item.cacheKey)
      let size: number
      let wasMeasured = !!cached
      if (cached) {
        size = cached.height
      } else {
        // On cache miss (e.g. cacheKey changed when streaming ended),
        // carry forward the previous measured size for this key to avoid
        // falling back to a generic estimate that can be 40-80px off.
        const prevIndex = this.keyToIndex.get(item.key)
        const prevPos = prevIndex !== undefined ? oldPositions[prevIndex] : undefined
        if (prevPos?.measured) {
          size = prevPos.size
          // Promote to cache so the value persists across multiple
          // recomputePositions calls. Without this, the second call sees
          // measured:false and falls back to estimateHeight(), causing
          // scrollAdjustment fights (rubber-band scroll on scroll-down).
          this.measurementCache.set(item.cacheKey, { height: size, measuredAt: Date.now() })
          wasMeasured = true
        } else {
          size = typeof this.estimateHeight === 'function'
            ? this.estimateHeight(item)
            : this.estimateHeight
        }
      }

      newPositions.push({
        index: i,
        key: item.key,
        cacheKey: item.cacheKey,
        offset: cumulativeOffset,
        size,
        measured: wasMeasured,
      })

      newKeyToIndex.set(item.key, i)
      cumulativeOffset += size
    }

    let scrollAdjustment = 0
    if (this._scrollState.type === 'free-scroll' && this._scrollState.anchor) {
      scrollAdjustment = computeScrollAdjustment(
        this._scrollState.anchor,
        oldPositions,
        newPositions,
        newKeyToIndex,
      )
    }

    this.positions = newPositions
    this.keyToIndex = newKeyToIndex
    assertPositionConsistency(newPositions, 'VirtualizerCore.recomputePositions output')

    return { positions: newPositions, scrollAdjustment }
  }

  getVirtualItems(): VirtualItemPosition[] {
    const effectiveOverscanPx = this.overscanPx ?? Math.max(1200, this.containerHeight * 1.5)
    const effectiveRetainOverscanPx = this.retainOverscanPx ?? Math.max(
      effectiveOverscanPx,
      this.containerHeight * 2,
    )
    const [start, end] = this.overscanPx !== null
      ? computeRenderedRange(
          this.positions,
          this.scrollOffset,
          this.containerHeight,
          effectiveOverscanPx,
          effectiveRetainOverscanPx,
          this._renderedRange,
        )
      : computeVisibleRange(
          this.positions,
          this.scrollOffset,
          this.containerHeight,
          this.overscan,
        )
    this._visibleRange = computeVisibleRange(
      this.positions,
      this.scrollOffset,
      this.containerHeight,
      0,
    )
    this._renderedRange = [start, end]
    return this.positions.slice(start, end + 1)
  }

  getTotalSize(): number {
    if (this.positions.length === 0) return 0
    const last = this.positions[this.positions.length - 1]
    return last.offset + last.size
  }

  getPositions(): VirtualItemPosition[] {
    return this.positions
  }

  getKeyToIndex(): Map<string, number> {
    return this.keyToIndex
  }

  handleScroll(newOffset: number, containerHeight: number): ScrollEvent | null {
    const prevOffset = this.scrollOffset
    this.scrollOffset = newOffset
    this.containerHeight = containerHeight

    const totalSize = this.getTotalSize()
    const isAtBottom = totalSize - (newOffset + containerHeight) <= this.bottomThreshold

    if (this._scrollState.type === 'free-scroll') {
      if (isAtBottom && newOffset >= prevOffset) {
        return { type: 'USER_SCROLL_TO_BOTTOM' }
      }
      const anchor = captureAnchor(this.positions, newOffset)
      if (anchor) {
        return { type: 'ANCHOR_ESTABLISHED', anchor }
      }
    }

    return null
  }

  handleMeasurement(key: string, cacheKey: string, height: number): number {
    this.measurementCache.set(cacheKey, { height, measuredAt: Date.now() })

    const index = this.keyToIndex.get(key)
    if (index === undefined) return 0

    const oldSize = this.positions[index].size
    if (Math.abs(oldSize - height) < 0.5) return 0

    const delta = height - oldSize
    this.positions[index].size = height
    this.positions[index].measured = true

    for (let i = index + 1; i < this.positions.length; i++) {
      this.positions[i].offset += delta
    }

    if (
      this._scrollState.type === 'free-scroll' &&
      this.positions[index].offset < this.scrollOffset
    ) {
      return delta
    }

    return 0
  }

  setScrollOffset(offset: number): void {
    this.scrollOffset = offset
  }

  setContainerHeight(height: number): void {
    this.containerHeight = height
  }

  getScrollOffset(): number {
    return this.scrollOffset
  }

  getContainerHeight(): number {
    return this.containerHeight
  }

  captureSnapshot(): ViewportSnapshot {
    const [start, end] = this._renderedRange
    const items = this.positions.slice(start, end + 1).map(p => ({
      key: p.key,
      cacheKey: p.cacheKey,
      index: p.index,
      offset: p.offset,
      size: p.size,
    }))

    return {
      scrollTop: this.scrollOffset,
      totalHeight: this.getTotalSize(),
      containerHeight: this.containerHeight,
      scrollStateType: this._scrollState.type === 'locked-to-bottom'
        ? 'locked-to-bottom'
        : 'free-scroll',
      items,
    }
  }
}
