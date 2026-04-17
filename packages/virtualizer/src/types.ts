// ─── Data Source ─────────────────────────────────────────────

export interface LazyDataSource<TEvent> {
  getRange(start: number, end: number): AsyncIterable<TEvent>
  getCount(): number | Promise<number>
  onAppend(callback: (newCount: number) => void): () => void
  /** Optional synchronous range access for in-memory data sources.
   *  Enables synchronous initialization to avoid extra React render passes. */
  getRangeSync?(start: number, end: number): TEvent[]
}

// ─── Event Log & Materialization ─────────────────────────────

export interface EventLogEntry<TPayload = unknown> {
  id: string
  seq: number
  timestamp: number
  type: string
  payload: TPayload
}

export interface MaterializedItem<TView = unknown> {
  key: string
  cacheKey: string
  view: TView
  sourceEventIds: string[]
  seqRange: [number, number]
}

export interface Materializer<TEvent, TView> {
  materialize(events: TEvent[]): MaterializedItem<TView>[]
  appendEvents(
    existing: MaterializedItem<TView>[],
    newEvents: TEvent[],
  ): MaterializedItem<TView>[]
}

// ─── Measurement ─────────────────────────────────────────────

export interface MeasuredSize {
  height: number
  measuredAt: number
}

export interface MeasurementCache {
  get(cacheKey: string): MeasuredSize | undefined
  set(cacheKey: string, size: MeasuredSize): void
  has(cacheKey: string): boolean
  delete(cacheKey: string): void
  clear(): void
  serialize(): Record<string, MeasuredSize>
  hydrate(data: Record<string, MeasuredSize>): void
  readonly hitRate: number
}

// ─── Virtual Item Position ───────────────────────────────────

export interface VirtualItemPosition {
  index: number
  key: string
  cacheKey: string
  offset: number
  size: number
  measured: boolean
}

// ─── Scroll Anchor ───────────────────────────────────────────

export interface ScrollAnchor {
  anchorKey: string
  offsetFromItemTop: number
  anchorIndex: number
}

// ─── State Machines ──────────────────────────────────────────

export type ScrollState =
  | { type: 'locked-to-bottom' }
  | { type: 'free-scroll'; anchor: ScrollAnchor | null }
  | { type: 'programmatic-scroll'; target: { index: number; align: 'start' | 'center' | 'end' } }

export type ScrollEvent =
  | { type: 'USER_SCROLL_UP' }
  | { type: 'USER_SCROLL_TO_BOTTOM' }
  | { type: 'PROGRAMMATIC_SCROLL'; target: { index: number; align: 'start' | 'center' | 'end' } }
  | { type: 'PROGRAMMATIC_SCROLL_COMPLETE' }
  | { type: 'NEW_ITEMS_APPENDED'; count: number }
  | { type: 'ANCHOR_ESTABLISHED'; anchor: ScrollAnchor }
  | { type: 'MEASUREMENT_CHANGED_ABOVE'; delta: number }

export type DataLoadingState =
  | { type: 'idle' }
  | { type: 'fetching'; range: [number, number] }
  | { type: 'materializing'; range: [number, number] }
  | { type: 'ready' }
  | { type: 'error'; error: Error; retryRange: [number, number] }

export type DataLoadingEvent =
  | { type: 'FETCH_RANGE'; range: [number, number] }
  | { type: 'FETCH_COMPLETE'; events: unknown[] }
  | { type: 'MATERIALIZE_COMPLETE'; items: MaterializedItem[] }
  | { type: 'FETCH_ERROR'; error: Error }
  | { type: 'RETRY' }
  | { type: 'RESET' }

export type MeasurementItemState =
  | { type: 'unmeasured' }
  | { type: 'measuring' }
  | { type: 'measured'; size: MeasuredSize }
  | { type: 'invalidated'; previousSize: MeasuredSize }

export type MeasurementItemEvent =
  | { type: 'MOUNT'; element: HTMLElement }
  | { type: 'RESIZE'; size: MeasuredSize }
  | { type: 'UNMOUNT' }
  | { type: 'CACHE_KEY_CHANGED'; newCacheKey: string }
  | { type: 'REMOUNT'; element: HTMLElement }

// ─── Read Tracking ───────────────────────────────────────────

export interface ReadRecord {
  key: string
  firstVisibleAt: number
  lastVisibleAt: number
  totalVisibleMs: number
}

export type ReadTrackingCallback = (records: ReadRecord[]) => void

// ─── Debug ───────────────────────────────────────────────────

export interface DebugInfo {
  scrollState: ScrollState
  dataLoadingState: DataLoadingState
  mode: 'snapshot' | 'cold-start' | 'live'
  visibleRange: [number, number]
  renderedRange: [number, number]
  totalItems: number
  totalMaterialized: number
  virtualItemCount: number
  firstVirtualIndex: number | null
  lastVirtualIndex: number | null
  positionCount: number
  measurementHitRate: number
  anchorItem: string | null
  estimatedTotalHeight: number
  coreScrollOffset: number
  domScrollTop: number | null
  scrollOffsetDelta: number | null
  containerHeight: number
  domClientHeight: number | null
  domScrollHeight: number | null
  distanceFromBottom: number
  coldStartStartIndex: number | null
  measuredItemCount: number
  unmeasuredItemCount: number
  fps: number
}

// ─── Viewport Snapshot ───────────────────────────────────────

export interface ViewportSnapshot {
  scrollTop: number
  totalHeight: number
  containerHeight: number
  scrollStateType: 'locked-to-bottom' | 'free-scroll'
  items: Array<{
    key: string
    cacheKey: string
    index: number
    offset: number
    size: number
  }>
}

// ─── Consumer API ────────────────────────────────────────────

export interface VirtualizerOptions<TEvent, TView> {
  dataSource: LazyDataSource<TEvent>
  materializer: Materializer<TEvent, TView>
  estimateItemHeight: number | ((item: MaterializedItem<TView>) => number)
  transformMaterializedItem?: (item: MaterializedItem<TView>) => MaterializedItem<TView>
  overscan?: number
  overscanPx?: number
  retainOverscanPx?: number
  bottomThreshold?: number
  initialMeasurementCache?: Record<string, MeasuredSize>
  initialSnapshot?: ViewportSnapshot
  initialMaterializedItems?: MaterializedItem<TView>[]
  onReadUpdate?: ReadTrackingCallback
  debug?: boolean
  materializationWindow?: number
}

export interface VirtualizerInstance<TView> {
  virtualItems: VirtualItemPosition[]
  totalSize: number
  scrollState: ScrollState
  scrollRef: React.RefCallback<HTMLElement>
  measureElement: (node: HTMLElement | null) => void
  scrollToIndex: (index: number, opts?: { align?: 'start' | 'center' | 'end'; behavior?: 'auto' | 'smooth' }) => void
  scrollToBottom: (opts?: { behavior?: 'auto' | 'smooth' }) => void
  /** Invalidate the measurement cache for a specific cacheKey, forcing re-measurement on next render */
  invalidateMeasurement: (cacheKey: string) => void
  materializedItems: MaterializedItem<TView>[]
  /** Raw materialized items before transformMaterializedItem is applied.
   *  Use these (not materializedItems) when saving for snapshot restore. */
  rawMaterializedItems: MaterializedItem<TView>[]
  exportMeasurementCache: () => Record<string, MeasuredSize>
  captureSnapshot: () => ViewportSnapshot
  debugInfo: DebugInfo | null
  isLockedToBottom: boolean
  isLoading: boolean
}
