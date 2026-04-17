'use client'

import type { VirtualizerInstance, MaterializedItem, VirtualItemPosition } from '../types'
import { VirtualItem } from './virtual-item'
import { DebugOverlay } from './debug-overlay'

interface VirtualizedListProps<TView> {
  virtualizer: VirtualizerInstance<TView>
  renderItem: (item: MaterializedItem<TView>, position: VirtualItemPosition) => React.ReactNode
  className?: string
}

export function VirtualizedList<TView>({
  virtualizer,
  renderItem,
  className,
}: VirtualizedListProps<TView>) {
  return (
    <div
      ref={virtualizer.scrollRef}
      className={className}
      style={{ overflow: 'auto', position: 'relative', height: '100%' }}
    >
      <div style={{ height: virtualizer.totalSize, position: 'relative', width: '100%' }}>
        {virtualizer.virtualItems.map((vItem) => {
          const materializedItem = virtualizer.materializedItems[vItem.index]
          if (!materializedItem) return null

          return (
            <VirtualItem
              key={vItem.key}
              position={vItem}
              measureElement={virtualizer.measureElement}
            >
              {renderItem(materializedItem, vItem)}
            </VirtualItem>
          )
        })}
      </div>

      {virtualizer.debugInfo && <DebugOverlay info={virtualizer.debugInfo} />}
    </div>
  )
}
