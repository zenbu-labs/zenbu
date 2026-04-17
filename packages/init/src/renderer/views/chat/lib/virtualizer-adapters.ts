import type {
  LazyDataSource,
  Materializer,
  MaterializedItem,
} from "@zenbu/virtualizer"
import type { MaterializedMessage } from "./materialize"

/**
 * Mutable data source backed by an in-memory messages array.
 * Stable object reference so `useDataPipeline` won't reinitialize on every render.
 * Call `setMessages` to update — appends fire `onAppend`, structural changes
 * (prepends/resets) are signaled via `onReset`.
 */
export class ReactiveDataSource implements LazyDataSource<MaterializedMessage> {
  private messages: MaterializedMessage[] = []
  private appendListeners = new Set<(newCount: number) => void>()
  private resetListeners = new Set<() => void>()

  constructor(initialMessages: MaterializedMessage[] = []) {
    this.messages = initialMessages
  }

  setMessages(next: MaterializedMessage[]): "append" | "reset" {
    const prev = this.messages
    this.messages = next

    if (next.length === prev.length && next === prev) return "append"

    const isAppend =
      next.length > prev.length &&
      prev.length > 0 &&
      getMessageKey(next[prev.length - 1], prev.length - 1) ===
        getMessageKey(prev[prev.length - 1], prev.length - 1)

    if (isAppend) {
      for (const cb of this.appendListeners) cb(next.length)
      return "append"
    }

    for (const cb of this.resetListeners) cb()
    return "reset"
  }

  getCount(): number {
    return this.messages.length
  }

  getRangeSync(start: number, end: number): MaterializedMessage[] {
    return this.messages.slice(start, Math.min(end, this.messages.length))
  }

  async *getRange(
    start: number,
    end: number,
  ): AsyncIterable<MaterializedMessage> {
    for (let i = start; i < Math.min(end, this.messages.length); i++) {
      yield this.messages[i]
    }
  }

  onAppend(callback: (newCount: number) => void): () => void {
    this.appendListeners.add(callback)
    return () => this.appendListeners.delete(callback)
  }

  onReset(callback: () => void): () => void {
    this.resetListeners.add(callback)
    return () => this.resetListeners.delete(callback)
  }
}

function getMessageKey(msg: MaterializedMessage, index: number): string {
  switch (msg.role) {
    case "tool":
    case "permission_request":
      return msg.toolCallId
    case "ask_question":
      return msg.toolCallId
    case "plan":
      return `plan-${index}`
    default:
      return `${msg.role}-${index}`
  }
}

export function createIdentityMaterializer(): Materializer<
  MaterializedMessage,
  MaterializedMessage
> {
  return {
    materialize(
      events: MaterializedMessage[],
    ): MaterializedItem<MaterializedMessage>[] {
      return events.map((msg, i) => ({
        key: getMessageKey(msg, i),
        cacheKey: getMessageKey(msg, i),
        view: msg,
        sourceEventIds: [],
        seqRange: [i, i] as [number, number],
      }))
    },
    appendEvents(
      existing: MaterializedItem<MaterializedMessage>[],
      newEvents: MaterializedMessage[],
    ): MaterializedItem<MaterializedMessage>[] {
      const startIdx = existing.length
      const newItems = newEvents.map((msg, i) => ({
        key: getMessageKey(msg, startIdx + i),
        cacheKey: getMessageKey(msg, startIdx + i),
        view: msg,
        sourceEventIds: [],
        seqRange: [startIdx + i, startIdx + i] as [number, number],
      }))
      return [...existing, ...newItems]
    },
  }
}
