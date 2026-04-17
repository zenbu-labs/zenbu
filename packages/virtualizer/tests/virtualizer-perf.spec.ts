import { test, expect, type Page } from '@playwright/test'
import { startTracing, stopTracing, analyzeTrace, formatReport, saveDetailedReport } from './trace-analysis'
import * as budget from './perf-budget'

// ─── Helpers ─────────────────────────────────────────────────

async function clickTab(page: Page, name: string) {
  const tabs = page.locator('button').filter({ hasText: new RegExp(name) })
  await tabs.first().click()
}

async function scrollTo(page: Page, position: number | 'top' | 'bottom') {
  await page.evaluate((pos) => {
    const allEls = document.querySelectorAll<HTMLElement>('*')
    for (const el of allEls) {
      const s = window.getComputedStyle(el)
      if ((s.overflow === 'auto' || s.overflowY === 'auto') && el.querySelector('[data-virtual-key]')) {
        if (pos === 'top') el.scrollTop = 0
        else if (pos === 'bottom') el.scrollTop = el.scrollHeight
        else el.scrollTop = pos
        return
      }
    }
  }, position)
}

async function clickAccordion(page: Page) {
  const btns = page.locator('[data-virtual-key] button')
  const count = await btns.count()
  if (count > 0) await btns.nth(Math.floor(Math.random() * count)).click({ timeout: 2000 }).catch(() => {})
}

/** Place a performance.mark() in the browser that shows up in the trace. */
async function mark(page: Page, name: string) {
  await page.evaluate((n) => performance.mark(n), `__perf:${name}`)
}

// ─── Test ────────────────────────────────────────────────────

test.describe('Virtualizer Performance', () => {
  test.describe.configure({ mode: 'serial' })

  test('profiled fuzz run', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-virtual-key]', { timeout: 15_000 })
    await page.waitForTimeout(1000)

    // Start a single trace for the entire test
    await startTracing(page)

    // Collect action markers as we go
    const markers: Array<{ action: string; startMark: string; endMark: string }> = []

    async function traced(action: string, fn: () => Promise<void>) {
      const start = `__perf:${action}:start`
      const end = `__perf:${action}:end`
      await page.evaluate((n) => performance.mark(n), start)
      await fn()
      // Wait one rAF so React commits + paints, then mark end
      await page.evaluate((n) => new Promise<void>(r => requestAnimationFrame(() => { performance.mark(n); r() })), end)
      markers.push({ action, startMark: start, endMark: end })
      // Brief pause between actions so they don't merge
      await page.waitForTimeout(100)
    }

    // ── Run the interactions ─────────────────────────────────

    const tabs = ['Session A', 'Session B', 'Session C']

    // Tab switches (first visits)
    for (const tab of tabs) {
      await traced(`tab:${tab}`, () => clickTab(page, tab))
    }

    // Scroll around
    await traced('scroll:random1', () => scrollTo(page, 5000))
    await traced('scroll:random2', () => scrollTo(page, 2000))
    await traced('scroll:bottom', () => scrollTo(page, 'bottom'))
    await traced('scroll:top', () => scrollTo(page, 'top'))

    // Accordion clicks
    await traced('accordion:1', () => clickAccordion(page))
    await traced('accordion:2', () => clickAccordion(page))

    // Tab switches (revisits — should be faster due to cache)
    for (const tab of tabs) {
      await traced(`tab-revisit:${tab}`, () => clickTab(page, tab))
    }

    // Rapid switching
    for (let i = 0; i < 5; i++) {
      await traced(`rapid:${tabs[i % 3]}`, () => clickTab(page, tabs[i % 3]))
    }

    // ── Stop trace and analyze ───────────────────────────────

    const events = await stopTracing(page)
    const report = analyzeTrace(events, markers)

    // Print the report
    console.log('\n' + formatReport(report) + '\n')

    // Save detailed report for agent consumption
    await saveDetailedReport(events, report, 'test-results/perf-report.json', markers)

    // ── Budget assertions (from perf-budget.ts) ──────────────
    for (const a of report.actions) {
      if (!a.resolved) continue

      const isTabSwitch = a.action.startsWith('tab:') || a.action.startsWith('tab-revisit:') || a.action.startsWith('rapid:')
      const isScroll = a.action.startsWith('scroll:')
      const isAccordion = a.action.startsWith('accordion:')

      // Render count budgets
      if (isTabSwitch) {
        expect(a.renders,
          `${a.action}: ${a.renders} renders (budget: ${budget.MAX_TAB_SWITCH_RENDERS}). Busy: ${a.mainThreadMs}ms, React: ${a.reactPasses}`,
        ).toBeLessThanOrEqual(budget.MAX_TAB_SWITCH_RENDERS)

        expect(a.reactPasses,
          `${a.action}: ${a.reactPasses} React passes (budget: ${budget.MAX_REACT_PASSES_PER_TAB_SWITCH}). Renders: ${a.renders}`,
        ).toBeLessThanOrEqual(budget.MAX_REACT_PASSES_PER_TAB_SWITCH)
      }
      if (isScroll) {
        expect(a.renders,
          `${a.action}: ${a.renders} renders (budget: ${budget.MAX_SCROLL_RENDERS})`,
        ).toBeLessThanOrEqual(budget.MAX_SCROLL_RENDERS)
      }
      if (isAccordion) {
        expect(a.renders,
          `${a.action}: ${a.renders} renders (budget: ${budget.MAX_ACCORDION_RENDERS}). Layouts: ${a.layouts}`,
        ).toBeLessThanOrEqual(budget.MAX_ACCORDION_RENDERS)
      }

      // Universal budgets — every interaction
      expect(a.longTaskMs,
        `${a.action}: ${a.longTaskMs}ms long task (budget: ${budget.MAX_LONG_TASK_MS}ms). Renders: ${a.renders}, Layouts: ${a.layouts}`,
      ).toBeLessThanOrEqual(budget.MAX_LONG_TASK_MS)

      expect(a.gcMs,
        `${a.action}: ${a.gcMs}ms GC (budget: ${budget.MAX_GC_MS}ms)`,
      ).toBeLessThanOrEqual(budget.MAX_GC_MS)
    }
  })
})
