import type { TokenPayload } from "./tokens"

export type ZenbuEvents = {
  advice: {
    reload: { scope: string }
  }
  insert: {
    /**
     * Emitted by `InsertService.insertToken` when a target session is live
     * (focused window + focused pane + activeTabId match). The focused
     * composer's `InsertBridgePlugin` translates this back into the local
     * token bus so the Lexical insert happens on the correct editor
     * instance.
     */
    requested: {
      requestId: string
      windowId: string
      sessionId: string
      agentId: string
      payload: TokenPayload
      ts: number
    }
  }
  orchestrator: {
    scrollTouch: { webContentsId: number; phase: "begin" | "end" }
  }
  pty: {
    data: { sessionId: string; data: string }
    exit: { sessionId: string; exitCode: number }
  }
  shortcut: {
    dispatched: { id: string; scope: string; originScope: string; windowId: string | null; paneId: string | null; ts: number }
  }
  setup: {
    /** A line of stdout/stderr from a setup.ts subprocess, streamed live. */
    progress: { pluginName: string; line: string }
  }
  cli: {
    /**
     * Emitted by `CliService.requestRelaunch` when an external `zen` invocation
     * wants the UI to confirm a restart. The renderer shows a modal and replies
     * via `CliService.confirmRelaunch(requestId, "accept" | "reject")`.
     */
    relaunchRequested: { requestId: string; pluginName: string; reason: string }
  }
  quickChat: {
    /**
     * Emitted by the quick-chat shortcut handler when the user presses
     * cmd+e. The orchestrator advice subscribes per-window; on match, it
     * resolves the focused agent, builds the turn-summary token, spawns a
     * cursor sub-agent, and mounts the floating chat modal.
     */
    openRequested: {
      windowId: string | null
      ts: number
    }
  }
  fileViewer: {
    /**
     * Emitted by `FileViewerService.callExtension` to ask the connected VSCode
     * extension (zenbu-bridge) to execute a stringified function against the
     * vscode API. The extension replies via `completeExtensionCall(requestId, ...)`.
     */
    extensionCallRequested: { requestId: string; fnString: string; context: unknown }
    /**
     * Emitted by `FileViewerService.openFile` so the orchestrator-level advice
     * opens the code-server iframe modal, regardless of whether the extension
     * ultimately navigates successfully.
     */
    openFileRequested: { filePath: string }
    /**
     * Emitted by the `file-viewer.toggleVscode` shortcut handler. Carries the
     * windowId so each orchestrator ignores toggles aimed at other windows.
     */
    vscodeToggleRequested: { windowId: string | null }
  }
}
