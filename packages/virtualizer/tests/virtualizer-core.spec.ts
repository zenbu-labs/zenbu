import { test, expect } from '@playwright/test'
import { VirtualizerCore } from '../src/virtualizer-core'
import { MeasurementCacheImpl } from '../src/measurement-cache'
import type { MaterializedItem } from '../src/types'

// Unit tests for VirtualizerCore — these run in Node.js, no browser needed.

test.describe('VirtualizerCore carry-forward', () => {
  function makeItems(count: number, streaming = false): MaterializedItem<string>[] {
    return Array.from({ length: count }, (_, i) => ({
      key: `item-${i}`,
      cacheKey: streaming && i === count - 1 ? `item-${i}:streaming` : `item-${i}:final`,
      view: `content-${i}`,
      sourceEventIds: [`evt-${i}`],
      seqRange: [i, i] as [number, number],
    }))
  }

  test('carry-forward persists across multiple recomputePositions calls', () => {
    const cache = new MeasurementCacheImpl()
    const core = new VirtualizerCore<string>(
      cache,
      50, // estimateHeight
      5,  // overscan
      null, // overscanPx
      null, // retainOverscanPx
      20,  // bottomThreshold
    )

    // Step 1: Build positions with streaming items, all measured
    const streamingItems = makeItems(5, true) // last item has :streaming cacheKey
    for (const item of streamingItems) {
      cache.set(item.cacheKey, { height: 120, measuredAt: Date.now() })
    }
    core.recomputePositions(streamingItems)

    // Verify all items are measured
    for (const pos of core.getPositions()) {
      expect(pos.measured).toBe(true)
      expect(pos.size).toBe(120)
    }

    // Step 2: Streaming ends — cacheKey changes for last item.
    // The new cacheKey is NOT in the cache (simulates the case where
    // ResizeObserver hasn't fired yet).
    const completedItems = makeItems(5, false) // last item now has :final cacheKey
    const result1 = core.recomputePositions(completedItems)

    // The carry-forward should use the previous measured size (120),
    // not the estimate (50).
    const lastPos1 = result1.positions[4]
    expect(lastPos1.size).toBe(120) // carry-forward from measured value
    const totalSize1 = core.getTotalSize()

    // Step 3: Call recomputePositions AGAIN (simulates a scroll-triggered
    // re-render). This is where the bug manifests: without the fix,
    // the carry-forward sees measured:false → falls back to estimateHeight(50).
    const result2 = core.recomputePositions(completedItems)

    const lastPos2 = result2.positions[4]
    expect(
      lastPos2.size,
      `Second recomputePositions should preserve carry-forward size (120), ` +
      `but got ${lastPos2.size} (estimate fallback). This causes rubber-band ` +
      `scroll because totalSize changes from ${totalSize1} to ${core.getTotalSize()}.`,
    ).toBe(120)

    // TotalSize must be stable across calls
    expect(core.getTotalSize()).toBe(totalSize1)
  })

  test('carry-forward does not produce scrollAdjustment on subsequent calls', () => {
    const cache = new MeasurementCacheImpl()
    const core = new VirtualizerCore<string>(
      cache,
      50, // estimateHeight
      5,  // overscan
      null,
      null,
      20,
    )

    // Build measured positions
    const streamingItems = makeItems(10, true)
    for (const item of streamingItems) {
      cache.set(item.cacheKey, { height: 100, measuredAt: Date.now() })
    }
    core.recomputePositions(streamingItems)
    core.setContainerHeight(400)
    core.setScrollOffset(200)

    // Set up free-scroll with anchor
    core.scrollState = {
      type: 'free-scroll',
      anchor: { anchorKey: 'item-2', offsetFromItemTop: 0, anchorIndex: 2 },
    }

    // Streaming ends — cacheKey changes for last item
    const completedItems = makeItems(10, false)
    const result1 = core.recomputePositions(completedItems)

    // First call: carry-forward works, no adjustment expected
    // (anchor item-2 has stable position)
    expect(result1.scrollAdjustment).toBe(0)

    // Second call: without fix, item-9 falls back to estimate (50 instead of 100),
    // which changes totalSize but shouldn't affect item-2's offset.
    // However, items BEFORE the streaming item could be affected if they
    // also have cache misses. Let's verify no adjustment.
    const result2 = core.recomputePositions(completedItems)
    expect(
      result2.scrollAdjustment,
      `scrollAdjustment should be 0 on stable content, ` +
      `but got ${result2.scrollAdjustment}. This causes rubber-band scroll.`,
    ).toBe(0)

    // Verify totalSize is stable
    const size1 = result1.positions.reduce((sum, p) => sum + p.size, 0)
    const size2 = result2.positions.reduce((sum, p) => sum + p.size, 0)
    expect(size2).toBe(size1)
  })
})
