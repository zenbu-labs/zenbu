import { useEffect, useRef } from 'react'
import type { VirtualItemPosition, ReadRecord, ReadTrackingCallback } from '../types'

export function useReadTracking(
  virtualItems: VirtualItemPosition[],
  callback?: ReadTrackingCallback,
): void {
  const records = useRef(new Map<string, ReadRecord>())
  const prevVisible = useRef(new Set<string>())

  useEffect(() => {
    if (!callback) return

    const now = Date.now()
    const currentVisible = new Set(virtualItems.map(v => v.key))

    for (const key of currentVisible) {
      if (!prevVisible.current.has(key)) {
        const existing = records.current.get(key)
        if (existing) {
          existing.lastVisibleAt = now
        } else {
          records.current.set(key, {
            key,
            firstVisibleAt: now,
            lastVisibleAt: now,
            totalVisibleMs: 0,
          })
        }
      }
    }

    for (const key of prevVisible.current) {
      if (!currentVisible.has(key)) {
        const record = records.current.get(key)
        if (record) {
          record.totalVisibleMs += now - record.lastVisibleAt
        }
      }
    }

    prevVisible.current = currentVisible
    callback(Array.from(records.current.values()))
  }, [virtualItems, callback])
}
