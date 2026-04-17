import { useState, useEffect, useRef, useCallback } from 'react'
import type { DebugInfo, ScrollState, DataLoadingState, VirtualItemPosition } from '../types'
import type { VirtualizerCore } from '../virtualizer-core'
import type { MeasurementCacheImpl } from '../measurement-cache'

export function useDebug<TView>(
  enabled: boolean,
  core: VirtualizerCore<TView>,
  scrollState: ScrollState,
  dataLoadingState: DataLoadingState,
  cache: MeasurementCacheImpl,
  totalItems: number,
  totalMaterialized: number,
  mode: DebugInfo['mode'],
  virtualItems: VirtualItemPosition[],
  scrollElement: HTMLElement | null,
  coldStartStartIndex: number | null,
): DebugInfo | null {
  const [fps, setFps] = useState(60)
  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())

  useEffect(() => {
    if (!enabled) return

    let rafId: number
    const tick = () => {
      frameCount.current++
      const now = performance.now()
      const elapsed = now - lastTime.current

      if (elapsed >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / elapsed))
        frameCount.current = 0
        lastTime.current = now
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [enabled])

  const getDebugInfo = useCallback((): DebugInfo | null => {
    if (!enabled) return null

    const positions = core.getPositions()
    const measuredCount = positions.filter(p => p.measured).length
    const coreScrollOffset = core.getScrollOffset()
    const containerHeight = core.getContainerHeight()
    const domScrollTop = scrollElement?.scrollTop ?? null
    const domClientHeight = scrollElement?.clientHeight ?? null
    const domScrollHeight = scrollElement?.scrollHeight ?? null
    const distanceFromBottom = Math.max(
      0,
      core.getTotalSize() - (coreScrollOffset + containerHeight),
    )

    return {
      scrollState,
      dataLoadingState,
      mode,
      visibleRange: core.visibleRange,
      renderedRange: core.renderedRange,
      totalItems,
      totalMaterialized,
      virtualItemCount: virtualItems.length,
      firstVirtualIndex: virtualItems[0]?.index ?? null,
      lastVirtualIndex: virtualItems[virtualItems.length - 1]?.index ?? null,
      positionCount: positions.length,
      measurementHitRate: cache.hitRate,
      anchorItem: scrollState.type === 'free-scroll' ? scrollState.anchor?.anchorKey ?? null : null,
      estimatedTotalHeight: core.getTotalSize(),
      coreScrollOffset,
      domScrollTop,
      scrollOffsetDelta: domScrollTop === null ? null : domScrollTop - coreScrollOffset,
      containerHeight,
      domClientHeight,
      domScrollHeight,
      distanceFromBottom,
      coldStartStartIndex,
      measuredItemCount: measuredCount,
      unmeasuredItemCount: positions.length - measuredCount,
      fps,
    }
  }, [
    enabled,
    core,
    scrollState,
    dataLoadingState,
    cache,
    totalItems,
    totalMaterialized,
    mode,
    virtualItems,
    scrollElement,
    coldStartStartIndex,
    fps,
  ])

  if (!enabled) return null
  return getDebugInfo()
}
