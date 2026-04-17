import type { LazyDataSource, Materializer, MaterializedItem } from './types'
import { assertMaterializedItems } from './invariants'

export class MaterializationWindow<TEvent, TView> {
  private items: MaterializedItem<TView>[] = []
  private windowStart = 0
  private windowEnd = 0

  constructor(
    private dataSource: LazyDataSource<TEvent>,
    private materializer: Materializer<TEvent, TView>,
    private windowSize: number,
  ) {}

  async ensureRange(start: number, end: number): Promise<MaterializedItem<TView>[]> {
    if (start >= this.windowStart && end <= this.windowEnd && this.items.length > 0) {
      return this.items.slice(start - this.windowStart, end - this.windowStart)
    }

    const center = Math.floor((start + end) / 2)
    const halfWindow = Math.floor(this.windowSize / 2)
    const newStart = Math.max(0, center - halfWindow)
    const newEnd = newStart + this.windowSize

    const events: TEvent[] = []
    for await (const event of this.dataSource.getRange(newStart, newEnd)) {
      events.push(event)
    }

    this.items = this.materializer.materialize(events)
    this.windowStart = newStart
    this.windowEnd = newStart + this.items.length
    assertMaterializedItems(this.items, 'MaterializationWindow.ensureRange')

    return this.items.slice(
      Math.max(0, start - this.windowStart),
      end - this.windowStart,
    )
  }

  appendTail(newEvents: TEvent[]): MaterializedItem<TView>[] {
    this.items = this.materializer.appendEvents(this.items, newEvents)
    this.windowEnd = this.windowStart + this.items.length
    assertMaterializedItems(this.items, 'MaterializationWindow.appendTail')
    return this.items
  }

  hydrate(items: MaterializedItem<TView>[]): void {
    this.items = items
    this.windowStart = 0
    this.windowEnd = items.length
    assertMaterializedItems(this.items, 'MaterializationWindow.hydrate')
  }

  hydrateFromEvents(events: TEvent[]): void {
    this.items = this.materializer.materialize(events)
    this.windowStart = 0
    this.windowEnd = this.items.length
    assertMaterializedItems(this.items, 'MaterializationWindow.hydrateFromEvents')
  }

  getItem(index: number): MaterializedItem<TView> | undefined {
    if (index < this.windowStart || index >= this.windowEnd) return undefined
    return this.items[index - this.windowStart]
  }

  getAllItems(): MaterializedItem<TView>[] {
    return this.items
  }

  getWindowStart(): number {
    return this.windowStart
  }

  getWindowEnd(): number {
    return this.windowEnd
  }
}
