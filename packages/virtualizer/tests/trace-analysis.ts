import type { Page } from '@playwright/test'
import { writeFile, mkdir } from 'fs/promises'

// ─── Types ───────────────────────────────────────────────────

type CDPClient = Awaited<ReturnType<ReturnType<Page['context']>['newCDPSession']>>

export interface TraceEvent {
  name: string
  cat: string
  ph: string
  ts: number      // microseconds
  dur?: number     // microseconds (for complete events, ph='X')
  tid: number
  pid: number
  args?: Record<string, unknown>
}

export interface ReactPass {
  offset_ms: number
  phase: string            // 'Render', 'Commit', 'Remaining Effects'
  dur_ms: number
  trigger: string          // 'Mount', 'Update', 'CascadingUpdate', 'Consecutive'
  virtualItemCount: number
}

export interface ActionReport {
  action: string
  /** Main-thread busy time within the action window (ms) */
  mainThreadMs: number
  /** Longest single task (ms) */
  longTaskMs: number
  /** Number of VirtualItem component renders */
  renders: number
  /** Number of forced Layout events */
  layouts: number
  /** GC pause time (ms) */
  gcMs: number
  /** React render passes (Mount/Update/CascadingUpdate) */
  reactPasses: number
  /** Breakdown of each React render/commit cycle */
  reactCycles: ReactPass[]
  /** Whether the trace markers were found */
  resolved: boolean
}

export interface TraceReport {
  actions: ActionReport[]
  /** Overall trace stats */
  summary: {
    totalTraceMs: number
    totalMainThreadMs: number
    totalRenders: number
    totalLayouts: number
    totalGcMs: number
    peakLongTaskMs: number
  }
}

// ─── CDP tracing ─────────────────────────────────────────────

const clients = new WeakMap<Page, CDPClient>()

export async function startTracing(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page)
  clients.set(page, client)
  await client.send('Tracing.start', {
    categories: [
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.stack',
      'blink.user_timing',
      'v8',
    ].join(','),
    options: 'sampling-frequency=10000',
  })
}

export async function stopTracing(page: Page): Promise<TraceEvent[]> {
  const client = clients.get(page)
  if (!client) throw new Error('No tracing session. Call startTracing first.')

  const chunks: unknown[][] = []

  return new Promise<TraceEvent[]>((resolve, reject) => {
    client.on('Tracing.dataCollected', (payload: { value: unknown[] }) => {
      chunks.push(payload.value)
    })
    client.on('Tracing.tracingComplete', () => {
      clients.delete(page)
      resolve(chunks.flat() as TraceEvent[])
    })
    client.send('Tracing.end').catch(reject)
  })
}

// ─── Trace analysis ──────────────────────────────────────────

function findMainThread(events: TraceEvent[]): number {
  for (const ev of events) {
    if (ev.name === 'thread_name' && (ev.args as Record<string, unknown>)?.name === 'CrRendererMain') {
      return ev.tid
    }
  }
  // Fallback: thread with most events
  const counts = new Map<number, number>()
  for (const ev of events) counts.set(ev.tid, (counts.get(ev.tid) ?? 0) + 1)
  let best = 0, bestCount = 0
  for (const [tid, c] of counts) { if (c > bestCount) { best = tid; bestCount = c } }
  return best
}

function durMs(ev: TraceEvent): number {
  return (ev.dur ?? 0) / 1000
}

export function analyzeTrace(
  events: TraceEvent[],
  actionMarkers: Array<{ action: string; startMark: string; endMark: string }>,
): TraceReport {
  const mainTid = findMainThread(events)

  // Resolve all performance.mark() timestamps from the trace.
  // Marks appear in blink.user_timing with various phase chars.
  const marks = new Map<string, number>()
  for (const ev of events) {
    if ((ev.cat || '').includes('blink.user_timing') && (ev.name || '').startsWith('__perf:')) {
      if (!marks.has(ev.name)) marks.set(ev.name, ev.ts)
    }
  }

  const mainEvents = events.filter(e => e.tid === mainTid)

  const actions = actionMarkers.map(({ action, startMark, endMark }): ActionReport => {
    const startUs = marks.get(startMark)
    const endUs = marks.get(endMark)

    if (startUs == null || endUs == null) {
      return {
        action, mainThreadMs: 0, longTaskMs: 0, renders: 0,
        layouts: 0, gcMs: 0, reactPasses: 0, reactCycles: [], resolved: false,
      }
    }

    const inWindow = mainEvents.filter(e => e.ts >= startUs && e.ts <= endUs)

    // Main-thread busy time: sum of top-level RunTask durations
    let mainThreadMs = 0
    let longTaskMs = 0
    for (const ev of inWindow) {
      if (ev.name === 'RunTask' && ev.dur) {
        const d = durMs(ev)
        mainThreadMs += d
        if (d > longTaskMs) longTaskMs = d
      }
    }

    let renders = 0
    let layouts = 0
    let gcMs = 0

    for (const ev of inWindow) {
      if (ev.name.includes('VirtualItem') && ev.ph === 'b') renders++
      // Only count forced layouts (triggered by JS reading geometry after mutation).
      // Scheduled layouts from CSS transitions/animations don't have a JS stack trace.
      if (ev.name === 'Layout') {
        const stackTrace = (ev.args?.beginData as Record<string, unknown>)?.stackTrace
        if (Array.isArray(stackTrace) && stackTrace.length > 0) layouts++
      }
      if (ev.name === 'MinorGC' || ev.name === 'MajorGC') gcMs += durMs(ev)
    }

    // Extract React Scheduler cycle data from TimeStamp events.
    // React 19 emits these with trackGroup = 'Scheduler ⚛'.
    const reactCycles: ReactPass[] = []
    const schedulerStamps = inWindow.filter(e =>
      e.name === 'TimeStamp' &&
      (e.args?.data as Record<string, unknown>)?.trackGroup === 'Scheduler ⚛',
    )
    for (const ev of schedulerStamps) {
      const d = ev.args?.data as Record<string, unknown>
      const name = (d?.name as string) || ''
      if (name === 'Render' || name === 'Commit' || name === 'Remaining Effects') {
        const s = (d?.start as number) ?? 0
        const e2 = (d?.end as number) ?? 0
        const cycleDur = s && e2 ? (e2 - s) / 1000 : 0

        // Count VirtualItem renders within this phase's time window
        let viCount = 0
        if (s && e2) {
          for (const ce of inWindow) {
            if (ce.name.includes('VirtualItem') && ce.ph === 'b' && ce.ts >= s && ce.ts <= e2) {
              viCount++
            }
          }
        }

        // Determine trigger from nearby events
        let trigger = name
        if (name === 'Render') {
          // Check if there's a Consecutive or Cascading event just before
          for (const se of schedulerStamps) {
            const sn = (se.args?.data as Record<string, unknown>)?.name as string
            if ((sn === 'Consecutive' || sn === 'Cascading Update') && se.ts < ev.ts && ev.ts - se.ts < 5000) {
              trigger = sn
              break
            }
          }
        }

        reactCycles.push({
          offset_ms: Math.round((ev.ts - startUs) / 1000 * 10) / 10,
          phase: name,
          dur_ms: Math.round(cycleDur * 10) / 10,
          trigger,
          virtualItemCount: viCount,
        })
      }
    }

    // Count tree-level React render passes from the Scheduler cycles.
    // This counts "Render" phases (not per-component Mount/Update events)
    // which represents the actual number of React tree-level render passes.
    const reactPasses = reactCycles.filter(c => c.phase === 'Render').length

    return {
      action,
      mainThreadMs: Math.round(mainThreadMs * 10) / 10,
      longTaskMs: Math.round(longTaskMs * 10) / 10,
      renders, layouts,
      gcMs: Math.round(gcMs * 10) / 10,
      reactPasses,
      reactCycles,
      resolved: true,
    }
  })

  // Summary
  const allMainEvents = mainEvents
  let totalMainThreadMs = 0
  let peakLongTaskMs = 0
  let totalRenders = 0
  let totalLayouts = 0
  let totalGcMs = 0

  for (const ev of allMainEvents) {
    if (ev.name === 'RunTask' && ev.dur) {
      const d = durMs(ev)
      totalMainThreadMs += d
      if (d > peakLongTaskMs) peakLongTaskMs = d
    }
    if (ev.name.includes('VirtualItem') && ev.ph === 'b') totalRenders++
    if (ev.name === 'Layout') {
      const stackTrace = (ev.args?.beginData as Record<string, unknown>)?.stackTrace
      if (Array.isArray(stackTrace) && stackTrace.length > 0) totalLayouts++
    }
    if (ev.name === 'MinorGC' || ev.name === 'MajorGC') totalGcMs += durMs(ev)
  }

  let minTs = Infinity, maxTs = 0
  for (const ev of events) {
    if (ev.ts < minTs) minTs = ev.ts
    if (ev.ts > maxTs) maxTs = ev.ts
  }

  return {
    actions,
    summary: {
      totalTraceMs: Math.round((maxTs - minTs) / 1000),
      totalMainThreadMs: Math.round(totalMainThreadMs),
      totalRenders,
      totalLayouts,
      totalGcMs: Math.round(totalGcMs),
      peakLongTaskMs: Math.round(peakLongTaskMs * 10) / 10,
    },
  }
}

// ─── Formatting ──────────────────────────────────────────────

export function formatReport(report: TraceReport): string {
  const pad = (s: string, w: number) => s.length >= w ? s : ' '.repeat(w - s.length) + s
  const padR = (s: string, w: number) => s.length >= w ? s : s + ' '.repeat(w - s.length)
  const line = '\u2500'

  const cols = { action: 34, busy: 8, long: 8, renders: 8, layouts: 8, gc: 6, react: 6 }

  const header = [
    padR('Action', cols.action),
    pad('Busy', cols.busy),
    pad('Long', cols.long),
    pad('Renders', cols.renders),
    pad('Layouts', cols.layouts),
    pad('GC', cols.gc),
    pad('React', cols.react),
  ].join(' | ')

  const divider = Object.values(cols).map(w => line.repeat(w)).join('-+-')

  const rows = report.actions.map(a => {
    const warn = a.resolved ? '' : '?'
    return [
      padR(a.action.slice(0, cols.action), cols.action),
      pad(`${a.mainThreadMs}ms${warn}`, cols.busy),
      pad(`${a.longTaskMs}ms`, cols.long),
      pad(String(a.renders), cols.renders),
      pad(String(a.layouts), cols.layouts),
      pad(`${a.gcMs}ms`, cols.gc),
      pad(String(a.reactPasses), cols.react),
    ].join(' | ')
  })

  // Add React cycle detail for actions with > 2 passes (the interesting ones)
  const cycleDetails: string[] = []
  for (const a of report.actions) {
    const renderCycles = a.reactCycles.filter(c => c.phase === 'Render')
    if (renderCycles.length > 2) {
      cycleDetails.push(`\n  ${a.action} — ${renderCycles.length} React render passes:`)
      for (const c of renderCycles) {
        cycleDetails.push(`    +${c.offset_ms}ms: ${c.phase} ${c.dur_ms}ms (${c.virtualItemCount} VirtualItems) [${c.trigger}]`)
      }
    }
  }

  const s = report.summary
  const summaryLine = `\nTrace: ${s.totalTraceMs}ms | Main thread: ${s.totalMainThreadMs}ms | Peak task: ${s.peakLongTaskMs}ms | Total renders: ${s.totalRenders} | Layouts: ${s.totalLayouts} | GC: ${s.totalGcMs}ms`

  const unresolved = report.actions.filter(a => !a.resolved)
  const warn = unresolved.length > 0
    ? `\n⚠ ${unresolved.length} action(s) had unresolved markers: ${unresolved.map(a => a.action).join(', ')}`
    : ''

  return [header, divider, ...rows].join('\n') + summaryLine + (cycleDetails.length > 0 ? '\n' + cycleDetails.join('\n') : '') + warn
}

// ─── Save detailed report ────────────────────────────────────

interface RunTaskBreakdown {
  action: string
  runTask_ms: number
  runTask_startUs: number
  runTask_endUs: number
  /** All direct child events within this RunTask, sorted by duration desc */
  childEvents: Array<{
    name: string
    dur_ms: number
    offset_ms: number  // offset from RunTask start
    args_summary?: string
  }>
  /** Aggregated time by event category */
  timeByCategory: Record<string, number>
  /** Layout events with stack traces */
  layouts: Array<{
    dur_ms: number
    offset_ms: number
    stack: string
    elementCount?: number
  }>
  /** RecalculateStyles events */
  styleRecalcs: Array<{
    dur_ms: number
    offset_ms: number
    elementCount?: number
  }>
}

export async function saveDetailedReport(
  events: TraceEvent[],
  report: TraceReport,
  outputPath: string,
  actionMarkers?: Array<{ action: string; startMark: string; endMark: string }>,
): Promise<void> {
  const mainTid = findMainThread(events)
  const mainEvents = events.filter(e => e.tid === mainTid)

  // Resolve performance.mark() timestamps
  const marks = new Map<string, number>()
  for (const ev of events) {
    if ((ev.cat || '').includes('blink.user_timing') && (ev.name || '').startsWith('__perf:')) {
      if (!marks.has(ev.name)) marks.set(ev.name, ev.ts)
    }
  }

  // For each action, find the longest RunTask and break it down
  const runTaskBreakdowns: RunTaskBreakdown[] = []

  if (actionMarkers) {
    for (const { action, startMark, endMark } of actionMarkers) {
      const startUs = marks.get(startMark)
      const endUs = marks.get(endMark)
      if (startUs == null || endUs == null) continue

      // Find the longest RunTask in this action window
      let longestRunTask: TraceEvent | null = null
      for (const ev of mainEvents) {
        if (ev.name === 'RunTask' && ev.dur && ev.ts >= startUs && ev.ts <= endUs) {
          if (!longestRunTask || (ev.dur ?? 0) > (longestRunTask.dur ?? 0)) {
            longestRunTask = ev
          }
        }
      }

      if (!longestRunTask || !longestRunTask.dur) continue

      const rtStart = longestRunTask.ts
      const rtEnd = rtStart + longestRunTask.dur

      // Find all events within this RunTask (complete events with duration)
      const childEvents: RunTaskBreakdown['childEvents'] = []
      const layouts: RunTaskBreakdown['layouts'] = []
      const styleRecalcs: RunTaskBreakdown['styleRecalcs'] = []
      const timeByCategory: Record<string, number> = {}

      for (const ev of mainEvents) {
        if (ev.ts < rtStart || ev.ts > rtEnd) continue
        if (ev === longestRunTask) continue
        if (!ev.dur || ev.dur < 100) continue  // skip trivial events (<0.1ms)

        const d = durMs(ev)
        const offset = (ev.ts - rtStart) / 1000

        // Categorize
        const cat = ev.name
        timeByCategory[cat] = (timeByCategory[cat] ?? 0) + d

        // Build args summary for interesting events
        let argsSummary: string | undefined
        if (ev.name === 'FunctionCall') {
          const data = ev.args?.data as Record<string, unknown>
          const url = (data?.url as string) ?? ''
          const line = data?.lineNumber ?? 0
          // Extract just the filename
          const filename = url.split('/').pop() ?? url
          argsSummary = `${filename}:${line}`
        } else if (ev.name === 'EvaluateScript') {
          const data = ev.args?.data as Record<string, unknown>
          const url = (data?.url as string) ?? ''
          argsSummary = url.split('/').pop() ?? url
        }

        childEvents.push({ name: ev.name, dur_ms: Math.round(d * 100) / 100, offset_ms: Math.round(offset * 10) / 10, args_summary: argsSummary })

        if (ev.name === 'Layout') {
          const beginData = ev.args?.beginData as Record<string, unknown>
          const stack = beginData?.stackTrace
          let stackStr = '(no stack)'
          if (Array.isArray(stack)) {
            stackStr = (stack as Array<{ functionName: string; url?: string; lineNumber?: number }>)
              .slice(0, 5)
              .map(f => {
                const fn = f.functionName || '(anonymous)'
                const file = (f.url || '').split('/').pop() ?? ''
                return `${fn}@${file}:${f.lineNumber ?? '?'}`
              })
              .join(' > ')
          }
          const elementCount = (ev.args?.elementCount as number) ?? undefined
          layouts.push({ dur_ms: Math.round(d * 100) / 100, offset_ms: Math.round(offset * 10) / 10, stack: stackStr, elementCount })
        }

        if (ev.name === 'UpdateLayoutTree' || ev.name === 'RecalculateStyles') {
          const elementCount = (ev.args?.elementCount as number) ?? undefined
          styleRecalcs.push({ dur_ms: Math.round(d * 100) / 100, offset_ms: Math.round(offset * 10) / 10, elementCount })
        }
      }

      // Sort child events by duration desc
      childEvents.sort((a, b) => b.dur_ms - a.dur_ms)

      // Round timeByCategory
      for (const k of Object.keys(timeByCategory)) {
        timeByCategory[k] = Math.round(timeByCategory[k] * 100) / 100
      }

      runTaskBreakdowns.push({
        action,
        runTask_ms: Math.round(durMs(longestRunTask) * 10) / 10,
        runTask_startUs: rtStart,
        runTask_endUs: rtEnd,
        childEvents: childEvents.slice(0, 50),  // top 50 events
        timeByCategory,
        layouts,
        styleRecalcs,
      })
    }
  }

  // Top 10 longest tasks with source info
  const longTasks = mainEvents
    .filter(e => e.name === 'FunctionCall' && (e.dur ?? 0) > 10000)
    .sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))
    .slice(0, 10)
    .map(e => ({
      dur_ms: durMs(e),
      url: ((e.args?.data as Record<string, unknown>)?.url as string) ?? '',
      line: (e.args?.data as Record<string, unknown>)?.lineNumber ?? 0,
    }))

  // Layout-forcing stacks
  const layoutStacks = mainEvents
    .filter(e => e.name === 'Layout')
    .slice(0, 20)
    .map(e => {
      const stack = (e.args?.beginData as Record<string, unknown>)?.stackTrace
      if (Array.isArray(stack)) {
        return (stack as Array<{ functionName: string }>)
          .slice(0, 3)
          .map(f => f.functionName)
          .join(' > ')
      }
      return '(no stack)'
    })

  const dir = outputPath.substring(0, outputPath.lastIndexOf('/'))
  if (dir) await mkdir(dir, { recursive: true }).catch(() => {})

  await writeFile(outputPath, JSON.stringify({
    report,
    runTaskBreakdowns,
    longTasks,
    layoutStacks: [...new Set(layoutStacks)],
  }, null, 2))
}
