import { useMemo, useCallback, useRef, useState, useLayoutEffect } from 'react'
// flushSync removed — React disallows it inside lifecycle methods
import type {
  VirtualizerOptions,
  VirtualizerInstance,
  VirtualItemPosition,
  ViewportSnapshot,
} from '../types'
import { VirtualizerCore } from '../virtualizer-core'
import { MeasurementCacheImpl } from '../measurement-cache'
import { useScrollState } from './use-scroll-state'
import { useDataPipeline } from './use-data-pipeline'
import { useMeasurement } from './use-measurement'
import { useReadTracking } from './use-read-tracking'
import { useDebug } from './use-debug'
import { captureAnchor, resolveAnchor } from '../scroll-anchor'
import { assertMaterializedItems } from '../invariants'

const COLD_START_PADDING_PX = 48
const FREE_SCROLL_HANDOFF_TOLERANCE_PX = 0.5

export function useVirtualizer<TEvent, TView>(
  options: VirtualizerOptions<TEvent, TView>,
): VirtualizerInstance<TView> {
  const transformMaterializedItem = options.transformMaterializedItem
  const initialScrollState = useMemo(
    () => options.initialSnapshot?.scrollStateType === 'free-scroll'
      ? ({ type: 'free-scroll', anchor: null } as const)
      : ({ type: 'locked-to-bottom' } as const),
    [options.initialSnapshot],
  )
  const cache = useMemo(() => {
    const c = new MeasurementCacheImpl()
    if (options.initialMeasurementCache) c.hydrate(options.initialMeasurementCache)
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const core = useMemo(
    () => new VirtualizerCore<TView>(
      cache,
      options.estimateItemHeight,
      options.overscan ?? 5,
      options.overscanPx ?? null,
      options.retainOverscanPx ?? null,
      options.bottomThreshold ?? 10,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const { materializedItems: rawMaterializedItems, totalCount, loadingState, isLoading } = useDataPipeline(
    options.dataSource,
    options.materializer,
    options.materializationWindow ?? 200,
    options.initialMaterializedItems ?? [],
  )
  const materializedItems = useMemo(
    () => {
      const items = transformMaterializedItem
        ? rawMaterializedItems.map(transformMaterializedItem)
        : rawMaterializedItems
      assertMaterializedItems(items, 'useVirtualizer.materializedItems (post-transform)')
      return items
    },
    [rawMaterializedItems, transformMaterializedItem],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialMaterializedItems = useMemo(
    () => {
      const items = options.initialMaterializedItems ?? []
      return transformMaterializedItem ? items.map(transformMaterializedItem) : items
    },
    [],
  )

  const { scrollState, dispatchScroll } = useScrollState(initialScrollState)
  const scrollStateRef = useRef(scrollState)
  scrollStateRef.current = scrollState

  const [measurementVersion, setMeasurementVersion] = useState(0)
  const pendingMeasurementUpdateRef = useRef(false)
  const measurementPassCountRef = useRef(0)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollElementRef = useRef<HTMLElement | null>(null)
  const isAutoScrolling = useRef(false)
  const autoScrollReleaseFrameRef = useRef<number | null>(null)
  const scrollCleanupRef = useRef<(() => void) | null>(null)
  const attachedScrollNodeRef = useRef<HTMLElement | null>(null)
  const touchStartYRef = useRef<number | null>(null)

  const snapshotRef = useRef<ViewportSnapshot | null>(options.initialSnapshot ?? null)
  const snapshotDisabledRef = useRef(false)
  const snapshotSeededRef = useRef(false)
  const snapshotScrollAppliedRef = useRef(false)
  const snapshotFreeScrollHandoffRef = useRef(false)
  const pendingFreeScrollOffsetRef = useRef<number | null>(null)
  // After a snapshot restore, this stores the anchor key and the
  // viewport offset it SHOULD be at. On every subsequent layout effect
  // (for a limited number of cycles), we read the anchor's actual DOM
  // position and correct scrollTop to keep it pinned. This handles
  // measurement corrections that trickle in across multiple renders
  // without producing visible layout shifts.
  const postRestoreAnchorRef = useRef<{
    key: string
    targetViewportOffset: number
    cyclesRemaining: number
  } | null>(null)
  const initialMaterializedItemsRef = useRef(initialMaterializedItems)
  // Cold start is only needed when data loads asynchronously and items
  // aren't available on the first render. With sync-initialized data
  // (getRangeSync), items are already in the MaterializationWindow,
  // and core.getVirtualItems() handles viewport calculation correctly.
  const coldStartActiveRef = useRef(!options.initialSnapshot && !options.dataSource.getRangeSync)
  const [coldStartStartIndex, setColdStartStartIndex] = useState<number | null>(null)
  // When restoring from a locked-to-bottom snapshot, preserve the snapshot's
  // totalHeight as a floor so remeasurement corrections can't shrink the
  // spacer and cause visible bottom-position drift.
  const snapshotTotalHeightFloorRef = useRef<number | null>(
    options.initialSnapshot?.scrollStateType === 'locked-to-bottom'
      ? options.initialSnapshot.totalHeight
      : null,
  )

  core.scrollState = scrollState
  core.setEstimateHeight(options.estimateItemHeight)

  // Snapshot mode stays active until explicitly disabled by:
  // - free-scroll handoff (sets snapshotDisabledRef)
  // - user scroll interaction (sets snapshotDisabledRef)
  // - materialized items diverging from the initial set
  // Measurement changes are still propagated (onMeasurementChange fires
  // normally), but the useMemo returns snapshot geometry to prevent
  // cumulative estimate errors from shifting the viewport.
  const usingSnapshot = Boolean(
    snapshotRef.current &&
    !snapshotDisabledRef.current &&
    initialMaterializedItemsRef.current.length > 0 &&
    areMaterializedWindowsEquivalent(
      materializedItems,
      initialMaterializedItemsRef.current,
    ),
  )
  const usingSnapshotRef = useRef(usingSnapshot)
  usingSnapshotRef.current = usingSnapshot
  const usingColdStartBootstrap = Boolean(
    !usingSnapshot &&
    coldStartActiveRef.current &&
    scrollStateRef.current.type === 'locked-to-bottom' &&
    materializedItems.length > 0,
  )
  const usingColdStartBootstrapRef = useRef(usingColdStartBootstrap)
  usingColdStartBootstrapRef.current = usingColdStartBootstrap

  const deferredMeasurementRafRef = useRef<number | null>(null)

  const onMeasurementChange = useCallback((needsSettle?: boolean) => {
    if (usingColdStartBootstrapRef.current) return

    if (needsSettle) {
      // Accordion CSS transitions: wait for final size then re-render
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null
        clearCacheKeyChangeFlags()
        setMeasurementVersion(c => c + 1)
      }, 150)
    } else {
      // Defer measurement re-render to next frame so the initial
      // render's long task stays within the 16ms budget. DOM positions
      // are already correct from syncDomPositions — this just updates
      // React's virtual window (which items should be rendered).
      if (deferredMeasurementRafRef.current === null) {
        deferredMeasurementRafRef.current = requestAnimationFrame(() => {
          deferredMeasurementRafRef.current = null
          setMeasurementVersion(c => c + 1)
        })
      }
    }
  }, [])

  const holdAutoScrolling = useCallback(() => {
    if (autoScrollReleaseFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollReleaseFrameRef.current)
    }

    isAutoScrolling.current = true
    autoScrollReleaseFrameRef.current = requestAnimationFrame(() => {
      autoScrollReleaseFrameRef.current = requestAnimationFrame(() => {
        isAutoScrolling.current = false
        autoScrollReleaseFrameRef.current = null
      })
    })
  }, [])

  const applyScrollOffset = useCallback((nextScrollTop: number) => {
    const scrollEl = scrollElementRef.current
    if (!scrollEl) return

    const clampedScrollTop = Math.max(0, nextScrollTop)
    // Write-only: never read scrollEl.scrollTop here. Reading it after
    // syncDomPositions wrote transforms/spacer-height would force a
    // synchronous layout (~2ms). Writing an identical value is a no-op
    // for the browser and won't fire scroll events.
    core.setScrollOffset(clampedScrollTop)
    holdAutoScrolling()
    scrollEl.scrollTop = clampedScrollTop
  }, [core, holdAutoScrolling])

  const getRenderedDomBottom = useCallback(() => {
    const scrollEl = scrollElementRef.current
    if (!scrollEl) return core.getTotalSize()

    const scrollElRect = scrollEl.getBoundingClientRect()
    let domBottom = Math.max(scrollEl.scrollHeight, core.getTotalSize())

    const renderedNodes = scrollEl.querySelectorAll<HTMLElement>('[data-virtual-key]')
    for (const node of renderedNodes) {
      const nodeBottom = scrollEl.scrollTop + (node.getBoundingClientRect().bottom - scrollElRect.top)
      domBottom = Math.max(domBottom, nodeBottom)
    }

    return domBottom
  }, [core])

  const syncLockedToBottom = useCallback(() => {
    const scrollEl = scrollElementRef.current
    if (!scrollEl) return

    core.setContainerHeight(scrollEl.clientHeight)
    const bottomOffset = Math.max(
      0,
      getRenderedDomBottom() - scrollEl.clientHeight,
    )
    core.setScrollOffset(bottomOffset)
    applyScrollOffset(bottomOffset)
  }, [core, applyScrollOffset, getRenderedDomBottom])

  const breakBottomLock = useCallback(() => {
    if (scrollStateRef.current.type !== 'locked-to-bottom') return

    // Clear the totalHeight floor — user is leaving bottom lock
    snapshotTotalHeightFloorRef.current = null

    if (usingSnapshotRef.current) {
      snapshotDisabledRef.current = true
    }
    if (usingColdStartBootstrapRef.current) {
      coldStartActiveRef.current = false
    }
    if (autoScrollReleaseFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollReleaseFrameRef.current)
      autoScrollReleaseFrameRef.current = null
    }

    isAutoScrolling.current = false

    const scrollTop = scrollElementRef.current?.scrollTop ?? core.getScrollOffset()
    const anchor = captureAnchor(core.getPositions(), scrollTop)
    const nextState = { type: 'free-scroll' as const, anchor }

    scrollStateRef.current = nextState
    core.scrollState = nextState

    dispatchScroll({ type: 'USER_SCROLL_UP' })
    if (anchor) {
      dispatchScroll({ type: 'ANCHOR_ESTABLISHED', anchor })
    }
  }, [core, dispatchScroll])

  const { measureElement, syncDomPositions, flushPendingMeasurements, clearCacheKeyChangeFlags } = useMeasurement(
    core,
    scrollElementRef,
    scrollState,
    onMeasurementChange,
    applyScrollOffset,
    syncLockedToBottom,
  )

  // After every React render, re-apply correct positions from core to the DOM.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    flushPendingMeasurements()
    syncDomPositions()
  })

  // Reset measurement pass counter when materializedItems change (tab switch)
  // so the new content gets its allowed measurement re-render.
  const prevMaterializedRef = useRef(materializedItems)
  if (prevMaterializedRef.current !== materializedItems) {
    prevMaterializedRef.current = materializedItems
    measurementPassCountRef.current = 0
  }

  const { virtualItems, totalSize } = useMemo((): {
    virtualItems: VirtualItemPosition[]
    totalSize: number
  } => {
    const snapshot = snapshotRef.current
    if (snapshot && usingSnapshot) {
      core.setScrollOffset(snapshot.scrollTop)
      core.setContainerHeight(snapshot.containerHeight)

      if (!snapshotSeededRef.current) {
        for (const si of snapshot.items) {
          cache.set(si.cacheKey, { height: si.size, measuredAt: Date.now() })
        }
        snapshotSeededRef.current = true
      }

      if (materializedItems.length > 0) {
        core.recomputePositions(materializedItems)
      }

      const items: VirtualItemPosition[] = snapshot.items.map(si => ({
        index: si.index,
        key: si.key,
        cacheKey: si.cacheKey,
        offset: si.offset,
        size: si.size,
        measured: true,
      }))

      return {
        virtualItems: items,
        totalSize: snapshot.totalHeight,
      }
    }

    // Normal path
    if (materializedItems.length === 0) {
      return { virtualItems: [], totalSize: 0 }
    }

    const { scrollAdjustment } = core.recomputePositions(materializedItems)

    // When the post-restore DOM anchor is active, it handles scroll
    // position correction directly from DOM measurements. Do NOT also
    // apply model-based scrollAdjustment, or the two corrections fight
    // each other and produce visible jitter.
    const suppressModelAdjustment = postRestoreAnchorRef.current !== null

    if (
      !suppressModelAdjustment &&
      scrollStateRef.current.type === 'free-scroll' &&
      Math.abs(scrollAdjustment) >= FREE_SCROLL_HANDOFF_TOLERANCE_PX
    ) {
      const nextOffset = Math.max(0, core.getScrollOffset() + scrollAdjustment)
      core.setScrollOffset(nextOffset)
      pendingFreeScrollOffsetRef.current = nextOffset
      if (typeof window !== 'undefined') {
        const msg = `scrollAdjustment=${scrollAdjustment.toFixed(2)} applied, nextOffset=${nextOffset.toFixed(2)}`
        console.log(`[virtualizer] ${msg}`)
        const w = window as unknown as Record<string, unknown>
        if (!Array.isArray(w.__VIRT_DEBUG)) w.__VIRT_DEBUG = []
        ;(w.__VIRT_DEBUG as string[]).push(msg)
      }
    } else {
      pendingFreeScrollOffsetRef.current = null
      if (process.env.NODE_ENV !== 'production' && scrollStateRef.current.type === 'free-scroll' && scrollAdjustment !== 0) {
        console.log(`[virtualizer] scrollAdjustment=${scrollAdjustment.toFixed(2)} BELOW tolerance (${FREE_SCROLL_HANDOFF_TOLERANCE_PX}), state=${scrollStateRef.current.type}`)
      }
    }

    // Apply the snapshot totalHeight floor BEFORE computing scroll offsets.
    // This prevents remeasurement corrections from shifting the bottom position.
    let computedTotalSize = core.getTotalSize()
    const floor = snapshotTotalHeightFloorRef.current
    if (floor !== null) {
      if (computedTotalSize >= floor) {
        snapshotTotalHeightFloorRef.current = null
      } else {
        computedTotalSize = floor
      }
    }

    if (scrollStateRef.current.type === 'locked-to-bottom') {
      // Use cached container height when available to avoid forced layout
      // on deferred measurement re-renders. Falls back to DOM read only
      // when the cached value is not yet set (first render).
      const containerH = core.getContainerHeight() || scrollElementRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 0)
      const bottomOffset = Math.max(0, computedTotalSize - containerH)
      core.setScrollOffset(bottomOffset)
      core.setContainerHeight(containerH)
    }

    if (usingColdStartBootstrap) {
      const positions = core.getPositions()
      const bootstrapStartIndex = resolveColdStartStartIndex(
        positions,
        coldStartStartIndex,
        core.getContainerHeight() || scrollElementRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 0),
      )

      return {
        virtualItems: positions.slice(bootstrapStartIndex),
        totalSize: computedTotalSize,
      }
    }

    return {
      virtualItems: core.getVirtualItems(),
      totalSize: computedTotalSize,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    materializedItems,
    measurementVersion,
    core,
    scrollState,
    usingSnapshot,
    usingColdStartBootstrap,
    coldStartStartIndex,
  ])

  useLayoutEffect(() => {
    const scrollEl = scrollElementRef.current
    if (!scrollEl) return

    const snapshot = snapshotRef.current
    if (snapshot && usingSnapshot) {
      if (snapshot.scrollStateType === 'free-scroll') {
        if (snapshotFreeScrollHandoffRef.current) return

        snapshotFreeScrollHandoffRef.current = true

        // Apply snapshot scrollTop directly.
        applyScrollOffset(snapshot.scrollTop)

        // Sync-remeasure all rendered items so the cache matches reality.
        const renderedNodes = scrollEl.querySelectorAll<HTMLElement>('[data-virtual-cache-key]')
        for (const node of renderedNodes) {
          const nodeKey = node.dataset.virtualKey
          const nodeCacheKey = node.dataset.virtualCacheKey
          if (!nodeKey || !nodeCacheKey) continue
          const nodeHeight = node.getBoundingClientRect().height
          core.handleMeasurement(nodeKey, nodeCacheKey, nodeHeight)
        }

        // Find the anchor item in the DOM and capture its EXACT viewport
        // offset. We'll keep correcting scrollTop on subsequent renders
        // to match this offset, preventing measurement corrections from
        // causing visible layout shifts.
        const snapshotPositions: VirtualItemPosition[] = snapshot.items.map((item) => ({
          index: item.index,
          key: item.key,
          cacheKey: item.cacheKey,
          offset: item.offset,
          size: item.size,
          measured: true,
        }))
        const snapshotAnchor = captureAnchor(snapshotPositions, snapshot.scrollTop)
        if (snapshotAnchor) {
          const anchorNode = scrollEl.querySelector<HTMLElement>(
            `[data-virtual-key="${CSS.escape(snapshotAnchor.anchorKey)}"]`,
          )
          if (anchorNode) {
            const scrollElRect = scrollEl.getBoundingClientRect()
            const viewportOffset = anchorNode.getBoundingClientRect().top - scrollElRect.top
            // Store the anchor for multi-cycle correction
            postRestoreAnchorRef.current = {
              key: snapshotAnchor.anchorKey,
              targetViewportOffset: viewportOffset,
              cyclesRemaining: 10, // correct for up to 10 render cycles
            }
          }
        }

        const liveAnchor = captureAnchor(core.getPositions(), scrollEl.scrollTop)
        const nextState = { type: 'free-scroll' as const, anchor: liveAnchor }

        scrollStateRef.current = nextState
        core.scrollState = nextState
        snapshotDisabledRef.current = true
        snapshotRef.current = null

        if (liveAnchor) {
          dispatchScroll({ type: 'ANCHOR_ESTABLISHED', anchor: liveAnchor })
        }
        dispatchScroll({ type: 'USER_SCROLL_UP' })
        setMeasurementVersion((current) => current + 1)
        return
      }

      if (snapshotScrollAppliedRef.current) return

      snapshotScrollAppliedRef.current = true
      applyScrollOffset(snapshot.scrollTop)
      // Disable snapshot mode after the first scroll application
      // so locked-to-bottom can transition to live positions.
      // The totalHeight floor prevents any height-shrink shift.
      snapshotDisabledRef.current = true
      snapshotRef.current = null
      // No setMeasurementVersion here — the DOM is already correct
      // from flushPendingMeasurements + syncDomPositions. Skipping
      // the re-render keeps locked-to-bottom tab revisits at 1 pass.
      return
    }

    if (materializedItems.length === 0) return

    // Post-restore DOM anchor correction: after a snapshot → live
    // transition, measurement corrections trickle in across multiple
    // renders. Each one shifts item positions, which can cause visible
    // layout shifts. We counteract this by reading the anchor item's
    // actual DOM position on every render and adjusting scrollTop to
    // keep it pinned at the same viewport offset.
    const postRestore = postRestoreAnchorRef.current
    if (postRestore && scrollEl && scrollStateRef.current.type === 'free-scroll') {
      const anchorNode = scrollEl.querySelector<HTMLElement>(
        `[data-virtual-key="${CSS.escape(postRestore.key)}"]`,
      )
      if (anchorNode) {
        const scrollElRect = scrollEl.getBoundingClientRect()
        const currentViewportOffset = anchorNode.getBoundingClientRect().top - scrollElRect.top
        const delta = currentViewportOffset - postRestore.targetViewportOffset
        if (Math.abs(delta) > 0.5) {
          applyScrollOffset(scrollEl.scrollTop + delta)
        }
      }

      postRestore.cyclesRemaining -= 1
      if (postRestore.cyclesRemaining <= 0) {
        postRestoreAnchorRef.current = null
      }
    }

    if (
      scrollStateRef.current.type === 'free-scroll' &&
      pendingFreeScrollOffsetRef.current !== null
    ) {
      const nextOffset = pendingFreeScrollOffsetRef.current
      pendingFreeScrollOffsetRef.current = null
      applyScrollOffset(nextOffset)
      return
    }

    if (scrollStateRef.current.type === 'locked-to-bottom') {
      // Write-only locked-to-bottom: use cached container height and
      // core's totalSize. Avoids reading scrollEl.scrollTop/clientHeight
      // after syncDomPositions wrote transforms, preventing a second
      // forced layout.
      const scrollEl = scrollElementRef.current
      if (scrollEl) {
        const containerH = core.getContainerHeight()
        if (containerH > 0) {
          const bottomOffset = Math.max(0, core.getTotalSize() - containerH)
          core.setScrollOffset(bottomOffset)
          holdAutoScrolling()
          scrollEl.scrollTop = bottomOffset
        }
      }
    }
  }, [materializedItems, measurementVersion, dispatchScroll, usingSnapshot, applyScrollOffset, holdAutoScrolling, core])

  useLayoutEffect(() => {
    if (usingSnapshot) return
    if (!snapshotRef.current) return

    snapshotRef.current = null
  }, [usingSnapshot])

  useLayoutEffect(() => {
    if (!usingColdStartBootstrap) return

    const scrollEl = scrollElementRef.current
    if (!scrollEl) return

    const renderedNodes = Array.from(
      scrollEl.querySelectorAll<HTMLElement>('[data-virtual-cache-key]'),
    )
    if (renderedNodes.length === 0) return

    let measuredHeight = 0
    for (const node of renderedNodes) {
      const cacheKey = node.dataset.virtualCacheKey
      if (!cacheKey) continue

      const naturalHeight = Math.max(
        node.scrollHeight,
        Math.ceil(node.getBoundingClientRect().height),
      )

      cache.set(cacheKey, {
        height: naturalHeight,
        measuredAt: Date.now(),
      })
      measuredHeight += naturalHeight
    }

    const targetHeight = scrollEl.clientHeight + COLD_START_PADDING_PX
    const positions = core.getPositions()
    const bootstrapStartIndex = resolveColdStartStartIndex(
      positions,
      coldStartStartIndex,
      scrollEl.clientHeight,
    )

    if (measuredHeight < targetHeight && bootstrapStartIndex > 0) {
      const currentCount = positions.length - bootstrapStartIndex
      const growthSize = Math.max(1, currentCount)
      setColdStartStartIndex(Math.max(0, bootstrapStartIndex - growthSize))
      return
    }

    coldStartActiveRef.current = false
    setMeasurementVersion((current) => current + 1)
  }, [usingColdStartBootstrap, coldStartStartIndex, core, cache])

  const scrollRef = useCallback((node: HTMLElement | null) => {
    if (attachedScrollNodeRef.current === node) {
      scrollElementRef.current = node
      return
    }

    scrollCleanupRef.current?.()
    scrollCleanupRef.current = null
    attachedScrollNodeRef.current = node
    scrollElementRef.current = node
    if (!node) return

    const handleScroll = () => {
      if (isAutoScrolling.current) return

      // Reset measurement pass counter on user scroll
      measurementPassCountRef.current = 0

      // User is scrolling — stop any post-restore DOM corrections
      postRestoreAnchorRef.current = null

      if (usingSnapshotRef.current) {
        snapshotDisabledRef.current = true
      }
      if (usingColdStartBootstrapRef.current) {
        coldStartActiveRef.current = false
      }

      // Use cached container height to avoid forcing layout after DOM writes.
      // The container ResizeObserver keeps core.getContainerHeight() up to date.
      const event = core.handleScroll(node.scrollTop, core.getContainerHeight() || node.clientHeight)
      if (event) {
        dispatchScroll(event)
      }

      setMeasurementVersion(c => c + 1)
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        breakBottomLock()
      }
    }

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null
    }

    const handleTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY
      const previousY = touchStartYRef.current
      if (currentY === undefined || previousY === null) return

      if (currentY > previousY + 2) {
        breakBottomLock()
      }

      touchStartYRef.current = currentY
    }

    const handleTouchEnd = () => {
      touchStartYRef.current = null
    }

    node.addEventListener('scroll', handleScroll, { passive: true })
    node.addEventListener('wheel', handleWheel, { passive: true })
    node.addEventListener('touchstart', handleTouchStart, { passive: true })
    node.addEventListener('touchmove', handleTouchMove, { passive: true })
    node.addEventListener('touchend', handleTouchEnd, { passive: true })
    node.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    // Don't read node.clientHeight here — it would force a synchronous
    // layout after React's DOM mutations (~2.5ms). The container
    // ResizeObserver provides the correct height via borderBoxSize
    // before the first paint. The useMemo fallback uses window.innerHeight
    // as an initial estimate for locked-to-bottom positioning.

    const containerRO = new ResizeObserver((entries) => {
      // Use borderBoxSize to avoid forcing a layout (clientHeight would
      // trigger layout recalculation after syncDomPositions writes styles)
      const entry = entries[0]
      if (!entry) return
      const newHeight = entry.borderBoxSize?.[0]?.blockSize ?? node.clientHeight
      // Skip if height hasn't changed (e.g. initial observe fire)
      if (newHeight === core.getContainerHeight()) return
      core.setContainerHeight(newHeight)
      if (usingSnapshotRef.current || usingColdStartBootstrapRef.current) return

      setMeasurementVersion(c => c + 1)

      if (scrollStateRef.current.type === 'locked-to-bottom') {
        syncLockedToBottom()
      }
    })
    containerRO.observe(node)

    scrollCleanupRef.current = () => {
      node.removeEventListener('scroll', handleScroll)
      node.removeEventListener('wheel', handleWheel)
      node.removeEventListener('touchstart', handleTouchStart)
      node.removeEventListener('touchmove', handleTouchMove)
      node.removeEventListener('touchend', handleTouchEnd)
      node.removeEventListener('touchcancel', handleTouchEnd)
      containerRO.disconnect()
    }
  }, [breakBottomLock, core, dispatchScroll, syncLockedToBottom])

  useReadTracking(virtualItems, options.onReadUpdate)

  const debugInfo = useDebug(
    options.debug ?? false,
    core,
    scrollState,
    loadingState,
    cache,
    totalCount,
    materializedItems.length,
    usingSnapshot ? 'snapshot' : usingColdStartBootstrap ? 'cold-start' : 'live',
    virtualItems,
    scrollElementRef.current,
    usingColdStartBootstrap ? resolveColdStartStartIndex(
      core.getPositions(),
      coldStartStartIndex,
      scrollElementRef.current?.clientHeight ?? core.getContainerHeight(),
    ) : null,
  )

  const scrollToIndex = useCallback((
    index: number,
    opts?: { align?: 'start' | 'center' | 'end'; behavior?: 'auto' | 'smooth' },
  ) => {
    if (usingSnapshotRef.current) {
      snapshotDisabledRef.current = true
    }
    if (usingColdStartBootstrapRef.current) {
      coldStartActiveRef.current = false
    }

    const positions = core.getPositions()
    if (index < 0 || index >= positions.length) return

    const scrollEl = scrollElementRef.current
    if (!scrollEl) return

    const item = positions[index]
    const align = opts?.align ?? 'start'
    let targetOffset: number

    switch (align) {
      case 'start':
        targetOffset = item.offset
        break
      case 'center':
        targetOffset = item.offset - (scrollEl.clientHeight - item.size) / 2
        break
      case 'end':
        targetOffset = item.offset - scrollEl.clientHeight + item.size
        break
    }

    dispatchScroll({
      type: 'PROGRAMMATIC_SCROLL',
      target: { index, align },
    })

    isAutoScrolling.current = true
    scrollEl.scrollTo({
      top: Math.max(0, targetOffset),
      behavior: opts?.behavior ?? 'auto',
    })

    requestAnimationFrame(() => {
      isAutoScrolling.current = false
      const anchor = captureAnchor(core.getPositions(), scrollEl.scrollTop)
      if (anchor) {
        dispatchScroll({ type: 'ANCHOR_ESTABLISHED', anchor })
      }
      dispatchScroll({ type: 'PROGRAMMATIC_SCROLL_COMPLETE' })
    })
  }, [core, dispatchScroll])

  const scrollToBottom = useCallback((
    opts?: { behavior?: 'auto' | 'smooth' },
  ) => {
    if (usingSnapshotRef.current) {
      snapshotDisabledRef.current = true
    }
    if (usingColdStartBootstrapRef.current) {
      coldStartActiveRef.current = false
    }

    const scrollEl = scrollElementRef.current
    if (!scrollEl) return

    if ((opts?.behavior ?? 'auto') === 'auto') {
      syncLockedToBottom()
    } else {
      holdAutoScrolling()
      scrollEl.scrollTo({
        top: Math.max(0, core.getTotalSize() - scrollEl.clientHeight),
        behavior: opts?.behavior ?? 'auto',
      })
    }
    dispatchScroll({ type: 'USER_SCROLL_TO_BOTTOM' })
  }, [dispatchScroll, syncLockedToBottom, holdAutoScrolling, core])

  // Use model values exclusively to avoid forcing synchronous layout
  // during React's commit phase (ref cleanup on tab switch). The model
  // is kept accurate by ResizeObserver measurements, so DOM reads are
  // unnecessary and would cost ~0.5ms of forced layout.
  const captureSnapshotFn = useCallback((): ViewportSnapshot => {
    return {
      scrollTop: core.getScrollOffset(),
      totalHeight: totalSize,
      containerHeight: core.getContainerHeight(),
      scrollStateType: scrollState.type === 'locked-to-bottom'
        ? 'locked-to-bottom'
        : 'free-scroll',
      items: virtualItems.map((item) => ({
        key: item.key,
        cacheKey: item.cacheKey,
        index: item.index,
        offset: item.offset,
        size: item.size,
      })),
    }
  }, [core, scrollState.type, totalSize, virtualItems])

  const invalidateMeasurement = useCallback((cacheKey: string) => {
    cache.delete(cacheKey)
    setMeasurementVersion(c => c + 1)
  }, [cache])

  return {
    virtualItems,
    totalSize,
    scrollState,
    scrollRef,
    measureElement,
    scrollToIndex,
    scrollToBottom,
    invalidateMeasurement,
    materializedItems,
    rawMaterializedItems,
    exportMeasurementCache: () => cache.serialize(),
    captureSnapshot: captureSnapshotFn,
    debugInfo,
    isLockedToBottom: scrollState.type === 'locked-to-bottom',
    isLoading,
  }
}

function areMaterializedWindowsEquivalent(
  current: Array<{ key: string; cacheKey: string }>,
  initial: Array<{ key: string; cacheKey: string }>,
): boolean {
  if (current.length !== initial.length) return false

  for (let index = 0; index < current.length; index += 1) {
    if (
      current[index].key !== initial[index].key ||
      current[index].cacheKey !== initial[index].cacheKey
    ) {
      return false
    }
  }

  return true
}

function resolveColdStartStartIndex(
  positions: VirtualItemPosition[],
  currentStartIndex: number | null,
  containerHeight: number,
): number {
  if (currentStartIndex !== null) {
    return currentStartIndex
  }

  if (positions.length === 0) {
    return 0
  }

  const targetHeight = containerHeight + COLD_START_PADDING_PX
  let accumulatedHeight = 0

  for (let index = positions.length - 1; index >= 0; index -= 1) {
    accumulatedHeight += positions[index].size
    if (accumulatedHeight >= targetHeight) {
      return index
    }
  }

  return 0
}
