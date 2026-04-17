import { useReducer, useCallback } from 'react'
import type { ScrollState, ScrollEvent } from '../types'
import { scrollReducer } from '../state-machines'

export function useScrollState(initialState?: ScrollState) {
  const [scrollState, dispatch] = useReducer(
    scrollReducer,
    initialState ?? ({ type: 'locked-to-bottom' } as ScrollState),
  )

  const dispatchScroll = useCallback(
    (event: ScrollEvent) => dispatch(event),
    [],
  )

  return { scrollState, dispatchScroll }
}
