import { useState, useEffect, useRef, useCallback } from 'react'
import type {
  LazyDataSource,
  Materializer,
  MaterializedItem,
  DataLoadingState,
} from '../types'
import { MaterializationWindow } from '../materializer'

export function useDataPipeline<TEvent, TView>(
  dataSource: LazyDataSource<TEvent>,
  materializer: Materializer<TEvent, TView>,
  materializationWindowSize: number,
  initialMaterializedItems: MaterializedItem<TView>[] = [],
) {
  // Use refs for totalCount and loadingState to avoid unnecessary
  // React render passes. Only materializedItems changes should
  // trigger re-renders — everything else is read on-demand.
  const totalCountRef = useRef(0)
  const loadingStateRef = useRef<DataLoadingState>({ type: 'idle' })

  const windowRef = useRef<MaterializationWindow<TEvent, TView> | null>(null)

  // Initialize the materialization window and try synchronous data load.
  // This runs during render (not in an effect) so items are available
  // on the first render pass, avoiding an extra async-load render.
  if (!windowRef.current) {
    windowRef.current = new MaterializationWindow(
      dataSource,
      materializer,
      materializationWindowSize,
    )
    if (initialMaterializedItems.length > 0) {
      windowRef.current.hydrate(initialMaterializedItems)
      // Seed totalCountRef with the last processed event index so that
      // the onAppend listener (which runs before the reconciliation effect)
      // doesn't re-process all events from index 0. The reconciliation
      // effect will fill in any gap between this value and the actual
      // current count.
      let lastProcessedIndex = 0
      for (const item of initialMaterializedItems) {
        lastProcessedIndex = Math.max(lastProcessedIndex, item.seqRange[1] + 1)
      }
      totalCountRef.current = lastProcessedIndex
    } else if (dataSource.getRangeSync) {
      // Synchronous initialization for in-memory data sources
      const count = dataSource.getCount()
      if (typeof count === 'number' && count > 0) {
        const start = Math.max(0, count - materializationWindowSize)
        const events = dataSource.getRangeSync(start, count)
        windowRef.current.hydrateFromEvents(events)
        totalCountRef.current = count
      }
    }
  }

  // Initialize state with window items (may be populated from sync init above)
  const [materializedItems, setMaterializedItems] = useState<MaterializedItem<TView>[]>(
    () => initialMaterializedItems.length > 0
      ? initialMaterializedItems
      : windowRef.current?.getAllItems() ?? [],
  )

  // Async fallback: if sync init wasn't available, load data via effect.
  // When hydrated from initialMaterializedItems, also reconcile any events
  // that arrived while the component was unmounted (e.g., streaming completed
  // during a tab switch). Without this, the gap between the last event in the
  // hydrated items and the current source count is permanently lost.
  useEffect(() => {
    if (initialMaterializedItems.length > 0 || (windowRef.current && windowRef.current.getAllItems().length > 0)) {
      let cancelled = false

      const reconcile = async (count: number) => {
        // Use max to avoid decreasing the counter if onAppend already advanced it
        totalCountRef.current = Math.max(totalCountRef.current, count)

        const currentItems = windowRef.current?.getAllItems() ?? []
        if (currentItems.length === 0 || !windowRef.current) return

        // Find the last event index that was processed into materialized items
        let lastProcessedIndex = 0
        for (const item of currentItems) {
          lastProcessedIndex = Math.max(lastProcessedIndex, item.seqRange[1] + 1)
        }

        if (count > lastProcessedIndex) {
          try {
            const events: TEvent[] = []
            for await (const event of dataSource.getRange(lastProcessedIndex, count)) {
              events.push(event)
            }
            if (!cancelled && events.length > 0 && windowRef.current) {
              windowRef.current.appendTail(events)
              setMaterializedItems([...windowRef.current.getAllItems()])
            }
          } catch {
            // Silently handle reconciliation errors
          }
        }
      }

      const countOrPromise = dataSource.getCount()
      if (typeof countOrPromise === 'number') {
        reconcile(countOrPromise)
      } else {
        countOrPromise.then(c => { if (!cancelled) reconcile(c) })
      }

      return () => { cancelled = true }
    }

    let cancelled = false

    async function init() {
      const count = await dataSource.getCount()
      if (cancelled) return

      totalCountRef.current = count

      if (count === 0) return

      const start = Math.max(0, count - materializationWindowSize)
      loadingStateRef.current = { type: 'fetching', range: [start, count] }

      try {
        await windowRef.current!.ensureRange(start, count)
        if (cancelled) return

        loadingStateRef.current = { type: 'idle' }
        setMaterializedItems(windowRef.current!.getAllItems())
      } catch {
        if (cancelled) return
        loadingStateRef.current = { type: 'idle' }
      }
    }

    init()
    return () => { cancelled = true }
  }, [dataSource, materializationWindowSize])

  // Subscribe to new items
  useEffect(() => {
    const unsub = dataSource.onAppend(async (newCount: number) => {
      const prevCount = totalCountRef.current
      totalCountRef.current = newCount

      if (windowRef.current && newCount > prevCount) {
        try {
          const events: TEvent[] = []
          for await (const event of dataSource.getRange(prevCount, newCount)) {
            events.push(event)
          }
          windowRef.current.appendTail(events)
          setMaterializedItems([...windowRef.current.getAllItems()])
        } catch {
          // Silently handle append errors — stale data is acceptable
        }
      }
    })

    return unsub
  }, [dataSource])

  const ensureRange = useCallback(async (start: number, end: number) => {
    if (!windowRef.current) return

    loadingStateRef.current = { type: 'fetching', range: [start, end] }
    try {
      await windowRef.current.ensureRange(start, end)
      loadingStateRef.current = { type: 'idle' }
      setMaterializedItems([...windowRef.current.getAllItems()])
    } catch {
      loadingStateRef.current = { type: 'idle' }
    }
  }, [])

  return {
    materializedItems,
    totalCount: totalCountRef.current,
    loadingState: loadingStateRef.current,
    ensureRange,
    isLoading: loadingStateRef.current.type === 'fetching' || loadingStateRef.current.type === 'materializing',
  }
}
