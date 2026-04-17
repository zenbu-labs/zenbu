import { useRef, useCallback, useEffect, useMemo } from "react"
import { readChatScrollMetrics } from "./scroll-metrics"

export interface UseAutoScrollOptions {
  working: boolean
  bottomThreshold?: number
  canLockToBottom?: boolean
  onUserScrolled?: () => void
}

export type ScrollSnapshot = {
  scrollTop: number
  scrollHeight: number
}

export function useAutoScroll({
  working,
  bottomThreshold = 10,
  canLockToBottom = true,
  onUserScrolled,
}: UseAutoScrollOptions) {
  const snapshotRestoreMaxFrames = 3
  const scrollElRef = useRef<HTMLDivElement | null>(null)
  const contentElRef = useRef<HTMLDivElement | null>(null)
  const userScrolledRef = useRef(false)
  const workingRef = useRef(working)
  const settlingRef = useRef(false)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const autoMarkRef = useRef<{ top: number; time: number } | undefined>(undefined)
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const roRef = useRef<ResizeObserver | null>(null)
  const wheelCleanupRef = useRef<(() => void) | null>(null)
  const snapshotRestoreFrameRef = useRef<number | null>(null)
  const snapshotRestoreTokenRef = useRef(0)
  const onUserScrolledRef = useRef(onUserScrolled)
  const suppressRef = useRef(false)
  const preserveSnapshotScrollRef = useRef(false)
  const lastObservedTopRef = useRef<number | null>(null)
  onUserScrolledRef.current = onUserScrolled

  const isActive = () => workingRef.current || settlingRef.current

  const distanceFromBottom = (el: HTMLElement) =>
    el.scrollHeight - el.clientHeight - el.scrollTop

  const canScroll = (el: HTMLElement) =>
    el.scrollHeight - el.clientHeight > 1

  const rememberObservedState = (el: HTMLElement | null | undefined) => {
    lastObservedTopRef.current = el?.scrollTop ?? null
  }

  const updateOverflowAnchor = () => {
    const el = scrollElRef.current
    if (!el) return
    const expected = preserveSnapshotScrollRef.current
      ? "none"
      : userScrolledRef.current
      ? "auto"
      : "none"
    el.style.overflowAnchor = expected
  }

  const setUserScrolled = (next: boolean, reason: string) => {
    if (userScrolledRef.current === next) return
    userScrolledRef.current = next
    updateOverflowAnchor()
    if (next) onUserScrolledRef.current?.()
  }

  const markAuto = (el: HTMLElement) => {
    autoMarkRef.current = {
      top: Math.max(0, el.scrollHeight - el.clientHeight),
      time: Date.now(),
    }
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    autoTimerRef.current = setTimeout(() => {
      autoMarkRef.current = undefined
      autoTimerRef.current = undefined
    }, 1500)
  }

  const isAutoScroll = (el: HTMLElement) => {
    const a = autoMarkRef.current
    if (!a) return false
    if (Date.now() - a.time > 1500) {
      autoMarkRef.current = undefined
      return false
    }
    return Math.abs(el.scrollTop - a.top) < 2
  }

  const scrollToBottom = (force: boolean, reason = "unknown") => {
    if (!force && !isActive()) return
    if (force) setUserScrolled(false, `force:${reason}`)

    const el = scrollElRef.current
    if (!el) return
    if (!force && userScrolledRef.current) return

    if (distanceFromBottom(el) < 2) {
      markAuto(el)
      rememberObservedState(el)
      return
    }

    markAuto(el)
    el.scrollTop = el.scrollHeight
    rememberObservedState(el)
  }

  const stop = (reason: string) => {
    const el = scrollElRef.current
    if (!el) return
    if (!canScroll(el)) {
      setUserScrolled(false, `${reason}:cannot-scroll`)
      return
    }
    if (userScrolledRef.current) return
    setUserScrolled(true, reason)
  }

  const handleScroll = useCallback(() => {
    const el = scrollElRef.current
    if (!el) return

    const previousTop = lastObservedTopRef.current
    const auto = isAutoScroll(el)
    const movedUp = previousTop !== null && el.scrollTop < previousTop - 1
    const movedDown = previousTop !== null && el.scrollTop > previousTop + 1
    const dist = distanceFromBottom(el)

    if (!canScroll(el)) {
      setUserScrolled(false, "scroll:no-scrollable-overflow")
      rememberObservedState(el)
      return
    }

    if (!userScrolledRef.current && movedUp && !auto && dist > 0) {
      stop("scroll:user-upward-intent")
    }

    if (dist < bottomThreshold) {
      if (canLockToBottom) {
        const shouldResume =
          !userScrolledRef.current || movedDown || dist <= 1

        if (shouldResume) {
          setUserScrolled(
            false,
            userScrolledRef.current ? "scroll:return-to-bottom" : "scroll:near-bottom",
          )
        }
      } else {
        stop("scroll:near-bottom-with-hidden-below")
      }
      rememberObservedState(el)
      return
    }

    if (!userScrolledRef.current && isAutoScroll(el)) {
      scrollToBottom(false, "scroll:auto-mark")
      rememberObservedState(el)
      return
    }

    stop("scroll:user-detach")
    rememberObservedState(el)
  }, [bottomThreshold, canLockToBottom])

  const handleInteraction = useCallback(() => {
    if (!isActive()) return
    const selection = window.getSelection()
    if (selection && selection.toString().length > 0) {
      stop("selection")
    }
  }, [])

  const attachContentObserver = () => {
    if (roRef.current) {
      roRef.current.disconnect()
      roRef.current = null
    }

    const contentEl = contentElRef.current
    if (!contentEl) return

    const ro = new ResizeObserver(() => {
      if (suppressRef.current) return

      const el = scrollElRef.current
      if (el && !canScroll(el)) {
        setUserScrolled(false, "resize:no-scrollable-overflow")
        return
      }
      if (userScrolledRef.current) return
      if (!el) return
      if (distanceFromBottom(el) < 2) {
        markAuto(el)
        rememberObservedState(el)
        return
      }
      markAuto(el)
      el.scrollTop = el.scrollHeight
      rememberObservedState(el)
    })
    ro.observe(contentEl)
    roRef.current = ro
  }

  const attachWheelListener = () => {
    if (wheelCleanupRef.current) {
      wheelCleanupRef.current()
      wheelCleanupRef.current = null
    }

    const el = scrollElRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      const target = e.target instanceof Element ? e.target : undefined
      const nested = target?.closest("[data-scrollable]")
      if (nested && nested !== el) return
      if (e.deltaY >= 0) return
      stop("wheel-up")
    }

    el.addEventListener("wheel", handleWheel, { passive: true })
    wheelCleanupRef.current = () => el.removeEventListener("wheel", handleWheel)
  }

  useEffect(() => {
    const prev = workingRef.current
    workingRef.current = working
    if (prev === working) return

    if (working) {
      settlingRef.current = false
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
      settleTimerRef.current = undefined
      if (!userScrolledRef.current) scrollToBottom(true, "working-start")
    } else {
      settlingRef.current = true
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
      settleTimerRef.current = setTimeout(() => {
        settlingRef.current = false
      }, 300)
    }
  }, [working])

  useEffect(() => {
    attachContentObserver()
    attachWheelListener()
    updateOverflowAnchor()
  })

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
      if (snapshotRestoreFrameRef.current !== null) cancelAnimationFrame(snapshotRestoreFrameRef.current)
      if (roRef.current) {
        roRef.current.disconnect()
        roRef.current = null
      }
      if (wheelCleanupRef.current) {
        wheelCleanupRef.current()
        wheelCleanupRef.current = null
      }
    }
  }, [])

  const helpersRef = useRef({ attachWheelListener, attachContentObserver, updateOverflowAnchor, scrollToBottom, stop })
  helpersRef.current = { attachWheelListener, attachContentObserver, updateOverflowAnchor, scrollToBottom, stop }

  const scrollRefCallback = useCallback((el: HTMLDivElement | null) => {
    scrollElRef.current = el
    rememberObservedState(el)
    helpersRef.current.attachWheelListener()
    if (el) {
      helpersRef.current.updateOverflowAnchor()
    }
  }, [])

  const contentRefCallback = useCallback((el: HTMLDivElement | null) => {
    contentElRef.current = el
    helpersRef.current.attachContentObserver()
  }, [])

  const captureSnapshot = useCallback((): ScrollSnapshot | null => {
    const el = scrollElRef.current
    if (!el) return null
    snapshotRestoreTokenRef.current += 1
    if (snapshotRestoreFrameRef.current !== null) {
      cancelAnimationFrame(snapshotRestoreFrameRef.current)
      snapshotRestoreFrameRef.current = null
    }
    suppressRef.current = true
    preserveSnapshotScrollRef.current = true
    updateOverflowAnchor()
    return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight }
  }, [])

  const restoreSnapshot = useCallback((snapshot: ScrollSnapshot) => {
    const el = scrollElRef.current
    if (!el) return
    const token = snapshotRestoreTokenRef.current
    const finishRestore = () => {
      if (token !== snapshotRestoreTokenRef.current) return
      suppressRef.current = false
      preserveSnapshotScrollRef.current = false
      updateOverflowAnchor()
    }

    const applyRestore = (
      currentEl: HTMLElement,
      phase: "immediate" | "raf",
      frame: number,
    ) => {
      const metrics = readChatScrollMetrics(currentEl)
      const expectedScrollTop =
        snapshot.scrollTop + (currentEl.scrollHeight - snapshot.scrollHeight)
      const drift = (metrics?.scrollTop ?? expectedScrollTop) - expectedScrollTop

      if (Math.abs(drift) > 1) {
        currentEl.scrollTop = expectedScrollTop
        markAuto(currentEl)
        rememberObservedState(currentEl)
      } else {
        rememberObservedState(currentEl)
      }

      const finalMetrics = readChatScrollMetrics(currentEl)
      const finalExpectedScrollTop =
        snapshot.scrollTop + (currentEl.scrollHeight - snapshot.scrollHeight)

      return {
        metrics: finalMetrics,
        expectedScrollTop: finalExpectedScrollTop,
      }
    }

    applyRestore(el, "immediate", 0)

    if (snapshotRestoreFrameRef.current !== null) {
      cancelAnimationFrame(snapshotRestoreFrameRef.current)
    }

    let previousScrollHeight = el.scrollHeight
    let stableFrames = 0

    const runFrame = (frame: number) => {
      snapshotRestoreFrameRef.current = requestAnimationFrame(() => {
        if (token !== snapshotRestoreTokenRef.current) return
        const currentEl = scrollElRef.current
        snapshotRestoreFrameRef.current = null
        if (!currentEl) {
          finishRestore()
          return
        }

        const { metrics, expectedScrollTop } = applyRestore(currentEl, "raf", frame)
        const currentScrollHeight = currentEl.scrollHeight
        const currentDrift = (metrics?.scrollTop ?? expectedScrollTop) - expectedScrollTop

        if (currentScrollHeight === previousScrollHeight && Math.abs(currentDrift) <= 1) {
          stableFrames += 1
        } else {
          stableFrames = 0
        }
        previousScrollHeight = currentScrollHeight

        if (frame < snapshotRestoreMaxFrames && stableFrames < 1) {
          runFrame(frame + 1)
          return
        }

        finishRestore()
      })
    }

    runFrame(1)
  }, [])

  return useMemo(() => ({
    scrollRef: scrollRefCallback,
    contentRef: contentRefCallback,
    handleScroll,
    handleInteraction,
    captureSnapshot,
    restoreSnapshot,
    get userScrolled() { return userScrolledRef.current },
    pause() { helpersRef.current.stop("pause") },
    resume() {
      helpersRef.current.scrollToBottom(true, "resume")
    },
    scrollToBottom() { helpersRef.current.scrollToBottom(false, "api") },
    forceScrollToBottom() { helpersRef.current.scrollToBottom(true, "api-force") },
    getScrollElement() { return scrollElRef.current },
  }), [
    scrollRefCallback,
    contentRefCallback,
    handleScroll,
    handleInteraction,
    captureSnapshot,
    restoreSnapshot,
  ])
}
