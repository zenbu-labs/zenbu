export type ChatScrollMetrics = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  distanceFromBottom: number
}

export function readChatScrollMetrics(
  el: HTMLElement | null | undefined,
): ChatScrollMetrics | null {
  if (!el) return null
  return {
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    distanceFromBottom: el.scrollHeight - el.clientHeight - el.scrollTop,
  }
}
