import type { MeasuredSize, MeasurementCache } from './types'

export class MeasurementCacheImpl implements MeasurementCache {
  private cache = new Map<string, MeasuredSize>()
  private hits = 0
  private misses = 0

  get(cacheKey: string): MeasuredSize | undefined {
    const entry = this.cache.get(cacheKey)
    if (entry) {
      this.hits++
    } else {
      this.misses++
    }
    return entry
  }

  set(cacheKey: string, size: MeasuredSize): void {
    this.cache.set(cacheKey, size)
  }

  has(cacheKey: string): boolean {
    return this.cache.has(cacheKey)
  }

  delete(cacheKey: string): void {
    this.cache.delete(cacheKey)
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  get hitRate(): number {
    const total = this.hits + this.misses
    return total === 0 ? 1 : this.hits / total
  }

  get measuredCount(): number {
    return this.cache.size
  }

  serialize(): Record<string, MeasuredSize> {
    const out: Record<string, MeasuredSize> = {}
    for (const [k, v] of this.cache) {
      out[k] = v
    }
    return out
  }

  hydrate(data: Record<string, MeasuredSize>): void {
    for (const [k, v] of Object.entries(data)) {
      this.cache.set(k, v)
    }
  }
}
