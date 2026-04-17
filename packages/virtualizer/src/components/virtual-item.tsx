'use client'

import { memo, useCallback } from 'react'
import type { VirtualItemPosition } from '../types'

interface VirtualItemProps {
  position: VirtualItemPosition
  measureElement: (node: HTMLElement | null) => void
  children: React.ReactNode
}

export const VirtualItem = memo(function VirtualItem({ position, measureElement, children }: VirtualItemProps) {
  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        node.dataset.virtualKey = position.key
        node.dataset.virtualCacheKey = position.cacheKey
        measureElement(node)
      }
    },
    [position.key, position.cacheKey, measureElement],
  )

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${position.offset}px)`,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  )
})
