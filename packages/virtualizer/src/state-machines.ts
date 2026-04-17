import type {
  ScrollState,
  ScrollEvent,
  DataLoadingState,
  DataLoadingEvent,
  MeasurementItemState,
  MeasurementItemEvent,
} from './types'

export function scrollReducer(state: ScrollState, event: ScrollEvent): ScrollState {
  switch (state.type) {
    case 'locked-to-bottom':
      switch (event.type) {
        case 'USER_SCROLL_UP':
          return { type: 'free-scroll', anchor: null }
        case 'PROGRAMMATIC_SCROLL':
          return { type: 'programmatic-scroll', target: event.target }
        case 'NEW_ITEMS_APPENDED':
        case 'MEASUREMENT_CHANGED_ABOVE':
          return state
        default:
          return state
      }

    case 'free-scroll':
      switch (event.type) {
        case 'USER_SCROLL_TO_BOTTOM':
          return { type: 'locked-to-bottom' }
        case 'USER_SCROLL_UP':
          return state
        case 'ANCHOR_ESTABLISHED':
          return { type: 'free-scroll', anchor: event.anchor }
        case 'PROGRAMMATIC_SCROLL':
          return { type: 'programmatic-scroll', target: event.target }
        case 'NEW_ITEMS_APPENDED':
        case 'MEASUREMENT_CHANGED_ABOVE':
          return state
        default:
          return state
      }

    case 'programmatic-scroll':
      switch (event.type) {
        case 'PROGRAMMATIC_SCROLL_COMPLETE':
          return { type: 'free-scroll', anchor: null }
        case 'USER_SCROLL_UP':
          return { type: 'free-scroll', anchor: null }
        case 'USER_SCROLL_TO_BOTTOM':
          return { type: 'locked-to-bottom' }
        default:
          return state
      }
  }
}

export function dataLoadingReducer(
  state: DataLoadingState,
  event: DataLoadingEvent,
): DataLoadingState {
  switch (state.type) {
    case 'idle':
      if (event.type === 'FETCH_RANGE') return { type: 'fetching', range: event.range }
      return state
    case 'fetching':
      if (event.type === 'FETCH_COMPLETE') return { type: 'materializing', range: state.range }
      if (event.type === 'FETCH_ERROR') return { type: 'error', error: event.error, retryRange: state.range }
      return state
    case 'materializing':
      if (event.type === 'MATERIALIZE_COMPLETE') return { type: 'ready' }
      if (event.type === 'FETCH_ERROR') return { type: 'error', error: event.error, retryRange: state.range }
      return state
    case 'ready':
      if (event.type === 'FETCH_RANGE') return { type: 'fetching', range: event.range }
      if (event.type === 'RESET') return { type: 'idle' }
      return state
    case 'error':
      if (event.type === 'RETRY') return { type: 'fetching', range: state.retryRange }
      if (event.type === 'RESET') return { type: 'idle' }
      return state
  }
}

export function measurementItemReducer(
  state: MeasurementItemState,
  event: MeasurementItemEvent,
): MeasurementItemState {
  switch (state.type) {
    case 'unmeasured':
      if (event.type === 'MOUNT') return { type: 'measuring' }
      return state
    case 'measuring':
      if (event.type === 'RESIZE') return { type: 'measured', size: event.size }
      if (event.type === 'UNMOUNT') return { type: 'unmeasured' }
      return state
    case 'measured':
      if (event.type === 'RESIZE') return { type: 'measured', size: event.size }
      if (event.type === 'UNMOUNT') return { type: 'unmeasured' }
      if (event.type === 'CACHE_KEY_CHANGED') return { type: 'invalidated', previousSize: state.size }
      return state
    case 'invalidated':
      if (event.type === 'MOUNT' || event.type === 'REMOUNT') return { type: 'measuring' }
      return state
  }
}
