/**
 * Performance budgets for the virtualizer.
 *
 * These are hard constraints — the perf test MUST pass all of them.
 * The fuzz tests MUST pass with 0 invariant violations.
 *
 * Frame budget: 16ms (60fps). Every user interaction must produce its
 * first correct paint within a single frame. "Correct" means:
 * - The right content is visible (bottom items if locked, restored
 *   position if free-scroll, top items on first load)
 * - No blank screen
 * - No overlap between items
 *
 * Subsequent frames may adjust the scrollbar (spacer height), run
 * measurements, and correct positions — but visible content must
 * NEVER shift after it appears. Zero layout shift.
 */

/** Max main-thread busy time for a single interaction (ms) */
export const MAX_INTERACTION_BUSY_MS = 16

/** Max duration of any single long task within an interaction (ms) */
export const MAX_LONG_TASK_MS = 28

/** Max VirtualItem component renders per tab switch */
export const MAX_TAB_SWITCH_RENDERS = 60

/** Max VirtualItem renders per scroll action */
export const MAX_SCROLL_RENDERS = 60

/** Max VirtualItem renders per accordion click */
export const MAX_ACCORDION_RENDERS = 60

/** Max React render passes per tab switch (ideally 1) */
export const MAX_REACT_PASSES_PER_TAB_SWITCH = 2

/** Max GC pause per interaction (ms) */
export const MAX_GC_MS = 5
