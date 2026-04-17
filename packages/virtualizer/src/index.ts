export { useVirtualizer } from './hooks/use-virtualizer'
export { VirtualizedList } from './components/virtualized-list'
export { VirtualItem } from './components/virtual-item'
export { DebugOverlay } from './components/debug-overlay'
export { MeasurementCacheImpl } from './measurement-cache'
export { MaterializationWindow } from './materializer'
export { VirtualizerCore } from './virtualizer-core'
export { scrollReducer, dataLoadingReducer, measurementItemReducer } from './state-machines'
export { findIndexForOffset, computeVisibleRange } from './binary-search'
export { captureAnchor, resolveAnchor, computeScrollAdjustment } from './scroll-anchor'

export type {
  LazyDataSource,
  EventLogEntry,
  MaterializedItem,
  Materializer,
  MeasuredSize,
  MeasurementCache,
  VirtualItemPosition,
  ScrollAnchor,
  ScrollState,
  ScrollEvent,
  DataLoadingState,
  DataLoadingEvent,
  MeasurementItemState,
  MeasurementItemEvent,
  ReadRecord,
  ReadTrackingCallback,
  DebugInfo,
  ViewportSnapshot,
  VirtualizerOptions,
  VirtualizerInstance,
} from './types'
