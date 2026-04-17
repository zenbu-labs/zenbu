import { BaseWindow } from "electron"
import { nanoid } from "nanoid"
import { Service, runtime } from "../runtime"

type WindowBounds = { x: number; y: number; width: number; height: number }
type SavedWindow = { windowId: string; bounds: WindowBounds }

export class BaseWindowService extends Service {
  static key = "base-window"
  static deps = {}

  windows = new Map<string, BaseWindow>()
  private get savedWindows(): SavedWindow[] { return (globalThis as any).__zenbu_saved_windows__ ??= [] }
  private set savedWindows(v: SavedWindow[]) { (globalThis as any).__zenbu_saved_windows__ = v }

  private getZenWidth(): number | undefined {
    const flag = process.argv.find((a) => a.startsWith("--zen-width="))
    if (!flag) return undefined
    const n = parseInt(flag.slice("--zen-width=".length), 10)
    return isNaN(n) ? undefined : n
  }

  getWindowId(win: BaseWindow): string | undefined {
    for (const [id, w] of this.windows) {
      if (w === win) return id
    }
    return undefined
  }

  createWindow(opts?: Partial<WindowBounds> & { windowId?: string; show?: boolean }): { win: BaseWindow; windowId: string } {
    const windowId = opts?.windowId ?? nanoid()
    const zenWidth = this.getZenWidth()
    const win = new BaseWindow({
      width: opts?.width ?? zenWidth ?? 800,
      height: opts?.height ?? 900,
      ...(opts?.x != null && opts?.y != null
        ? { x: opts.x, y: opts.y }
        : {}),
        // 
      show: opts?.show ?? true,
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 12, y: 10 },
      backgroundColor: "#F4F4F4",
      // 
    })
    this.windows.set(windowId, win)
    win.on("closed", () => this.windows.delete(windowId))
    return { win, windowId }
  }

  evaluate() {
    if (this.windows.size === 0) {
      if (this.savedWindows.length > 0) {
        for (const saved of this.savedWindows) {
          this.createWindow({ windowId: saved.windowId, ...saved.bounds })
        }
        this.savedWindows = []
      } else {
        this.createWindow()
      }
    }

    this.effect("window-cleanup", () => {
      return () => {
        this.savedWindows = [...this.windows.entries()].map(([windowId, win]) => ({
          windowId,
          bounds: win.getBounds(),
        }))
        for (const win of this.windows.values()) {
          (win as any).__zenbu_on_close = null;
          (win as any).__zenbu_on_closed = null;
          win.close()
        }
        this.windows.clear()
      }
    })
    // 

    console.log(`[base-window] ready (${this.windows.size} windows)`)
  }
}

runtime.register(BaseWindowService, (import.meta as any).hot)
