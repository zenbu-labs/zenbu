'use client'

import type { DebugInfo } from '../types'

function stateColor(state: string): string {
  switch (state) {
    case 'locked-to-bottom': return '#4ade80'
    case 'free-scroll': return '#facc15'
    case 'programmatic-scroll': return '#60a5fa'
    default: return '#e0e0e0'
  }
}

export function DebugOverlay({ info }: { info: DebugInfo }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        background: 'rgba(0, 0, 0, 0.88)',
        color: '#a0a0a0',
        padding: '8px 12px',
        borderRadius: 6,
        fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
        lineHeight: 1.6,
        zIndex: 9999,
        pointerEvents: 'none',
        minWidth: 220,
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div>
        scroll:{' '}
        <span style={{ color: stateColor(info.scrollState.type) }}>
          {info.scrollState.type}
        </span>
      </div>
      <div>
        data: <span style={{ color: '#a0a0a0' }}>{info.dataLoadingState.type}</span>
      </div>
      <div>
        mode: <span style={{ color: info.mode === 'live' ? '#a0a0a0' : info.mode === 'snapshot' ? '#60a5fa' : '#facc15' }}>{info.mode}</span>
      </div>
      <div>
        visible: {info.visibleRange[0]}–{info.visibleRange[1]}
      </div>
      <div>
        rendered: {info.renderedRange[0]}–{info.renderedRange[1]}
      </div>
      <div>
        virtual: {info.virtualItemCount} ({info.firstVirtualIndex ?? '∅'}–{info.lastVirtualIndex ?? '∅'})
      </div>
      <div>
        items: {info.totalItems} total, {info.totalMaterialized} materialized
      </div>
      <div>
        positions: {info.positionCount}
      </div>
      <div>
        measured: {info.measuredItemCount} / unmeasured: {info.unmeasuredItemCount}
      </div>
      <div>
        cache: {(info.measurementHitRate * 100).toFixed(0)}% hit
      </div>
      <div>
        height: {info.estimatedTotalHeight.toFixed(0)}px
      </div>
      <div>
        core: {info.coreScrollOffset.toFixed(0)} / dom: {info.domScrollTop === null ? '∅' : info.domScrollTop.toFixed(0)}
      </div>
      <div>
        delta: {info.scrollOffsetDelta === null ? '∅' : info.scrollOffsetDelta.toFixed(0)}
      </div>
      <div>
        viewport: {info.containerHeight.toFixed(0)} / dom: {info.domClientHeight === null ? '∅' : info.domClientHeight}
      </div>
      <div>
        dom h: {info.domScrollHeight === null ? '∅' : info.domScrollHeight}
      </div>
      <div>
        bottom: {info.distanceFromBottom.toFixed(0)}
      </div>
      {info.coldStartStartIndex !== null && (
        <div>
          cold: {info.coldStartStartIndex}
        </div>
      )}
      {info.anchorItem && (
        <div>
          anchor: <span style={{ color: '#60a5fa' }}>{info.anchorItem}</span>
        </div>
      )}
      <div>
        fps: <span style={{ color: info.fps < 30 ? '#ef4444' : info.fps < 55 ? '#facc15' : '#4ade80' }}>{info.fps}</span>
      </div>
    </div>
  )
}
