export type ZenbuEvents = {
  advice: {
    reload: { scope: string }
  }
  orchestrator: {
    scrollTouch: { webContentsId: number; phase: "begin" | "end" }
  }
  pty: {
    data: { sessionId: string; data: string }
    exit: { sessionId: string; exitCode: number }
  }
  shortcut: {
    dispatched: { id: string; scope: string; windowId: string | null; paneId: string | null; ts: number }
  }
}
