import { useEffect, useRef, useCallback } from 'react'
import type { ScrollState } from '../types'
import type { VirtualizerCore } from '../virtualizer-core'
export function useMeasurement<TView>(
  core: VirtualizerCore<TView>,
  scrollElementRef: React.RefObject<HTMLElement | null>,
  scrollState: ScrollState,
  onMeasurementChange: (needsSettle?: boolean) => void,
  applyScrollOffset: (nextScrollTop: number) => void,
  syncLockedToBottom: () => void,
): { measureElement: (node: HTMLElement | null) => void; syncDomPositions: () => void; flushPendingMeasurements: () => void; clearCacheKeyChangeFlags: () => void } {
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const observedElements = useRef(new Map<HTMLElement, { key: string; cacheKey: string; hadCacheKeyChange: boolean }>())
  const scrollStateRef = useRef(scrollState)
  scrollStateRef.current = scrollState
  const onMeasurementChangeRef = useRef(onMeasurementChange)
  onMeasurementChangeRef.current = onMeasurementChange

  // Store the ResizeObserver callback in a ref so the lazily-created
  // ResizeObserver always invokes the latest closure (no stale captures).
  const roCallbackRef = useRef<ResizeObserverCallback | null>(null)
  roCallbackRef.current = (entries: ResizeObserverEntry[]) => {
    let totalAdjustment = 0
    let needsSettle = false
    let anySizeChanged = false
    for (const entry of entries) {
      const el = entry.target as HTMLElement
      const meta = observedElements.current.get(el)
      if (!meta) continue

      if (meta.hadCacheKeyChange) needsSettle = true
      const height = entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight

      // Check if height actually differs from current model size.
      // handleMeasurement returns 0 for items at/below the scroll offset
      // (no scroll compensation needed), but positions ARE updated in-place.
      // We need to track this so we don't skip syncDomPositions.
      const idx = core.getKeyToIndex().get(meta.key)
      if (idx !== undefined) {
        const currentSize = core.getPositions()[idx]?.size ?? -1
        if (Math.abs(height - currentSize) >= 0.5) anySizeChanged = true
      }

      const adjustment = core.handleMeasurement(meta.key, meta.cacheKey, height)
      totalAdjustment += adjustment
    }

    if (totalAdjustment === 0 && !needsSettle && !anySizeChanged) return

    const scrollEl = scrollElementRef.current
    if (!scrollEl) return

    // Apply scroll compensation synchronously before paint
    if (totalAdjustment !== 0 && scrollStateRef.current.type === 'free-scroll') {
      applyScrollOffset(scrollEl.scrollTop + totalAdjustment)
    }

    // During CSS transitions (needsSettle), skip syncLockedToBottom to avoid
    // forced layouts on every animation frame. The settle timer will trigger
    // a re-render and syncLockedToBottom will run after transition completes.
    if (scrollStateRef.current.type === 'locked-to-bottom' && !needsSettle) {
      syncLockedToBottom()
    }

    // Sync DOM positions directly — avoids waiting for React re-render
    syncDomPositions()

    onMeasurementChangeRef.current(needsSettle)
  }

  // Lazily create the ResizeObserver on first use. This ensures it's
  // available during React's commit phase (when measureElement ref
  // callbacks fire), before useEffect would run. The callback delegates
  // to roCallbackRef so it always uses the latest closure.
  const ensureResizeObserver = useCallback((): ResizeObserver => {
    if (resizeObserverRef.current) return resizeObserverRef.current
    resizeObserverRef.current = new ResizeObserver((entries, observer) => {
      roCallbackRef.current?.(entries, observer)
    })
    return resizeObserverRef.current
  }, [])

  // Cleanup only — ResizeObserver is created lazily in measureElement
  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
    }
  }, [])

  // flushPendingMeasurements is now a no-op. All initial measurements
  // are handled by ResizeObserver which fires after browser layout but
  // before paint — so items appear at correct positions on the first
  // visible frame without needing a synchronous getBoundingClientRect
  // read (which would force an expensive layout computation).
  const flushPendingMeasurements = useCallback(() => {
    // No-op: ResizeObserver handles all measurements
  }, [])

  // Directly update DOM transforms for all observed elements to reflect
  // current core positions. This runs before the browser paints (via
  // microtask or synchronously from ResizeObserver) so that position
  // corrections are visually instant — no React re-render needed.
  // Also updates the spacer height so items stay within bounds.
  const syncDomPositions = useCallback(() => {
    const positions = core.getPositions()
    const keyToIndex = core.getKeyToIndex()
    let spacerUpdated = false

    for (const [el, meta] of observedElements.current) {
      const idx = keyToIndex.get(meta.key)
      if (idx === undefined) continue
      const pos = positions[idx]
      if (pos) {
        el.style.transform = `translateY(${pos.offset}px)`
      }

      // Update spacer (parent of items) height once
      if (!spacerUpdated && el.parentElement) {
        el.parentElement.style.height = `${core.getTotalSize()}px`
        spacerUpdated = true
      }
    }
  }, [core])

  const measureElementCallback = useCallback((node: HTMLElement | null) => {
    if (!node) return

    const key = node.dataset.virtualKey
    const cacheKey = node.dataset.virtualCacheKey
    if (!key || !cacheKey) return

    const existing = observedElements.current.get(node)
    if (existing) {
      if (existing.key !== key || existing.cacheKey !== cacheKey) {
        // Only use the settle timer (hadCacheKeyChange) when a CSS transition
        // is active. For non-transitioning changes (e.g. streaming → completed),
        // ResizeObserver measurement should apply immediately without the 150ms
        // settle delay.
        const hasTransition = parseFloat(getComputedStyle(node).transitionDuration) > 0
        observedElements.current.set(node, { key, cacheKey, hadCacheKeyChange: hasTransition })
      }
      return
    }

    // Lazily create the ResizeObserver on first element observation
    const ro = ensureResizeObserver()

    observedElements.current.set(node, { key, cacheKey, hadCacheKeyChange: false })
    ro.observe(node, { box: 'border-box' })

    // Cleanup via MutationObserver to detect when the node is removed from DOM
    const parent = node.parentElement
    if (parent) {
      const mo = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const removed of mutation.removedNodes) {
            if (removed === node) {
              observedElements.current.delete(node)
              resizeObserverRef.current?.unobserve(node)
              mo.disconnect()
              return
            }
          }
        }
      })
      mo.observe(parent, { childList: true })
    }
  }, [ensureResizeObserver])

  const clearCacheKeyChangeFlags = useCallback(() => {
    for (const [, meta] of observedElements.current) {
      meta.hadCacheKeyChange = false
    }
  }, [])

  return { measureElement: measureElementCallback, syncDomPositions, flushPendingMeasurements, clearCacheKeyChangeFlags }
}
