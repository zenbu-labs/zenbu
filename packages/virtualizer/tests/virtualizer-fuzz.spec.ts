import { test, expect, type Page } from '@playwright/test'

// ─── Shared scroll container finder ──────────────────────────

/** Finds the overflow:auto scroll container that holds virtual items */
const FIND_SCROLL_CONTAINER = `
  (function() {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const style = window.getComputedStyle(el);
      if (
        (style.overflow === 'auto' || style.overflowY === 'auto') &&
        el.querySelector('[data-virtual-key]')
      ) {
        return el;
      }
    }
    return null;
  })()
`

// ─── Invariant checks (run inside the browser via page.evaluate) ─────────

interface Violation {
  invariant: string
  details: string
}

async function checkInvariants(page: Page): Promise<Violation[]> {
  return page.evaluate(() => {
    const violations: Array<{ invariant: string; details: string }> = []

    // Find the scroll container
    const allEls = document.querySelectorAll<HTMLElement>('*')
    let scrollEl: HTMLElement | null = null
    for (const el of allEls) {
      const style = window.getComputedStyle(el)
      if (
        (style.overflow === 'auto' || style.overflowY === 'auto') &&
        el.querySelector('[data-virtual-key]')
      ) {
        scrollEl = el
        break
      }
    }
    if (!scrollEl) return violations

    // Get all rendered virtual items with their DOM positions
    const nodes = scrollEl.querySelectorAll<HTMLElement>('[data-virtual-key]')
    const scrollRect = scrollEl.getBoundingClientRect()
    const items: Array<{ key: string; offset: number; size: number }> = []

    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      const offset = scrollEl.scrollTop + (rect.top - scrollRect.top)
      items.push({
        key: node.dataset.virtualKey ?? '',
        offset,
        size: rect.height,
      })
    }

    items.sort((a, b) => a.offset - b.offset)

    // 1. Monotonic offsets
    for (let i = 1; i < items.length; i++) {
      if (items[i].offset < items[i - 1].offset) {
        violations.push({
          invariant: 'monotonic-offsets',
          details: `"${items[i].key}" offset ${items[i].offset.toFixed(1)} < "${items[i - 1].key}" offset ${items[i - 1].offset.toFixed(1)}`,
        })
        break
      }
    }

    // 2. No overlap (tolerance: 2px)
    for (let i = 0; i < items.length - 1; i++) {
      const endOfCurrent = items[i].offset + items[i].size
      const startOfNext = items[i + 1].offset
      if (endOfCurrent > startOfNext + 2) {
        const vt = scrollEl.scrollTop
        const vb = vt + scrollEl.clientHeight
        violations.push({
          invariant: 'no-overlap',
          details: `"${items[i].key}" ends at ${endOfCurrent.toFixed(1)}, next "${items[i + 1].key}" starts at ${startOfNext.toFixed(1)} (overlap: ${(endOfCurrent - startOfNext).toFixed(1)}px) [${items.length} items, viewport=${vt.toFixed(0)}-${vb.toFixed(0)}, item@${items[i].offset.toFixed(0)}, size=${items[i].size.toFixed(1)}]`,
        })
        break
      }
    }

    // 3. No duplicate keys — each virtual item key must be unique
    const keySet = new Set<string>()
    for (const item of items) {
      if (keySet.has(item.key)) {
        violations.push({
          invariant: 'no-duplicate-keys',
          details: `Key "${item.key}" appears multiple times in rendered items`,
        })
        break
      }
      keySet.add(item.key)
    }

    // 5. Positive heights
    for (const node of nodes) {
      if (node.getBoundingClientRect().height <= 0) {
        violations.push({
          invariant: 'positive-height',
          details: `"${node.dataset.virtualKey}" has non-positive height`,
        })
        break
      }
    }

    // 4. Spacer height positive
    const spacer = scrollEl.querySelector<HTMLElement>(':scope > div')
    if (spacer) {
      const spacerHeight = spacer.getBoundingClientRect().height
      if (spacerHeight <= 0) {
        violations.push({
          invariant: 'spacer-positive',
          details: `Spacer has non-positive height: ${spacerHeight}`,
        })
      }

      // 5. Items within spacer bounds (50px tolerance)
      for (const item of items) {
        const itemEnd = item.offset + item.size
        if (itemEnd > spacerHeight + 50) {
          violations.push({
            invariant: 'items-within-spacer',
            details: `"${item.key}" extends to ${itemEnd.toFixed(1)} but spacer is ${spacerHeight.toFixed(1)}`,
          })
          break
        }
      }
    }

    // 6. Viewport coverage
    const viewportTop = scrollEl.scrollTop
    const viewportBottom = viewportTop + scrollEl.clientHeight
    if (items.length > 0) {
      const viewportItems = items.filter(
        (item) => item.offset + item.size > viewportTop && item.offset < viewportBottom,
      )
      if (viewportItems.length === 0) {
        violations.push({
          invariant: 'viewport-coverage',
          details: `No items in viewport (scrollTop=${viewportTop.toFixed(0)}, clientHeight=${scrollEl.clientHeight})`,
        })
      }
    }

    // 7. Model height vs DOM height divergence
    if (spacer) {
      const modelHeight = spacer.getBoundingClientRect().height
      const domScrollHeight = scrollEl.scrollHeight
      const heightDivergence = Math.abs(domScrollHeight - modelHeight)
      if (heightDivergence > 200) {
        violations.push({
          invariant: 'height-divergence',
          details: `Model height (${modelHeight.toFixed(0)}) and DOM scrollHeight (${domScrollHeight}) diverge by ${heightDivergence.toFixed(0)}px (tolerance: 200px)`,
        })
      }
    }

    // 8. Message order — blocks from earlier messages must appear above later ones
    // Returns a global ordering number: pre-generated msgs first, then interactive msgs
    function getMessageOrder(key: string): number | null {
      // Pre-generated: msg-{seed}-{index}:... → order by index (0, 1, 2, ...)
      const msgMatch = key.match(/^msg-\d+-(\d+)/)
      if (msgMatch) return parseInt(msgMatch[1], 10)
      // Interactive user: int-u-{N}:... → comes after all pre-generated, even slots
      const userMatch = key.match(/^int-u-(\d+)/)
      if (userMatch) return 100000 + parseInt(userMatch[1], 10) * 2
      // Interactive assistant: int-a-{N}:... → comes after corresponding user msg, odd slots
      const asstMatch = key.match(/^int-a-(\d+)/)
      if (asstMatch) return 100000 + parseInt(asstMatch[1], 10) * 2 + 1
      return null
    }

    for (let i = 0; i < items.length; i++) {
      const orderI = getMessageOrder(items[i].key)
      if (orderI === null) continue
      for (let j = i + 1; j < items.length; j++) {
        const orderJ = getMessageOrder(items[j].key)
        if (orderJ === null) continue
        // items sorted by offset: items[i].offset <= items[j].offset
        // If item at higher offset has a LOWER order, the ordering is wrong
        if (orderJ < orderI) {
          violations.push({
            invariant: 'message-order',
            details: `"${items[i].key}" (order ${orderI}) at offset ${items[i].offset.toFixed(0)} appears before "${items[j].key}" (order ${orderJ}) at offset ${items[j].offset.toFixed(0)}, but order ${orderJ} should come first`,
          })
          break
        }
      }
      // Only report first violation
      if (violations.some(v => v.invariant === 'message-order')) break
    }

    // 9. No large gaps — visible items should not have large gaps between them
    // (catches items at wrong translateY positions, stale snapshot geometry, etc.)
    {
      const vTop = scrollEl.scrollTop
      const vBottom = vTop + scrollEl.clientHeight
      for (let i = 0; i < items.length - 1; i++) {
        const endOfCurrent = items[i].offset + items[i].size
        const startOfNext = items[i + 1].offset
        const gap = startOfNext - endOfCurrent
        // Only flag gaps for items that are both in/near the viewport
        const nearViewport = (endOfCurrent > vTop - 200 && startOfNext < vBottom + 200)
        if (gap > 100 && nearViewport) {
          violations.push({
            invariant: 'no-large-gap',
            details: `${gap.toFixed(0)}px gap between "${items[i].key}" (ends ${endOfCurrent.toFixed(0)}) and "${items[i + 1].key}" (starts ${startOfNext.toFixed(0)}) [viewport: ${vTop.toFixed(0)}-${vBottom.toFixed(0)}]`,
          })
          break
        }
      }
    }

    // 10. Block contiguity — all blocks from same message should be grouped together
    const seenMessages = new Map<string, number>() // messagePrefix → last seen index in sorted items
    for (let i = 0; i < items.length; i++) {
      // Extract message id from key: "int-u-0:text:0" → "int-u-0", "msg-777-28:code:3" → "msg-777-28"
      // Message id is everything before the first colon-separated block kind
      const msgMatch = items[i].key.match(/^((?:int-[ua]-\d+|msg-\d+-\d+))/)
      if (!msgMatch) continue
      const msgId = msgMatch[1]

      const lastIdx = seenMessages.get(msgId)
      if (lastIdx !== undefined && lastIdx !== i - 1) {
        // There was a gap — some other message's block appeared between
        // blocks of this message
        const gapItem = items[lastIdx + 1]
        violations.push({
          invariant: 'block-contiguity',
          details: `Blocks of "${msgId}" are not contiguous: "${items[lastIdx].key}" at index ${lastIdx}, then "${gapItem?.key}" (different msg) at ${lastIdx + 1}, then "${items[i].key}" at ${i}`,
        })
        break
      }
      seenMessages.set(msgId, i)
    }

    return violations
  })
}

/**
 * Check for stale streaming cacheKeys — items with `:streaming` cacheKey when
 * streaming has ended. This is a separate check (not in checkInvariants) because
 * there's a small timing gap after streaming ends where the input becomes available
 * but the async materializer hasn't fully processed the message_end event yet.
 * Call this ONLY after sufficient settling time (>500ms after input re-enabled).
 */
async function checkStaleStreamingData(page: Page): Promise<Violation[]> {
  return page.evaluate(() => {
    const violations: Array<{ invariant: string; details: string }> = []

    // Only check if input says streaming is done
    const streamingInput = document.querySelector<HTMLInputElement>('input[placeholder="Waiting for response..."]')
    if (streamingInput) return violations // Still streaming, skip check

    const nodes = document.querySelectorAll<HTMLElement>('[data-virtual-cache-key]')
    const staleItems: string[] = []
    for (const node of nodes) {
      const ck = node.dataset.virtualCacheKey ?? ''
      if (ck.endsWith(':streaming')) {
        staleItems.push(`${node.dataset.virtualKey} (${ck})`)
      }
    }

    if (staleItems.length > 0) {
      violations.push({
        invariant: 'stale-streaming-data',
        details: `${staleItems.length} item(s) have stale :streaming cacheKey after streaming ended: ${staleItems.slice(0, 3).join(', ')}`,
      })
    }

    return violations
  })
}

// ─── Viewport anchor capture ────────────────────────────────

interface ViewportAnchor {
  key: string
  offsetFromViewportTop: number
  scrollTop: number
  containerTop: number
  itemAbsoluteOffset: number
}

async function captureViewportAnchor(page: Page): Promise<ViewportAnchor | null> {
  return page.evaluate(() => {
    const allEls = document.querySelectorAll<HTMLElement>('*')
    let scrollEl: HTMLElement | null = null
    for (const el of allEls) {
      const style = window.getComputedStyle(el)
      if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
        scrollEl = el
        break
      }
    }
    if (!scrollEl) return null

    const scrollRect = scrollEl.getBoundingClientRect()
    const nodes = scrollEl.querySelectorAll<HTMLElement>('[data-virtual-key]')
    let closestNode: HTMLElement | null = null
    let closestDistance = Infinity

    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      const distFromViewportTop = Math.abs(rect.top - scrollRect.top)
      if (distFromViewportTop < closestDistance) {
        closestDistance = distFromViewportTop
        closestNode = node
      }
    }

    if (!closestNode) return null

    const nodeRect = closestNode.getBoundingClientRect()
    return {
      key: closestNode.dataset.virtualKey ?? '',
      offsetFromViewportTop: nodeRect.top - scrollRect.top,
      scrollTop: scrollEl.scrollTop,
      containerTop: scrollRect.top,
      itemAbsoluteOffset: scrollEl.scrollTop + (nodeRect.top - scrollRect.top),
    }
  })
}

// ─── Helpers ─────────────────────────────────────────────────

async function waitForSettle(page: Page, ms = 100) {
  await page.waitForTimeout(ms)
}

async function scrollContainer(page: Page, action: string, value?: number): Promise<string> {
  return page.evaluate(({ action, value }) => {
    const allEls = document.querySelectorAll<HTMLElement>('*')
    let scrollEl: HTMLElement | null = null
    for (const el of allEls) {
      const style = window.getComputedStyle(el)
      if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
        scrollEl = el
        break
      }
    }
    if (!scrollEl) return `${action}(no container)`

    switch (action) {
      case 'scrollTo': {
        const max = scrollEl.scrollHeight - scrollEl.clientHeight
        const target = value ?? Math.floor(Math.random() * Math.max(0, max))
        scrollEl.scrollTop = target
        return `scrollTo(${target})`
      }
      case 'scrollToTop':
        scrollEl.scrollTop = 0
        return 'scrollToTop'
      case 'scrollToBottom':
        scrollEl.scrollTop = scrollEl.scrollHeight
        return `scrollToBottom(${scrollEl.scrollHeight})`
      case 'scrollBy': {
        const delta = value ?? Math.floor(Math.random() * 400) - 100
        scrollEl.scrollTop += delta
        return `scrollBy(${delta})`
      }
      default:
        return action
    }
  }, { action, value })
}

async function getTabButtons(page: Page) {
  return page.locator('button').filter({ hasText: /Session [ABC]|Interactive/ })
}

async function breakBottomLockViaWheel(page: Page) {
  await page.evaluate(() => {
    const allEls = document.querySelectorAll<HTMLElement>('*')
    for (const el of allEls) {
      const style = window.getComputedStyle(el)
      if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: -200, bubbles: true }))
        break
      }
    }
  })
}

async function clickTab(page: Page, tabName: string) {
  const tabs = await getTabButtons(page)
  const count = await tabs.count()
  for (let t = 0; t < count; t++) {
    const text = await tabs.nth(t).textContent()
    if (text?.includes(tabName)) {
      await tabs.nth(t).click()
      return
    }
  }
}

async function getVirtDebugLogs(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    const logs = (w.__VIRT_DEBUG as string[]) ?? []
    w.__VIRT_DEBUG = []
    return logs
  })
}

/** Check if any scrollAdjustment > threshold was applied (layout shift source) */
async function checkScrollAdjustmentLogs(page: Page, threshold: number): Promise<{
  maxAdjustment: number
  logs: string[]
}> {
  const logs = await getVirtDebugLogs(page)
  let maxAdjustment = 0
  for (const log of logs) {
    const match = log.match(/scrollAdjustment=([-\d.]+) applied/)
    if (match) {
      const adj = Math.abs(parseFloat(match[1]))
      if (adj > maxAdjustment) maxAdjustment = adj
    }
  }
  return { maxAdjustment, logs }
}

/** Capture BCR positions of all visible virtual items relative to the scroll container */
async function captureVisibleItemPositions(page: Page): Promise<Record<string, { top: number; height: number }>> {
  return page.evaluate(() => {
    const allEls = document.querySelectorAll<HTMLElement>('*')
    let scrollEl: HTMLElement | null = null
    for (const el of allEls) {
      const style = window.getComputedStyle(el)
      if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
        scrollEl = el
        break
      }
    }
    if (!scrollEl) return {}

    const scrollRect = scrollEl.getBoundingClientRect()
    const nodes = scrollEl.querySelectorAll<HTMLElement>('[data-virtual-key]')
    const positions: Record<string, { top: number; height: number }> = {}

    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      if (rect.bottom > scrollRect.top && rect.top < scrollRect.bottom) {
        const key = node.dataset.virtualKey!
        positions[key] = {
          top: rect.top - scrollRect.top,
          height: rect.height,
        }
      }
    }

    return positions
  })
}

/** Capture absolute offsets (scrollTop + visual position) for ALL rendered items */
async function captureAllItemPositions(page: Page): Promise<{
  scrollTop: number
  items: Record<string, { absoluteOffset: number; height: number }>
}> {
  return page.evaluate(() => {
    const allEls = document.querySelectorAll<HTMLElement>('*')
    let scrollEl: HTMLElement | null = null
    for (const el of allEls) {
      const style = window.getComputedStyle(el)
      if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
        scrollEl = el
        break
      }
    }
    if (!scrollEl) return { scrollTop: 0, items: {} }

    const scrollRect = scrollEl.getBoundingClientRect()
    const nodes = scrollEl.querySelectorAll<HTMLElement>('[data-virtual-key]')
    const items: Record<string, { absoluteOffset: number; height: number }> = {}

    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      const key = node.dataset.virtualKey!
      items[key] = {
        absoluteOffset: scrollEl.scrollTop + (rect.top - scrollRect.top),
        height: rect.height,
      }
    }

    return { scrollTop: scrollEl.scrollTop, items }
  })
}

/**
 * Monitor for visual instability — captures item positions repeatedly over a
 * duration and detects any frame-to-frame shifts. Catches jank from measurement
 * corrections, items spawning, or position recalculations that happen BETWEEN
 * the settle period when structural invariants might pass.
 */
async function checkVisualStability(page: Page, durationMs = 1500, shiftThresholdPx = 5): Promise<Violation[]> {
  return page.evaluate(({ durationMs, shiftThresholdPx }) => {
    return new Promise<Array<{ invariant: string; details: string }>>((resolve) => {
      const violations: Array<{ invariant: string; details: string }> = []
      const seenShifts = new Set<string>() // deduplicate by key

      function findScrollEl(): HTMLElement | null {
        const allEls = document.querySelectorAll<HTMLElement>('*')
        for (const el of allEls) {
          const style = window.getComputedStyle(el)
          if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
            return el
          }
        }
        return null
      }

      function capturePositions(scrollEl: HTMLElement): Map<string, number> {
        const scrollRect = scrollEl.getBoundingClientRect()
        const nodes = scrollEl.querySelectorAll<HTMLElement>('[data-virtual-key]')
        const positions = new Map<string, number>()
        for (const node of nodes) {
          const rect = node.getBoundingClientRect()
          // Absolute offset = scrollTop + visual position relative to container
          positions.set(node.dataset.virtualKey!, scrollEl.scrollTop + (rect.top - scrollRect.top))
        }
        return positions
      }

      const scrollEl = findScrollEl()
      if (!scrollEl) { resolve(violations); return }

      let prevPositions = capturePositions(scrollEl)
      let prevScrollTop = scrollEl.scrollTop
      let elapsed = 0
      const intervalMs = 50

      const timer = setInterval(() => {
        elapsed += intervalMs

        const currentScrollTop = scrollEl.scrollTop
        // Skip if user/code scrolled (scroll events change positions legitimately)
        const scrollChanged = Math.abs(currentScrollTop - prevScrollTop) > 1
        prevScrollTop = currentScrollTop

        if (!scrollChanged) {
          const currentPositions = capturePositions(scrollEl)

          for (const [key, absOffset] of currentPositions) {
            const prevOffset = prevPositions.get(key)
            if (prevOffset !== undefined) {
              const shift = Math.abs(absOffset - prevOffset)
              if (shift > shiftThresholdPx && !seenShifts.has(key)) {
                seenShifts.add(key)
                violations.push({
                  invariant: 'visual-stability',
                  details: `"${key}" shifted ${shift.toFixed(1)}px (${prevOffset.toFixed(0)}→${absOffset.toFixed(0)}) at +${elapsed}ms`,
                })
              }
            }
          }

          prevPositions = currentPositions
        } else {
          // Update positions after scroll without checking
          prevPositions = capturePositions(scrollEl)
        }

        if (elapsed >= durationMs) {
          clearInterval(timer)
          resolve(violations)
        }
      }, intervalMs)
    })
  }, { durationMs, shiftThresholdPx })
}

/**
 * Check that items present before a tab switch maintain stable relative positions
 * after returning. Compares absolute offsets (independent of scrollTop).
 */
function checkPositionPreservation(
  before: Record<string, { absoluteOffset: number; height: number }>,
  after: Record<string, { absoluteOffset: number; height: number }>,
  tolerancePx: number = 10,
): Violation[] {
  const violations: Violation[] = []
  // Find items present in both snapshots
  const commonKeys = Object.keys(before).filter(k => k in after)
  if (commonKeys.length < 2) return violations

  // Check relative spacing between pairs of common items
  // If item A was 200px above item B before, it should still be ~200px above after
  for (let i = 0; i < commonKeys.length - 1; i++) {
    const keyA = commonKeys[i]
    const keyB = commonKeys[i + 1]
    const beforeGap = before[keyB].absoluteOffset - before[keyA].absoluteOffset
    const afterGap = after[keyB].absoluteOffset - after[keyA].absoluteOffset
    const gapDelta = Math.abs(afterGap - beforeGap)
    if (gapDelta > tolerancePx) {
      violations.push({
        invariant: 'position-preservation',
        details: `Gap between "${keyA}" and "${keyB}" changed by ${gapDelta.toFixed(1)}px ` +
          `(${beforeGap.toFixed(0)}→${afterGap.toFixed(0)}) after tab switch`,
      })
      if (violations.length >= 3) break // limit output
    }
  }
  return violations
}

/**
 * Install a frame-by-frame position monitor BEFORE a tab switch, then
 * switch tabs. The rAF-based monitor captures positions on EVERY animation
 * frame. Because rAF fires before ResizeObserver in the browser's frame
 * pipeline, the very first capture after React commits new DOM will see
 * items at their ESTIMATED positions (before RO corrects them). Subsequent
 * frames capture the corrected positions. Any shift between consecutive
 * frames indicates visual jank (items jumping).
 */
async function monitorTabSwitchJank(
  page: Page,
  tabName: string,
  opts: { frames?: number; thresholdPx?: number } = {},
): Promise<Violation[]> {
  const { frames = 40, thresholdPx = 5 } = opts

  // Install frame monitor BEFORE the tab switch
  await page.evaluate(({ maxFrames }) => {
    const w = window as unknown as Record<string, unknown>
    w.__jankCaptures = []
    w.__jankMonitorActive = true

    function findScrollEl(): HTMLElement | null {
      for (const el of document.querySelectorAll<HTMLElement>('*')) {
        const s = getComputedStyle(el)
        if ((s.overflow === 'auto' || s.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) return el
      }
      return null
    }

    function capture() {
      if (!(w as Record<string, unknown>).__jankMonitorActive) return
      const scrollEl = findScrollEl()
      const captures = (w as Record<string, unknown>).__jankCaptures as Array<unknown>
      if (!scrollEl) {
        captures.push({ scrollTop: 0, items: {}, timestamp: performance.now() })
      } else {
        const rect = scrollEl.getBoundingClientRect()
        const items: Record<string, number> = {}
        for (const node of scrollEl.querySelectorAll<HTMLElement>('[data-virtual-key]')) {
          const nodeRect = node.getBoundingClientRect()
          items[node.dataset.virtualKey!] = scrollEl.scrollTop + (nodeRect.top - rect.top)
        }
        captures.push({ scrollTop: scrollEl.scrollTop, items, timestamp: performance.now() })
      }
      if (captures.length < maxFrames) {
        requestAnimationFrame(capture)
      } else {
        (w as Record<string, unknown>).__jankMonitorActive = false
      }
    }
    requestAnimationFrame(capture)
  }, { maxFrames: frames })

  // Now switch tabs — this triggers the React re-render
  await clickTab(page, tabName)

  // Wait for monitor to complete
  await page.waitForFunction(
    () => !(window as unknown as Record<string, unknown>).__jankMonitorActive,
    { timeout: 5000 },
  )

  // Analyze the captures for frame-to-frame shifts
  return page.evaluate(({ thresholdPx }) => {
    const w = window as unknown as Record<string, unknown>
    const captures = w.__jankCaptures as Array<{
      scrollTop: number
      items: Record<string, number>
      timestamp: number
    }>
    const violations: Array<{ invariant: string; details: string }> = []
    const reportedKeys = new Set<string>()

    for (let i = 1; i < captures.length; i++) {
      const prev = captures[i - 1]
      const curr = captures[i]
      // Skip if scroll position changed (expected movement)
      if (Math.abs(curr.scrollTop - prev.scrollTop) > 1) continue

      for (const [key, offset] of Object.entries(curr.items)) {
        if (key in prev.items && !reportedKeys.has(key)) {
          const shift = Math.abs(offset - prev.items[key])
          if (shift > thresholdPx) {
            reportedKeys.add(key)
            violations.push({
              invariant: 'frame-jank',
              details: `"${key}" shifted ${shift.toFixed(1)}px between frame ${i - 1}→${i} ` +
                `(${prev.items[key].toFixed(0)}→${offset.toFixed(0)}) at +${(curr.timestamp - captures[0].timestamp).toFixed(0)}ms`,
            })
          }
        }
      }
    }

    // Clean up
    delete (w as Record<string, unknown>).__jankCaptures
    delete (w as Record<string, unknown>).__jankMonitorActive

    return violations
  }, { thresholdPx })
}

// ─── The fuzz tests ──────────────────────────────────────────

test.describe('Virtualizer Fuzz Test', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.text().includes('[virtualizer]')) {
        console.log(`  [browser] ${msg.text()}`)
      }
    })
    await page.goto('/')
    await page.waitForSelector('[data-virtual-key]', { timeout: 15_000 })
    await waitForSettle(page, 1000)
  })

  test('random scroll actions produce no invariant violations', async ({ page }) => {
    const ACTIONS = 150
    const allViolations: Array<{ action: string; violations: Violation[] }> = []

    for (let i = 0; i < ACTIONS; i++) {
      const roll = Math.random()
      let actionLabel = ''

      if (roll < 0.3) {
        actionLabel = await scrollContainer(page, 'scrollTo')
      } else if (roll < 0.4) {
        actionLabel = await scrollContainer(page, 'scrollToTop')
      } else if (roll < 0.5) {
        actionLabel = await scrollContainer(page, 'scrollToBottom')
      } else if (roll < 0.7) {
        const deltaY = (Math.random() - 0.5) * 1600
        await page.mouse.wheel(0, deltaY)
        actionLabel = `wheel(${deltaY.toFixed(0)})`
      } else if (roll < 0.85) {
        const accordionBtns = page.locator('[data-virtual-key] button')
        const count = await accordionBtns.count()
        if (count > 0) {
          const idx = Math.floor(Math.random() * count)
          await accordionBtns.nth(idx).click({ timeout: 2000 }).catch(() => {})
          actionLabel = `clickAccordion(${idx}/${count})`
        } else {
          actionLabel = 'clickAccordion(none)'
        }
      } else {
        const delta = Math.floor(Math.random() * 400) - 100
        actionLabel = await scrollContainer(page, 'scrollBy', delta)
      }

      await waitForSettle(page, 500)
      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({ action: `[${i}] ${actionLabel}`, violations })
      }
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== FUZZ VIOLATIONS (${allViolations.length}/${ACTIONS}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('tab round-trip preserves scroll position (no layout shift)', { timeout: 180_000 }, async ({ page }) => {
    const ROUND_TRIPS = 20
    const LAYOUT_SHIFT_TOLERANCE_PX = 1
    const SCROLL_ADJUSTMENT_THRESHOLD = 1 // Flag any scrollAdjustment > 1px as a shift
    const allViolations: Array<{ action: string; violations: Violation[] }> = []
    const tabNames = ['Session A', 'Session B', 'Session C']

    for (let i = 0; i < ROUND_TRIPS; i++) {
      const fromTabIdx = i % tabNames.length
      const toTabIdx = (fromTabIdx + 1 + Math.floor(Math.random() * (tabNames.length - 1))) % tabNames.length
      const fromTab = tabNames[fromTabIdx]
      const toTab = tabNames[toTabIdx]

      // Go to source tab
      await clickTab(page, fromTab)
      await waitForSettle(page, 800)

      // Break bottom lock and scroll to a middle position
      await breakBottomLockViaWheel(page)
      await waitForSettle(page, 300)
      const scrollOffset = 2000 + Math.floor(Math.random() * 8000)
      await scrollContainer(page, 'scrollTo', scrollOffset)
      await waitForSettle(page, 2000)

      // Capture anchor before
      const anchorBefore = await captureViewportAnchor(page)

      // Clear debug logs before the round-trip
      await getVirtDebugLogs(page)

      // Switch to other tab
      await clickTab(page, toTab)
      await waitForSettle(page, 500)

      // Switch back
      await clickTab(page, fromTab)
      await waitForSettle(page, 800)

      // Check for large scrollAdjustments (the source of visible shifts)
      const { maxAdjustment, logs: adjLogs } = await checkScrollAdjustmentLogs(page, SCROLL_ADJUSTMENT_THRESHOLD)
      if (maxAdjustment > SCROLL_ADJUSTMENT_THRESHOLD) {
        allViolations.push({
          action: `[${i}] round-trip(${fromTab}->${toTab}->${fromTab})`,
          violations: [{
            invariant: 'scroll-adjustment-shift',
            details: `scrollAdjustment of ${maxAdjustment.toFixed(1)}px applied after restore (threshold: ${SCROLL_ADJUSTMENT_THRESHOLD}px). ` +
              `Logs: ${adjLogs.filter(l => l.includes('applied')).join(' | ')}`,
          }],
        })
      }

      // Capture anchor after and check pixel shift
      const anchorAfter = await captureViewportAnchor(page)

      if (anchorBefore && anchorAfter) {
        let shift = 0
        if (anchorBefore.key === anchorAfter.key) {
          shift = Math.abs(anchorAfter.offsetFromViewportTop - anchorBefore.offsetFromViewportTop)
        } else {
          shift = Math.abs(anchorAfter.scrollTop - anchorBefore.scrollTop)
        }

        if (shift > LAYOUT_SHIFT_TOLERANCE_PX) {
          allViolations.push({
            action: `[${i}] round-trip(${fromTab}->${toTab}->${fromTab})`,
            violations: [{
              invariant: 'layout-shift',
              details: `key=${anchorBefore.key} shift=${shift.toFixed(1)}px ` +
                `viewportOffset: ${anchorBefore.offsetFromViewportTop.toFixed(1)} -> ${anchorAfter.offsetFromViewportTop.toFixed(1)} ` +
                `scrollTop: ${anchorBefore.scrollTop.toFixed(1)} -> ${anchorAfter.scrollTop.toFixed(1)}`,
            }],
          })
        }
      }

      // Structural invariants
      const postViolations = await checkInvariants(page)
      if (postViolations.length > 0) {
        allViolations.push({ action: `[${i}] post-switch(${fromTab}->${toTab}->${fromTab})`, violations: postViolations })
      }
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== TAB SWITCH VIOLATIONS (${allViolations.length}/${ROUND_TRIPS}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('rapid tab switching stress test', async ({ page }) => {
    const allViolations: Array<{ action: string; violations: Violation[] }> = []
    const tabNames = ['Session A', 'Session B', 'Session C']

    // Phase 1: Visit each tab and scroll to a specific position
    for (const tab of tabNames) {
      await clickTab(page, tab)
      await waitForSettle(page, 800)
      await breakBottomLockViaWheel(page)
      await waitForSettle(page, 300)
      await scrollContainer(page, 'scrollTo', 3000 + Math.floor(Math.random() * 5000))
      await waitForSettle(page, 1500)
    }

    // Phase 2: Rapid switching back and forth 30 times
    for (let i = 0; i < 30; i++) {
      const tab = tabNames[i % tabNames.length]

      // Capture anchor before switching
      const anchorBefore = await captureViewportAnchor(page)
      await getVirtDebugLogs(page) // clear

      // Switch
      await clickTab(page, tab)
      await waitForSettle(page, 400)

      // Check for large adjustments
      const { maxAdjustment } = await checkScrollAdjustmentLogs(page, 1)
      if (maxAdjustment > 1) {
        allViolations.push({
          action: `[${i}] rapidSwitch(${tab})`,
          violations: [{
            invariant: 'scroll-adjustment-shift',
            details: `scrollAdjustment of ${maxAdjustment.toFixed(1)}px after rapid switch`,
          }],
        })
      }

      // Structural check
      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({ action: `[${i}] rapidSwitch(${tab})`, violations })
      }

      // Sometimes scroll up a bit between switches (the user's exact pattern)
      if (Math.random() < 0.4) {
        await breakBottomLockViaWheel(page)
        await waitForSettle(page, 100)
        await scrollContainer(page, 'scrollBy', -(200 + Math.floor(Math.random() * 800)))
        await waitForSettle(page, 300)
      }
    }

    // Phase 3: Now do round-trips and check anchor stability
    for (let i = 0; i < 10; i++) {
      const fromTab = tabNames[i % tabNames.length]
      const toTab = tabNames[(i + 1) % tabNames.length]

      await clickTab(page, fromTab)
      await waitForSettle(page, 500)

      const anchorBefore = await captureViewportAnchor(page)
      await getVirtDebugLogs(page) // clear

      // Rapid A→B→A
      await clickTab(page, toTab)
      await waitForSettle(page, 300)
      await clickTab(page, fromTab)
      await waitForSettle(page, 600)

      const { maxAdjustment } = await checkScrollAdjustmentLogs(page, 1)
      const anchorAfter = await captureViewportAnchor(page)

      if (maxAdjustment > 1) {
        allViolations.push({
          action: `[${i}] roundTrip(${fromTab}->${toTab}->${fromTab})`,
          violations: [{
            invariant: 'scroll-adjustment-shift',
            details: `scrollAdjustment of ${maxAdjustment.toFixed(1)}px after round-trip`,
          }],
        })
      }

      if (anchorBefore && anchorAfter) {
        let shift = 0
        if (anchorBefore.key === anchorAfter.key) {
          shift = Math.abs(anchorAfter.offsetFromViewportTop - anchorBefore.offsetFromViewportTop)
        } else {
          shift = Math.abs(anchorAfter.scrollTop - anchorBefore.scrollTop)
        }
        if (shift > 1) {
          allViolations.push({
            action: `[${i}] roundTrip(${fromTab}->${toTab}->${fromTab})`,
            violations: [{
              invariant: 'layout-shift',
              details: `shift=${shift.toFixed(1)}px scrollTop: ${anchorBefore.scrollTop.toFixed(1)} -> ${anchorAfter.scrollTop.toFixed(1)}`,
            }],
          })
        }
      }

      const postViolations = await checkInvariants(page)
      if (postViolations.length > 0) {
        allViolations.push({ action: `[${i}] post-roundTrip(${fromTab}->${toTab}->${fromTab})`, violations: postViolations })
      }
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== RAPID SWITCH VIOLATIONS (${allViolations.length}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('mixed fuzz: scrolls + tab switches + accordions', async ({ page }) => {
    const ACTIONS = 200
    const allViolations: Array<{ action: string; violations: Violation[] }> = []

    for (let i = 0; i < ACTIONS; i++) {
      const roll = Math.random()
      let actionLabel = ''

      if (roll < 0.12) {
        // Switch tab
        const tabs = await getTabButtons(page)
        const tabCount = await tabs.count()
        const tabIdx = Math.floor(Math.random() * tabCount)
        const tabText = await tabs.nth(tabIdx).textContent()
        await tabs.nth(tabIdx).click()
        await waitForSettle(page, 400)
        actionLabel = `switchTab(${tabText?.trim()})`
      } else if (roll < 0.45) {
        actionLabel = await scrollContainer(page, 'scrollTo')
      } else if (roll < 0.6) {
        const deltaY = (Math.random() - 0.5) * 1200
        await page.mouse.wheel(0, deltaY)
        actionLabel = `wheel(${deltaY.toFixed(0)})`
      } else if (roll < 0.7) {
        actionLabel = await scrollContainer(page, 'scrollToBottom')
      } else if (roll < 0.8) {
        actionLabel = await scrollContainer(page, 'scrollToTop')
      } else if (roll < 0.92) {
        const delta = Math.floor(Math.random() * 400) - 100
        actionLabel = await scrollContainer(page, 'scrollBy', delta)
      } else {
        const accordionBtns = page.locator('[data-virtual-key] button')
        const count = await accordionBtns.count()
        if (count > 0) {
          const idx = Math.floor(Math.random() * count)
          await accordionBtns.nth(idx).click({ timeout: 2000 }).catch(() => {})
          actionLabel = `clickAccordion(${idx}/${count})`
        } else {
          actionLabel = 'clickAccordion(none)'
        }
      }

      await waitForSettle(page, 500)
      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({ action: `[${i}] ${actionLabel}`, violations })
      }
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== MIXED FUZZ VIOLATIONS (${allViolations.length}/${ACTIONS}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('resize + tab switch does not produce blank screen', async ({ page }) => {
    const allViolations: Array<{ action: string; violations: Violation[] }> = []
    const tabNames = ['Session A', 'Session B', 'Session C']
    const viewportSizes = [
      { width: 1280, height: 800 },
      { width: 900, height: 700 },
      { width: 1400, height: 900 },
      { width: 600, height: 800 },
      { width: 1100, height: 600 },
    ]

    for (let i = 0; i < viewportSizes.length; i++) {
      const size = viewportSizes[i]

      await page.setViewportSize(size)
      await waitForSettle(page, 2000)

      // Switch through tabs after resize
      for (let t = 0; t < tabNames.length; t++) {
        await clickTab(page, tabNames[t])
        await waitForSettle(page, 500)
        const violations = await checkInvariants(page)
        if (violations.length > 0) {
          allViolations.push({ action: `[${i}.${t + 3}] resize(${size.width}x${size.height})+switchTab(${tabNames[t]})`, violations })
        }
      }

      // Also test scrolling to bottom after resize
      await page.evaluate(() => {
        const allEls = document.querySelectorAll<HTMLElement>('*')
        for (const el of allEls) {
          const s = window.getComputedStyle(el)
          if ((s.overflow === 'auto' || s.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
            el.scrollTop = el.scrollHeight
            return
          }
        }
      })
      await waitForSettle(page, 500)
      const scrollViolations = await checkInvariants(page)
      if (scrollViolations.length > 0) {
        allViolations.push({ action: `[${i}] resize(${size.width}x${size.height})+scrollToBottom`, violations: scrollViolations })
      }

      // Switch tabs while at bottom
      for (let t = 0; t < tabNames.length; t++) {
        await clickTab(page, tabNames[t])
        await waitForSettle(page, 500)
        const violations = await checkInvariants(page)
        if (violations.length > 0) {
          allViolations.push({ action: `[${i}.${t}] resize(${size.width}x${size.height})+bottom+switchTab(${tabNames[t]})`, violations })
        }
      }
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== RESIZE+TAB VIOLATIONS (${allViolations.length}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('streaming completion does not cause layout shift', async ({ page }) => {
    // Switch to Interactive tab
    await clickTab(page, 'Interactive')
    await waitForSettle(page, 2000)

    // Send a message
    const input = page.locator('input[placeholder="Type a message..."]')
    await input.fill('Hello world test message')
    await page.locator('button:has-text("Send")').click()

    // Wait for streaming to complete (input becomes re-enabled)
    await page.locator('input[placeholder="Type a message..."]').waitFor({ timeout: 30_000 })

    // NOW streaming just ended. Install a per-frame tracker to capture
    // any layout shift that occurs as cacheKeys transition and measurements
    // settle. We track for 500ms to cover the settle timer window.
    const result = await page.evaluate(() => {
      return new Promise<{ maxShift: number; details: string }>((resolve) => {
        let maxShift = 0
        let details = ''
        let prevPositions: Record<string, number> = {}
        let frameCount = 0
        const MAX_FRAMES = 30 // ~500ms at 60fps

        function findScrollEl(): HTMLElement | null {
          const allEls = document.querySelectorAll<HTMLElement>('*')
          for (const el of allEls) {
            const style = window.getComputedStyle(el)
            if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
              return el
            }
          }
          return null
        }

        function track() {
          frameCount++
          if (frameCount > MAX_FRAMES) {
            resolve({ maxShift, details })
            return
          }

          const scrollEl = findScrollEl()
          if (!scrollEl) { requestAnimationFrame(track); return }

          const scrollRect = scrollEl.getBoundingClientRect()
          const nodes = scrollEl.querySelectorAll<HTMLElement>('[data-virtual-key]')
          const currentPositions: Record<string, number> = {}

          for (const node of nodes) {
            const rect = node.getBoundingClientRect()
            if (rect.bottom > scrollRect.top && rect.top < scrollRect.bottom) {
              currentPositions[node.dataset.virtualKey!] = rect.top - scrollRect.top
            }
          }

          for (const [key, top] of Object.entries(currentPositions)) {
            if (key in prevPositions) {
              const shift = Math.abs(top - prevPositions[key])
              if (shift > maxShift) {
                maxShift = shift
                details = `${key}: ${shift.toFixed(1)}px (${prevPositions[key].toFixed(1)} → ${top.toFixed(1)}) at frame ${frameCount}`
              }
            }
          }

          prevPositions = currentPositions
          requestAnimationFrame(track)
        }

        requestAnimationFrame(track)
      })
    })

    console.log(`\n=== STREAMING LAYOUT SHIFT ===`)
    console.log(`Max single-frame shift after stream end: ${result.maxShift.toFixed(1)}px`)
    if (result.details) console.log(`Worst: ${result.details}`)
    console.log()

    expect(
      result.maxShift,
      `Layout shift after streaming ended: ${result.details} (budget: 20px)`,
    ).toBeLessThanOrEqual(20)
  })

  test('scroll down reaches bottom after streaming completes', async ({ page }) => {
    // Switch to Interactive tab
    await clickTab(page, 'Interactive')
    await waitForSettle(page, 2000)

    // Send a message
    const input = page.locator('input[placeholder="Type a message..."]')
    await input.fill('Hello world test message')
    await page.locator('button:has-text("Send")').click()

    // Wait for streaming to complete (input becomes re-enabled)
    await page.locator('input[placeholder="Type a message..."]').waitFor({ timeout: 30_000 })

    // Break bottom lock and scroll up
    await breakBottomLockViaWheel(page)
    await scrollContainer(page, 'scrollBy', -300)
    // Clear any debug logs from the scroll-up
    await getVirtDebugLogs(page)
    await waitForSettle(page, 100)

    // Now scroll down incrementally and track scrollTop for rubber-banding.
    // Also capture scrollAdjustment logs — any non-zero adjustment during
    // stable-content scrolling indicates positions are changing unexpectedly
    // (the root cause of rubber-band jitter).
    const result = await page.evaluate(() => {
      return new Promise<{
        reachedBottom: boolean
        reversals: number
        maxReversal: number
        details: string
        finalDistance: number
      }>((resolve) => {
        const allEls = document.querySelectorAll<HTMLElement>('*')
        let scrollEl: HTMLElement | null = null
        for (const el of allEls) {
          const style = window.getComputedStyle(el)
          if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
            scrollEl = el
            break
          }
        }
        if (!scrollEl) {
          resolve({ reachedBottom: false, reversals: 0, maxReversal: 0, details: 'no scroll container', finalDistance: Infinity })
          return
        }

        const el = scrollEl
        const scrollHistory: number[] = [el.scrollTop]
        let reversals = 0
        let maxReversal = 0
        let step = 0
        const MAX_STEPS = 30
        const STEP_PX = 50
        const BOTTOM_THRESHOLD = 25

        function doStep() {
          step++
          if (step > MAX_STEPS) {
            const maxScroll = el.scrollHeight - el.clientHeight
            const finalDistance = maxScroll - el.scrollTop
            const reachedBottom = finalDistance <= BOTTOM_THRESHOLD
            resolve({
              reachedBottom,
              reversals,
              maxReversal,
              details: `scrollTop=${el.scrollTop.toFixed(0)}, maxScroll=${maxScroll.toFixed(0)}, distance=${finalDistance.toFixed(0)}, reversals=${reversals}`,
              finalDistance,
            })
            return
          }

          // Scroll down
          el.scrollTop += STEP_PX

          // Wait for React to process the scroll event and re-render
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const currentTop = el.scrollTop
              scrollHistory.push(currentTop)

              // Check for reversal: scrollTop went DOWN when we only scrolled UP
              if (scrollHistory.length >= 2) {
                const prev = scrollHistory[scrollHistory.length - 2]
                if (currentTop < prev - 1) { // 1px tolerance
                  reversals++
                  const reversalAmount = prev - currentTop
                  if (reversalAmount > maxReversal) {
                    maxReversal = reversalAmount
                  }
                }
              }

              doStep()
            })
          })
        }

        // Start scrolling down after a short delay
        requestAnimationFrame(doStep)
      })
    })

    // Check for scrollAdjustment logs during scroll-down
    const { maxAdjustment, logs: adjLogs } = await checkScrollAdjustmentLogs(page, 0)

    console.log(`\n=== SCROLL DOWN AFTER STREAMING ===`)
    console.log(`Reached bottom: ${result.reachedBottom}`)
    console.log(`Reversals: ${result.reversals}, max reversal: ${result.maxReversal.toFixed(1)}px`)
    console.log(`ScrollAdjustments during scroll-down: ${adjLogs.length} (max: ${maxAdjustment.toFixed(1)}px)`)
    if (adjLogs.length > 0) console.log(`Adjustment logs: ${adjLogs.join(' | ')}`)
    console.log(`Details: ${result.details}`)
    console.log()

    expect(
      result.reversals,
      `Scroll jitter detected: ${result.reversals} direction reversals (max ${result.maxReversal.toFixed(1)}px). ${result.details}`,
    ).toBe(0)

    expect(
      result.reachedBottom,
      `Could not reach bottom: ${result.details}`,
    ).toBe(true)

    // During scroll-down with stable content, no scrollAdjustment should be applied.
    // Non-zero adjustments indicate position instability (cache miss → estimate fallback).
    expect(
      maxAdjustment,
      `scrollAdjustment of ${maxAdjustment.toFixed(1)}px applied during stable-content scroll. Logs: ${adjLogs.join(' | ')}`,
    ).toBeLessThanOrEqual(1)
  })

  test('multi-message interactive conversation maintains item ordering', async ({ page }) => {
    await clickTab(page, 'Interactive')
    await waitForSettle(page, 2000)

    const ROUNDS = 4
    const allViolations: Array<{ action: string; violations: Violation[] }> = []

    for (let round = 0; round < ROUNDS; round++) {
      // Send a message
      const input = page.locator('input[placeholder="Type a message..."]')
      await input.fill(`Test message round ${round}`)
      await page.locator('button:has-text("Send")').click()

      // While streaming (input disabled), scroll around and check invariants
      const disabledInput = page.locator('input[placeholder="Waiting for response..."]')
      const streamingStarted = await disabledInput.isVisible({ timeout: 3000 }).catch(() => false)

      if (streamingStarted) {
        // Scroll actions during streaming
        for (let action = 0; action < 5; action++) {
          await waitForSettle(page, 200)

          const roll = Math.random()
          let actionLabel = ''
          if (roll < 0.3) {
            await breakBottomLockViaWheel(page)
            actionLabel = 'breakBottomLock'
          } else if (roll < 0.5) {
            const delta = -200 - Math.floor(Math.random() * 400)
            actionLabel = await scrollContainer(page, 'scrollBy', delta)
          } else if (roll < 0.7) {
            const delta = 100 + Math.floor(Math.random() * 300)
            actionLabel = await scrollContainer(page, 'scrollBy', delta)
          } else if (roll < 0.85) {
            actionLabel = await scrollContainer(page, 'scrollToBottom')
          } else {
            actionLabel = await scrollContainer(page, 'scrollTo')
          }

          await waitForSettle(page, 200)
          const violations = await checkInvariants(page)
          if (violations.length > 0) {
            allViolations.push({
              action: `[round ${round}, streaming, action ${action}] ${actionLabel}`,
              violations,
            })
          }
        }
      }

      // Wait for streaming to complete
      await page.locator('input[placeholder="Type a message..."]').waitFor({ timeout: 30_000 })
      await waitForSettle(page, 500)

      // Check invariants after streaming
      const postStreamViolations = await checkInvariants(page)
      if (postStreamViolations.length > 0) {
        allViolations.push({
          action: `[round ${round}] post-stream`,
          violations: postStreamViolations,
        })
      }

      // Scroll to random position
      await breakBottomLockViaWheel(page)
      await waitForSettle(page, 200)
      await scrollContainer(page, 'scrollTo')
      await waitForSettle(page, 500)
      const scrollViolations = await checkInvariants(page)
      if (scrollViolations.length > 0) {
        allViolations.push({
          action: `[round ${round}] post-scroll`,
          violations: scrollViolations,
        })
      }

      // Scroll back to bottom for next message
      await scrollContainer(page, 'scrollToBottom')
      await waitForSettle(page, 500)
      const bottomViolations = await checkInvariants(page)
      if (bottomViolations.length > 0) {
        allViolations.push({
          action: `[round ${round}] at-bottom`,
          violations: bottomViolations,
        })
      }
    }

    // Final pass: scroll through entire content checking invariants
    await breakBottomLockViaWheel(page)
    await waitForSettle(page, 200)
    await scrollContainer(page, 'scrollToTop')
    await waitForSettle(page, 500)

    const totalHeight = await page.evaluate(() => {
      const allEls = document.querySelectorAll<HTMLElement>('*')
      for (const el of allEls) {
        const style = window.getComputedStyle(el)
        if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
          return el.scrollHeight
        }
      }
      return 0
    })

    for (let pos = 0; pos < totalHeight; pos += 400) {
      await scrollContainer(page, 'scrollTo', pos)
      await waitForSettle(page, 200)
      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({
          action: `[final-pass] scrollTo(${pos})`,
          violations,
        })
      }
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== MULTI-MESSAGE VIOLATIONS (${allViolations.length}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('aggressive scroll during streaming maintains invariants', async ({ page }) => {
    await clickTab(page, 'Interactive')
    await waitForSettle(page, 2000)

    const allViolations: Array<{ action: string; violations: Violation[] }> = []

    for (let msgRound = 0; msgRound < 2; msgRound++) {
      // Send a message
      const input = page.locator('input[placeholder="Type a message..."]')
      await input.fill(`Aggressive test round ${msgRound}`)
      await page.locator('button:has-text("Send")').click()

      // Aggressively scroll during streaming
      const disabledInput = page.locator('input[placeholder="Waiting for response..."]')
      const streamingStarted = await disabledInput.isVisible({ timeout: 3000 }).catch(() => false)

      if (streamingStarted) {
        for (let action = 0; action < 20; action++) {
          const roll = Math.random()
          let actionLabel = ''

          if (roll < 0.15) {
            await breakBottomLockViaWheel(page)
            actionLabel = 'breakBottomLock'
          } else if (roll < 0.3) {
            actionLabel = await scrollContainer(page, 'scrollToBottom')
          } else if (roll < 0.45) {
            actionLabel = await scrollContainer(page, 'scrollToTop')
          } else if (roll < 0.7) {
            actionLabel = await scrollContainer(page, 'scrollTo')
          } else {
            const delta = Math.floor(Math.random() * 1000) - 500
            actionLabel = await scrollContainer(page, 'scrollBy', delta)
          }

          await waitForSettle(page, 150)
          const violations = await checkInvariants(page)
          if (violations.length > 0) {
            allViolations.push({
              action: `[msg ${msgRound}, streaming action ${action}] ${actionLabel}`,
              violations,
            })
          }

          // Check if streaming is done
          const stillStreaming = await disabledInput.isVisible().catch(() => false)
          if (!stillStreaming) break
        }
      }

      // Wait for streaming to complete
      await page.locator('input[placeholder="Type a message..."]').waitFor({ timeout: 30_000 })
      await waitForSettle(page, 500)

      // Post-stream: break lock, scroll to top, incrementally scroll down
      await breakBottomLockViaWheel(page)
      await waitForSettle(page, 200)
      await scrollContainer(page, 'scrollToTop')
      await waitForSettle(page, 300)

      const scrollHeight = await page.evaluate(() => {
        const allEls = document.querySelectorAll<HTMLElement>('*')
        for (const el of allEls) {
          const style = window.getComputedStyle(el)
          if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
            return el.scrollHeight
          }
        }
        return 0
      })

      for (let pos = 0; pos < scrollHeight; pos += 300) {
        await scrollContainer(page, 'scrollTo', pos)
        await waitForSettle(page, 150)
        const violations = await checkInvariants(page)
        if (violations.length > 0) {
          allViolations.push({
            action: `[msg ${msgRound}, scan pos ${pos}]`,
            violations,
          })
        }
      }

      // Scroll back to bottom for next message
      await scrollContainer(page, 'scrollToBottom')
      await waitForSettle(page, 500)
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== AGGRESSIVE SCROLL VIOLATIONS (${allViolations.length}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('send message then tab switch round-trip during streaming', async ({ page }) => {
    const allViolations: Array<{ action: string; violations: Violation[] }> = []
    const staticTabs = ['Session A', 'Session B', 'Session C']

    // Switch to Interactive tab and let it settle
    await clickTab(page, 'Interactive')
    await waitForSettle(page, 2000)

    for (let round = 0; round < 3; round++) {
      const targetTab = staticTabs[round % staticTabs.length]

      // Send a message
      const input = page.locator('input[placeholder="Type a message..."]')
      await input.fill(`Tab switch test round ${round}`)
      await page.locator('button:has-text("Send")').click()

      // Wait a bit for streaming to start
      await waitForSettle(page, 500)

      // Capture item positions before switching away
      const positionsBefore = await captureAllItemPositions(page)

      // Switch away to a static tab
      await clickTab(page, targetTab)
      await waitForSettle(page, 800)

      // Check invariants on the static tab
      const staticViolations = await checkInvariants(page)
      if (staticViolations.length > 0) {
        allViolations.push({ action: `[round ${round}] on-static-tab(${targetTab})`, violations: staticViolations })
      }

      // Wait varying amounts to catch different streaming states
      await waitForSettle(page, 500 + round * 1500)

      // Frame-level jank monitor: installs rAF monitor BEFORE click, then switches
      // This catches items at estimated positions on frame 1 → corrected on frame 2
      const jankViolations = await monitorTabSwitchJank(page, 'Interactive', { frames: 40, thresholdPx: 5 })
      if (jankViolations.length > 0) {
        allViolations.push({ action: `[round ${round}] frame-jank-on-return`, violations: jankViolations })
      }

      // Check visual stability over 2s — catches slower correction drifts
      const stabilityViolations = await checkVisualStability(page, 2000, 5)
      if (stabilityViolations.length > 0) {
        allViolations.push({ action: `[round ${round}] visual-stability-on-return`, violations: stabilityViolations })
      }

      // Check position preservation — items that existed before should still be at same relative positions
      const positionsAfter = await captureAllItemPositions(page)
      const preservationViolations = checkPositionPreservation(positionsBefore.items, positionsAfter.items, 15)
      if (preservationViolations.length > 0) {
        allViolations.push({ action: `[round ${round}] position-preservation`, violations: preservationViolations })
      }

      // Structural invariants
      const returnViolations = await checkInvariants(page)
      if (returnViolations.length > 0) {
        allViolations.push({ action: `[round ${round}] return-to-interactive`, violations: returnViolations })
      }

      // Wait for streaming to complete if still going
      try {
        await page.locator('input[placeholder="Type a message..."]').waitFor({ timeout: 15_000 })
      } catch {
        // Streaming might already be done
      }
      await waitForSettle(page, 500)

      // Post-stream invariant check
      const postStreamViolations = await checkInvariants(page)
      if (postStreamViolations.length > 0) {
        allViolations.push({ action: `[round ${round}] post-stream-settle`, violations: postStreamViolations })
      }

      // Full content scan
      await breakBottomLockViaWheel(page)
      await waitForSettle(page, 200)
      await scrollContainer(page, 'scrollToTop')
      await waitForSettle(page, 300)

      const scrollHeight = await page.evaluate(() => {
        const allEls = document.querySelectorAll<HTMLElement>('*')
        for (const el of allEls) {
          const style = window.getComputedStyle(el)
          if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
            return el.scrollHeight
          }
        }
        return 0
      })

      for (let pos = 0; pos < scrollHeight; pos += 500) {
        await scrollContainer(page, 'scrollTo', pos)
        await waitForSettle(page, 150)
        const violations = await checkInvariants(page)
        if (violations.length > 0) {
          allViolations.push({ action: `[round ${round}] scan pos=${pos}`, violations })
        }
      }

      // Scroll back to bottom for next round
      await scrollContainer(page, 'scrollToBottom')
      await waitForSettle(page, 500)
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== TAB SWITCH DURING STREAMING VIOLATIONS (${allViolations.length}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('rapid tab switching while interactive tab streams', async ({ page }) => {
    const allViolations: Array<{ action: string; violations: Violation[] }> = []
    const allTabs = ['Session A', 'Session B', 'Session C', 'Interactive']

    // Switch to Interactive tab
    await clickTab(page, 'Interactive')
    await waitForSettle(page, 2000)

    // Send a message to start streaming
    const input = page.locator('input[placeholder="Type a message..."]')
    await input.fill('Rapid tab switch test')
    await page.locator('button:has-text("Send")').click()
    await waitForSettle(page, 300)

    // Rapidly switch between all tabs during streaming
    for (let i = 0; i < 20; i++) {
      const tab = allTabs[i % allTabs.length]
      await clickTab(page, tab)
      await waitForSettle(page, 200 + Math.floor(Math.random() * 300))

      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({ action: `[rapid ${i}] switchTo(${tab})`, violations })
      }
    }

    // End on Interactive tab — frame-level jank monitor on final return
    const jankViolations = await monitorTabSwitchJank(page, 'Interactive', { frames: 40, thresholdPx: 5 })
    if (jankViolations.length > 0) {
      allViolations.push({ action: '[post-rapid] frame-jank', violations: jankViolations })
    }

    // Also check slower stability drifts
    const stabilityViolations = await checkVisualStability(page, 2000, 5)
    if (stabilityViolations.length > 0) {
      allViolations.push({ action: '[post-rapid] visual-stability', violations: stabilityViolations })
    }

    // Wait for streaming to complete
    try {
      await page.locator('input[placeholder="Type a message..."]').waitFor({ timeout: 15_000 })
    } catch {
      // Already done
    }
    await waitForSettle(page, 500)

    // Full scan after streaming completes
    const postViolations = await checkInvariants(page)
    if (postViolations.length > 0) {
      allViolations.push({ action: '[post-rapid] settle', violations: postViolations })
    }

    // Scan entire content
    await breakBottomLockViaWheel(page)
    await waitForSettle(page, 200)
    await scrollContainer(page, 'scrollToTop')
    await waitForSettle(page, 300)

    const scrollHeight = await page.evaluate(() => {
      const allEls = document.querySelectorAll<HTMLElement>('*')
      for (const el of allEls) {
        const style = window.getComputedStyle(el)
        if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
          return el.scrollHeight
        }
      }
      return 0
    })

    for (let pos = 0; pos < scrollHeight; pos += 400) {
      await scrollContainer(page, 'scrollTo', pos)
      await waitForSettle(page, 150)
      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({ action: `[post-rapid scan] pos=${pos}`, violations })
      }
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== RAPID TAB SWITCH DURING STREAMING VIOLATIONS (${allViolations.length}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('tab switch after streaming completes preserves layout', async ({ page }) => {
    const allViolations: Array<{ action: string; violations: Violation[] }> = []
    const LAYOUT_SHIFT_TOLERANCE_PX = 5

    // Switch to Interactive and send a message
    await clickTab(page, 'Interactive')
    await waitForSettle(page, 2000)

    const input = page.locator('input[placeholder="Type a message..."]')
    await input.fill('Post-stream tab switch test')
    await page.locator('button:has-text("Send")').click()

    // Wait for streaming to complete
    await page.locator('input[placeholder="Type a message..."]').waitFor({ timeout: 30_000 })
    await waitForSettle(page, 1000)

    // Break bottom lock, scroll to a mid-point, let it settle
    await breakBottomLockViaWheel(page)
    await waitForSettle(page, 300)
    await scrollContainer(page, 'scrollTo', 3000)
    await waitForSettle(page, 1000)

    // Capture positions and anchor
    const anchorBefore = await captureViewportAnchor(page)
    const positionsBefore = await captureVisibleItemPositions(page)

    // Round-trip to each static tab
    for (const targetTab of ['Session A', 'Session B', 'Session C']) {
      await clickTab(page, targetTab)
      await waitForSettle(page, 800)

      // Frame-level jank monitor during tab switch back
      const jankViolations = await monitorTabSwitchJank(page, 'Interactive', { frames: 40, thresholdPx: 5 })
      if (jankViolations.length > 0) {
        allViolations.push({ action: `round-trip(Interactive→${targetTab}→Interactive) frame-jank`, violations: jankViolations })
      }

      const stabilityViolations = await checkVisualStability(page, 1500, 5)
      if (stabilityViolations.length > 0) {
        allViolations.push({ action: `round-trip(Interactive→${targetTab}→Interactive) visual-stability`, violations: stabilityViolations })
      }

      // Check structural invariants
      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({ action: `round-trip(Interactive→${targetTab}→Interactive)`, violations })
      }

      // Check scroll position stability
      const anchorAfter = await captureViewportAnchor(page)
      if (anchorBefore && anchorAfter) {
        let shift = 0
        if (anchorBefore.key === anchorAfter.key) {
          shift = Math.abs(anchorAfter.offsetFromViewportTop - anchorBefore.offsetFromViewportTop)
        } else {
          shift = Math.abs(anchorAfter.scrollTop - anchorBefore.scrollTop)
        }
        if (shift > LAYOUT_SHIFT_TOLERANCE_PX) {
          allViolations.push({
            action: `round-trip(Interactive→${targetTab}→Interactive)`,
            violations: [{
              invariant: 'interactive-layout-shift',
              details: `Scroll shift ${shift.toFixed(1)}px after round-trip (key: ${anchorBefore.key}→${anchorAfter.key}, ` +
                `scrollTop: ${anchorBefore.scrollTop.toFixed(0)}→${anchorAfter.scrollTop.toFixed(0)})`,
            }],
          })
        }
      }

      // Check visible item position stability
      const positionsAfter = await captureVisibleItemPositions(page)
      for (const [key, before] of Object.entries(positionsBefore)) {
        const after = positionsAfter[key]
        if (after) {
          const topShift = Math.abs(after.top - before.top)
          if (topShift > LAYOUT_SHIFT_TOLERANCE_PX) {
            allViolations.push({
              action: `round-trip(Interactive→${targetTab}→Interactive)`,
              violations: [{
                invariant: 'item-position-shift',
                details: `"${key}" shifted ${topShift.toFixed(1)}px (${before.top.toFixed(1)}→${after.top.toFixed(1)})`,
              }],
            })
            break
          }
        }
      }
    }

    // Now test from locked-to-bottom state
    await scrollContainer(page, 'scrollToBottom')
    await waitForSettle(page, 500)

    for (const targetTab of ['Session A', 'Session B']) {
      await clickTab(page, targetTab)
      await waitForSettle(page, 800)
      await clickTab(page, 'Interactive')
      await waitForSettle(page, 1500)

      // Should still be at bottom (locked-to-bottom restore)
      const isAtBottom = await page.evaluate(() => {
        const allEls = document.querySelectorAll<HTMLElement>('*')
        for (const el of allEls) {
          const style = window.getComputedStyle(el)
          if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
            return el.scrollHeight - el.scrollTop - el.clientHeight < 30
          }
        }
        return false
      })
      if (!isAtBottom) {
        allViolations.push({
          action: `bottom-roundtrip(Interactive→${targetTab}→Interactive)`,
          violations: [{
            invariant: 'locked-to-bottom-restore',
            details: 'Was locked-to-bottom before switch but not at bottom after return',
          }],
        })
      }

      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({ action: `bottom-roundtrip(Interactive→${targetTab}→Interactive)`, violations })
      }
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== POST-STREAM TAB SWITCH VIOLATIONS (${allViolations.length}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('switch away during streaming, stream completes while away, switch back', async ({ page }) => {
    const allViolations: Array<{ action: string; violations: Violation[] }> = []

    // Switch to Interactive tab
    await clickTab(page, 'Interactive')
    await waitForSettle(page, 2000)

    // Send a message
    const input = page.locator('input[placeholder="Type a message..."]')
    await input.fill('Stream finishes while away')
    await page.locator('button:has-text("Send")').click()
    await waitForSettle(page, 300)

    // Switch away immediately
    await clickTab(page, 'Session A')
    await waitForSettle(page, 500)

    // Wait long enough for streaming to definitely complete (streams are ~4-7s)
    await waitForSettle(page, 8000)

    // Check static tab is fine
    const staticViolations = await checkInvariants(page)
    if (staticViolations.length > 0) {
      allViolations.push({ action: 'on-static-while-stream-completes', violations: staticViolations })
    }

    // Switch back — frame-level jank monitor catches first-frame position errors
    const jankViolations = await monitorTabSwitchJank(page, 'Interactive', { frames: 40, thresholdPx: 5 })
    if (jankViolations.length > 0) {
      allViolations.push({ action: 'return-frame-jank', violations: jankViolations })
    }

    const stabilityViolations = await checkVisualStability(page, 2000, 5)
    if (stabilityViolations.length > 0) {
      allViolations.push({ action: 'return-visual-stability', violations: stabilityViolations })
    }

    // Check invariants after return
    const returnViolations = await checkInvariants(page)
    if (returnViolations.length > 0) {
      allViolations.push({ action: 'return-after-stream-completed', violations: returnViolations })
    }

    // Check for stale streaming data — the data pipeline should have reconciled
    // missed events, so no items should have :streaming cacheKeys
    const staleViolations = await checkStaleStreamingData(page)
    if (staleViolations.length > 0) {
      allViolations.push({ action: 'return-stale-streaming-check', violations: staleViolations })
    }

    // The streamed message should be fully rendered — verify input is available
    const inputAvailable = await page.locator('input[placeholder="Type a message..."]').isVisible().catch(() => false)
    if (!inputAvailable) {
      // Wait a bit more
      try {
        await page.locator('input[placeholder="Type a message..."]').waitFor({ timeout: 5000 })
      } catch {
        allViolations.push({
          action: 'return-after-stream-completed',
          violations: [{ invariant: 'stream-state-restore', details: 'Input still showing streaming state after stream should have completed' }],
        })
      }
    }

    // Full scan of content
    await breakBottomLockViaWheel(page)
    await waitForSettle(page, 200)
    await scrollContainer(page, 'scrollToTop')
    await waitForSettle(page, 300)

    const scrollHeight = await page.evaluate(() => {
      const allEls = document.querySelectorAll<HTMLElement>('*')
      for (const el of allEls) {
        const style = window.getComputedStyle(el)
        if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
          return el.scrollHeight
        }
      }
      return 0
    })

    for (let pos = 0; pos < scrollHeight; pos += 400) {
      await scrollContainer(page, 'scrollTo', pos)
      await waitForSettle(page, 150)
      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({ action: `full-scan pos=${pos}`, violations })
      }
    }

    // Send another message to verify interactive tab still works
    await scrollContainer(page, 'scrollToBottom')
    await waitForSettle(page, 500)

    const input2 = page.locator('input[placeholder="Type a message..."]')
    const canType = await input2.isVisible().catch(() => false)
    if (canType) {
      await input2.fill('Second message after return')
      await page.locator('button:has-text("Send")').click()

      try {
        await page.locator('input[placeholder="Type a message..."]').waitFor({ timeout: 15_000 })
      } catch {
        // Timeout is acceptable
      }
      await waitForSettle(page, 500)

      const postSecondViolations = await checkInvariants(page)
      if (postSecondViolations.length > 0) {
        allViolations.push({ action: 'second-message-after-return', violations: postSecondViolations })
      }
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== STREAM-COMPLETES-WHILE-AWAY VIOLATIONS (${allViolations.length}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('data pipeline reconciles missed events after tab switch', async ({ page }) => {
    // This test specifically validates the fix for events lost during tab switch.
    // Scenario: send message → switch away → streaming completes (events pushed
    // to source but no listener) → switch back → verify data pipeline caught up.
    const allViolations: Array<{ action: string; violations: Violation[] }> = []

    await clickTab(page, 'Interactive')
    await waitForSettle(page, 2000)

    // Send 3 messages, switching tabs each time during streaming
    for (let round = 0; round < 3; round++) {
      const input = page.locator('input[placeholder="Type a message..."]')
      await input.fill(`Reconciliation test ${round}`)
      await page.locator('button:has-text("Send")').click()
      await waitForSettle(page, 300)

      // Switch away immediately — streaming will complete while we're on another tab
      await clickTab(page, 'Session A')

      // Wait for streaming to definitely complete (streams are ~2-4s in example app)
      await waitForSettle(page, 6000)

      // Switch back to Interactive
      await clickTab(page, 'Interactive')
      await waitForSettle(page, 2000)

      // Key assertion: the data pipeline should have reconciled missed events.
      // After reconciliation + settle, no items should have stale :streaming cacheKeys.
      const staleCheck = await page.evaluate(() => {
        const nodes = document.querySelectorAll<HTMLElement>('[data-virtual-cache-key]')
        const staleItems: string[] = []
        for (const node of nodes) {
          const ck = node.dataset.virtualCacheKey ?? ''
          if (ck.endsWith(':streaming')) {
            staleItems.push(`${node.dataset.virtualKey} (cacheKey: ${ck})`)
          }
        }
        return staleItems
      })

      if (staleCheck.length > 0) {
        allViolations.push({
          action: `[round ${round}] stale-streaming-after-reconcile`,
          violations: [{
            invariant: 'data-reconciliation',
            details: `${staleCheck.length} items still have :streaming cacheKey after tab return: ${staleCheck.slice(0, 3).join(', ')}`,
          }],
        })
      }

      // The input should be enabled (streaming completed while away)
      const inputReady = await page.locator('input[placeholder="Type a message..."]').isVisible().catch(() => false)
      if (!inputReady) {
        // If still streaming, wait more
        try {
          await page.locator('input[placeholder="Type a message..."]').waitFor({ timeout: 5000 })
        } catch {
          allViolations.push({
            action: `[round ${round}] stream-state`,
            violations: [{
              invariant: 'data-reconciliation',
              details: 'Input still in streaming state — data pipeline did not reconcile message_end event',
            }],
          })
        }
      }

      // Full structural invariants
      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({ action: `[round ${round}] post-return`, violations })
      }

      // Send another message to verify pipeline is still functional
      if (round < 2) {
        await scrollContainer(page, 'scrollToBottom')
        await waitForSettle(page, 300)
      }
    }

    // Final: full content scan
    await breakBottomLockViaWheel(page)
    await waitForSettle(page, 200)
    await scrollContainer(page, 'scrollToTop')
    await waitForSettle(page, 300)

    const scrollHeight = await page.evaluate(() => {
      for (const el of document.querySelectorAll<HTMLElement>('*')) {
        const s = getComputedStyle(el)
        if ((s.overflow === 'auto' || s.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
          return el.scrollHeight
        }
      }
      return 0
    })

    for (let pos = 0; pos < scrollHeight; pos += 500) {
      await scrollContainer(page, 'scrollTo', pos)
      await waitForSettle(page, 150)
      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({ action: `[final-scan] pos=${pos}`, violations })
      }
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== DATA RECONCILIATION VIOLATIONS (${allViolations.length}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })

  test('heavy multi-round send + tab switch + scroll stress', { timeout: 180_000 }, async ({ page }) => {
    const allViolations: Array<{ action: string; violations: Violation[] }> = []
    const staticTabs = ['Session A', 'Session B', 'Session C']

    // Matches exact user scenario: send many messages, switch tabs between rounds,
    // scroll around, accumulate state. 6 rounds to stress the measurement cache
    // and materializer window.
    await clickTab(page, 'Interactive')
    await waitForSettle(page, 2000)

    for (let round = 0; round < 6; round++) {
      // Send a message
      const input = page.locator('input[placeholder="Type a message..."]')
      await input.fill(`Heavy stress round ${round}`)
      await page.locator('button:has-text("Send")').click()

      // Randomly: wait for stream or switch tabs immediately
      if (round % 2 === 0) {
        // Switch tabs during streaming
        await waitForSettle(page, 200 + Math.floor(Math.random() * 500))
        const targetTab = staticTabs[round % staticTabs.length]

        // Frame-level jank monitor on each tab switch
        // Use 50px threshold for stress test — normal estimation errors during
        // snapshot→live transition can produce 30-50px corrections for items
        // outside the snapshot's rendered range.
        const jankToStatic = await monitorTabSwitchJank(page, targetTab, { frames: 20, thresholdPx: 50 })
        if (jankToStatic.length > 0) {
          allViolations.push({ action: `[round ${round}] jank-to-${targetTab}`, violations: jankToStatic })
        }

        // Scroll around on static tab
        await breakBottomLockViaWheel(page)
        await waitForSettle(page, 200)
        await scrollContainer(page, 'scrollTo')
        await waitForSettle(page, 300)

        const staticV = await checkInvariants(page)
        if (staticV.length > 0) {
          allViolations.push({ action: `[round ${round}] on-${targetTab}`, violations: staticV })
        }

        // Wait varying amounts (some rounds: stream finishes while away)
        await waitForSettle(page, round < 3 ? 500 : 6000)

        // Switch back — this is where jank/spawning bugs occur
        const jankBack = await monitorTabSwitchJank(page, 'Interactive', { frames: 40, thresholdPx: 50 })
        if (jankBack.length > 0) {
          allViolations.push({ action: `[round ${round}] jank-return`, violations: jankBack })
        }
      } else {
        // Stay on Interactive tab during streaming but scroll aggressively
        for (let a = 0; a < 5; a++) {
          const roll = Math.random()
          if (roll < 0.3) await breakBottomLockViaWheel(page)
          else if (roll < 0.6) await scrollContainer(page, 'scrollTo')
          else if (roll < 0.8) await scrollContainer(page, 'scrollToBottom')
          else await scrollContainer(page, 'scrollBy', Math.floor(Math.random() * 800) - 400)
          await waitForSettle(page, 150)
        }
      }

      // Wait for streaming to complete
      try {
        await page.locator('input[placeholder="Type a message..."]').waitFor({ timeout: 15_000 })
      } catch {}
      // Extra settle for the async materializer to process message_end
      // (there's a microtask gap between setIsResponding and setMaterializedItems)
      await waitForSettle(page, 1500)

      // Check invariants after each round
      const postV = await checkInvariants(page)
      if (postV.length > 0) {
        allViolations.push({ action: `[round ${round}] post-stream`, violations: postV })
      }

      // Check for stale streaming data after streaming ends
      const staleV = await checkStaleStreamingData(page)
      if (staleV.length > 0) {
        allViolations.push({ action: `[round ${round}] stale-streaming-post-stream`, violations: staleV })
      }

      // Quick scan: scroll to a random position and check
      await breakBottomLockViaWheel(page)
      await waitForSettle(page, 150)
      await scrollContainer(page, 'scrollTo')
      await waitForSettle(page, 300)
      const scanV = await checkInvariants(page)
      if (scanV.length > 0) {
        allViolations.push({ action: `[round ${round}] random-scroll-check`, violations: scanV })
      }

      // Return to bottom for next message
      await scrollContainer(page, 'scrollToBottom')
      await waitForSettle(page, 300)
    }

    // Final: comprehensive scan of ALL content
    await breakBottomLockViaWheel(page)
    await waitForSettle(page, 200)
    await scrollContainer(page, 'scrollToTop')
    await waitForSettle(page, 500)

    const totalHeight = await page.evaluate(() => {
      const allEls = document.querySelectorAll<HTMLElement>('*')
      for (const el of allEls) {
        const style = window.getComputedStyle(el)
        if ((style.overflow === 'auto' || style.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
          return el.scrollHeight
        }
      }
      return 0
    })

    for (let pos = 0; pos < totalHeight; pos += 300) {
      await scrollContainer(page, 'scrollTo', pos)
      await waitForSettle(page, 100)
      const violations = await checkInvariants(page)
      if (violations.length > 0) {
        allViolations.push({ action: `[final-scan] pos=${pos}`, violations })
      }
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 30)
        .map((v) => `${v.action}: ${v.violations.map((x) => `${x.invariant} — ${x.details}`).join('; ')}`)
        .join('\n')
      console.log(`\n=== HEAVY STRESS VIOLATIONS (${allViolations.length}) ===\n${summary}\n`)
    }

    expect(allViolations).toHaveLength(0)
  })
})
