import type { DebugInfo } from './types'

// ─── Types ───────────────────────────────────────────────────

export interface FuzzTestViolation {
  action: string
  invariant: string
  details: string
}

export interface FuzzTestReport {
  totalActions: number
  violations: FuzzTestViolation[]
}

interface FuzzTestOptions {
  actionCount?: number
  settleDelayMs?: number
  onProgress?: (completed: number, total: number) => void
  onViolation?: (violation: FuzzTestViolation) => void
  signal?: AbortSignal
}

// ─── Helpers ─────────────────────────────────────────────────

function waitForFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function waitForMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function settle(ms: number): Promise<void> {
  await waitForFrame()
  await waitForMs(ms)
  await waitForFrame()
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

// ─── Invariant checks ───────────────────────────────────────

interface RenderedItem {
  key: string
  offset: number
  size: number
}

function getRenderedItems(scrollContainer: HTMLElement): RenderedItem[] {
  const nodes = scrollContainer.querySelectorAll<HTMLElement>('[data-virtual-key]')
  const scrollRect = scrollContainer.getBoundingClientRect()
  const items: RenderedItem[] = []

  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    const offset = scrollContainer.scrollTop + (rect.top - scrollRect.top)
    items.push({
      key: node.dataset.virtualKey ?? '',
      offset,
      size: rect.height,
    })
  }

  items.sort((a, b) => a.offset - b.offset)
  return items
}

function getSpacerHeight(scrollContainer: HTMLElement): number | null {
  const spacer = scrollContainer.querySelector<HTMLElement>(':scope > div')
  if (!spacer) return null
  return spacer.getBoundingClientRect().height
}

function checkMonotonicOffsets(items: RenderedItem[]): FuzzTestViolation | null {
  for (let i = 1; i < items.length; i++) {
    if (items[i].offset < items[i - 1].offset) {
      return {
        action: '',
        invariant: 'monotonic-offsets',
        details:
          `Item "${items[i].key}" offset ${items[i].offset.toFixed(1)} ` +
          `is less than previous item "${items[i - 1].key}" offset ${items[i - 1].offset.toFixed(1)}`,
      }
    }
  }
  return null
}

function checkNoOverlap(items: RenderedItem[]): FuzzTestViolation | null {
  const TOLERANCE = 2
  for (let i = 0; i < items.length - 1; i++) {
    const endOfCurrent = items[i].offset + items[i].size
    const startOfNext = items[i + 1].offset
    if (endOfCurrent > startOfNext + TOLERANCE) {
      return {
        action: '',
        invariant: 'no-overlap',
        details:
          `Item "${items[i].key}" ends at ${endOfCurrent.toFixed(1)} ` +
          `but next item "${items[i + 1].key}" starts at ${startOfNext.toFixed(1)} ` +
          `(overlap: ${(endOfCurrent - startOfNext).toFixed(1)}px, tolerance: ${TOLERANCE}px)`,
      }
    }
  }
  return null
}

function checkScrollOffsetAgreement(
  scrollContainer: HTMLElement,
  debugInfo: DebugInfo | null,
): FuzzTestViolation | null {
  if (!debugInfo) return null

  const domScrollTop = scrollContainer.scrollTop
  const coreOffset = debugInfo.coreScrollOffset
  const delta = Math.abs(domScrollTop - coreOffset)
  const TOLERANCE = 5

  if (delta > TOLERANCE) {
    return {
      action: '',
      invariant: 'scroll-offset-agreement',
      details:
        `DOM scrollTop (${domScrollTop.toFixed(1)}) and core offset (${coreOffset.toFixed(1)}) ` +
        `differ by ${delta.toFixed(1)}px (tolerance: ${TOLERANCE}px)`,
    }
  }
  return null
}

function checkPositiveHeights(scrollContainer: HTMLElement): FuzzTestViolation | null {
  const nodes = scrollContainer.querySelectorAll<HTMLElement>('[data-virtual-key]')
  for (const node of nodes) {
    const height = node.getBoundingClientRect().height
    if (height <= 0) {
      return {
        action: '',
        invariant: 'positive-height',
        details:
          `Item "${node.dataset.virtualKey}" has non-positive height: ${height}`,
      }
    }
  }
  return null
}

function checkSpacerHeight(scrollContainer: HTMLElement): FuzzTestViolation | null {
  const spacerHeight = getSpacerHeight(scrollContainer)
  if (spacerHeight === null) return null

  if (spacerHeight <= 0) {
    return {
      action: '',
      invariant: 'spacer-positive',
      details: `Spacer div has non-positive height: ${spacerHeight}`,
    }
  }
  return null
}

function checkItemsWithinSpacer(
  items: RenderedItem[],
  scrollContainer: HTMLElement,
): FuzzTestViolation | null {
  const spacerHeight = getSpacerHeight(scrollContainer)
  if (spacerHeight === null || items.length === 0) return null

  const TOLERANCE = 50
  for (const item of items) {
    const itemEnd = item.offset + item.size
    if (itemEnd > spacerHeight + TOLERANCE) {
      return {
        action: '',
        invariant: 'items-within-spacer',
        details:
          `Item "${item.key}" extends to ${itemEnd.toFixed(1)} ` +
          `but spacer height is ${spacerHeight.toFixed(1)} ` +
          `(exceeds by ${(itemEnd - spacerHeight).toFixed(1)}px, tolerance: ${TOLERANCE}px)`,
      }
    }
  }
  return null
}

function runAllInvariantChecks(
  scrollContainer: HTMLElement,
  debugInfo: DebugInfo | null,
  actionLabel: string,
): FuzzTestViolation[] {
  const items = getRenderedItems(scrollContainer)
  const violations: FuzzTestViolation[] = []

  const checks = [
    checkMonotonicOffsets(items),
    checkNoOverlap(items),
    checkScrollOffsetAgreement(scrollContainer, debugInfo),
    checkPositiveHeights(scrollContainer),
    checkSpacerHeight(scrollContainer),
    checkItemsWithinSpacer(items, scrollContainer),
  ]

  for (const violation of checks) {
    if (violation) {
      violations.push({ ...violation, action: actionLabel })
    }
  }

  return violations
}

// ─── Fuzz actions ────────────────────────────────────────────

type FuzzAction = (scrollContainer: HTMLElement) => string

function scrollToRandomOffset(scrollContainer: HTMLElement): string {
  const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight
  const target = Math.floor(Math.random() * Math.max(0, maxScroll))
  scrollContainer.scrollTop = target
  return `scrollTo(${target})`
}

function scrollToTop(scrollContainer: HTMLElement): string {
  scrollContainer.scrollTop = 0
  return 'scrollTo(0) [top]'
}

function scrollToBottom(scrollContainer: HTMLElement): string {
  scrollContainer.scrollTop = scrollContainer.scrollHeight
  return `scrollTo(${scrollContainer.scrollHeight}) [bottom]`
}

function dispatchWheelEvent(scrollContainer: HTMLElement): string {
  const deltaY = randomFloat(-800, 800)
  const event = new WheelEvent('wheel', {
    deltaY,
    bubbles: true,
    cancelable: true,
  })
  scrollContainer.dispatchEvent(event)
  return `wheel(deltaY=${deltaY.toFixed(0)})`
}

function clickRandomAccordion(scrollContainer: HTMLElement): string {
  const buttons = scrollContainer.querySelectorAll<HTMLButtonElement>('button')
  if (buttons.length === 0) {
    return 'click-accordion(none found)'
  }
  const index = randomInt(0, buttons.length - 1)
  buttons[index].click()
  return `click-accordion(button[${index}] of ${buttons.length})`
}

const FUZZ_ACTIONS: FuzzAction[] = [
  scrollToRandomOffset,
  scrollToRandomOffset,
  scrollToRandomOffset,
  scrollToTop,
  scrollToBottom,
  dispatchWheelEvent,
  dispatchWheelEvent,
  clickRandomAccordion,
]

function pickRandomAction(): FuzzAction {
  return FUZZ_ACTIONS[randomInt(0, FUZZ_ACTIONS.length - 1)]
}

// ─── Main entry point ───────────────────────────────────────

export async function runVirtualizerFuzzTest(
  scrollContainer: HTMLElement,
  getDebugInfo: () => DebugInfo | null,
  options?: FuzzTestOptions,
): Promise<FuzzTestReport> {
  const actionCount = options?.actionCount ?? 200
  const settleDelayMs = options?.settleDelayMs ?? 50
  const violations: FuzzTestViolation[] = []

  for (let i = 0; i < actionCount; i++) {
    if (options?.signal?.aborted) break

    const action = pickRandomAction()
    const actionLabel = action(scrollContainer)

    await settle(settleDelayMs)

    const debugInfo = getDebugInfo()
    const newViolations = runAllInvariantChecks(scrollContainer, debugInfo, actionLabel)

    for (const v of newViolations) {
      violations.push(v)
      options?.onViolation?.(v)
    }

    options?.onProgress?.(i + 1, actionCount)
  }

  return { totalActions: actionCount, violations }
}
