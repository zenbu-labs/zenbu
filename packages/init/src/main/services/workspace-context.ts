import { Service } from "../runtime"

type ActivationCb = (windowId: string) => void | Promise<void>

export class WorkspaceContextService extends Service {
  static key = "workspace-context"
  static deps = {}

  workspaceId: string | null = null
  cwds: string[] = []

  private activatedCbs: ActivationCb[] = []
  private deactivatedCbs: ActivationCb[] = []

  onActivated(cb: ActivationCb): () => void {
    this.activatedCbs.push(cb)
    return () => {
      this.activatedCbs = this.activatedCbs.filter((c) => c !== cb)
    }
  }

  onDeactivated(cb: ActivationCb): () => void {
    this.deactivatedCbs.push(cb)
    return () => {
      this.deactivatedCbs = this.deactivatedCbs.filter((c) => c !== cb)
    }
  }

  async fireActivated(windowId: string) {
    for (const cb of this.activatedCbs) {
      try {
        await cb(windowId)
      } catch (e) {
        console.error(
          `[workspace-context] onActivated callback failed for ${this.workspaceId}:`,
          e,
        )
      }
    }
  }

  async fireDeactivated(windowId: string) {
    for (const cb of this.deactivatedCbs) {
      try {
        await cb(windowId)
      } catch (e) {
        console.error(
          `[workspace-context] onDeactivated callback failed for ${this.workspaceId}:`,
          e,
        )
      }
    }
  }

  evaluate() {}
}
