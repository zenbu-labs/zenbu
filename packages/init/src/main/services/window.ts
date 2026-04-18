import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BrowserWindow,
  WebContentsView,
  Menu,
  app,
  clipboard,
  dialog,
  globalShortcut,
  shell,
} from "electron";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import { makeCollection } from "@zenbu/kyju/schema";
import electronContextMenu from "electron-context-menu";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";
import { HttpService } from "./http";
import { ReloaderService } from "./reloader";
import { RpcService } from "./rpc";
import { registerAdvice, registerContentScript } from "./advice-config";
import { insertHotAgent, type ArchivedAgent } from "../../../shared/agent-ops";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_VIEW_PATH = "/views/orchestrator/index.html";
const DEFAULT_CWD = path.join(os.homedir(), ".zenbu");

export class WindowService extends Service {
  static key = "window";
  static deps = {
    baseWindow: "base-window",
    db: DbService,
    http: HttpService,
    reloader: ReloaderService,
    rpc: RpcService,
  };
  declare ctx: {
    baseWindow: any;
    db: DbService;
    http: HttpService;
    reloader: ReloaderService;
    rpc: RpcService;
  };

  private views = new Map<
    string,
    { win: Electron.BaseWindow; view: WebContentsView }
  >();
  private _mountNewWindows: (() => void) | null = null;
  private previewWindows = new Map<string, BrowserWindow>();
  private pendingTearOffs = new Map<
    string,
    {
      sourceWindowId: string;
      sessionId: string;
      agentId: string;
    }
  >();

  async createWindowWithAgent() {
    const { baseWindow, db } = this.ctx;
    const client = db.client;
    const kernel = client.readRoot().plugin.kernel;
    const selectedConfig =
      kernel.agentConfigs.find((c) => c.id === kernel.selectedConfigId) ??
      kernel.agentConfigs[0];
    if (!selectedConfig) return { windowId: "", agentId: "" };

    const windowId = nanoid();
    const agentId = nanoid();
    const sessionId = nanoid();

    let evicted: ArchivedAgent[] = [];
    await Effect.runPromise(
      client.update((root) => {
        const k = root.plugin.kernel;
        evicted = insertHotAgent(k, {
          id: agentId,
          name: selectedConfig.name,
          startCommand: selectedConfig.startCommand,
          configId: selectedConfig.id,
          status: "idle",
          metadata: { cwd: DEFAULT_CWD },
          eventLog: makeCollection({
            collectionId: nanoid(),
            debugName: "eventLog",
          }),
          title: { kind: "not-available" },
          reloadMode: "keep-alive",
          sessionId: null,
          firstPromptSentAt: null,
          createdAt: Date.now(),
        });
        k.windowStates = [
          ...k.windowStates,
          {
            id: windowId,
            sessions: [{ id: sessionId, agentId, lastViewedAt: null }],
            panes: [],
            rootPaneId: null,
            focusedPaneId: null,
            sidebarOpen: false,
            tabSidebarOpen: true,
            sidebarPanel: "overview",
          },
        ];
      }),
    );
    if (evicted.length > 0) {
      await Effect.runPromise(
        client.plugin.kernel.archivedAgents.concat(evicted),
      ).catch(() => {});
    }

    baseWindow.createWindow({ windowId });
    this._mountNewWindows?.();
    return { windowId, agentId };
  }

  async createWindowWithLastOrNewAgent() {
    const { baseWindow, db } = this.ctx;
    const client = db.client;
    const kernel = client.readRoot().plugin.kernel;
    const lastAgent = kernel.agents
      .filter((a) => a.lastUserMessageAt != null)
      .sort(
        (a, b) => (b.lastUserMessageAt ?? 0) - (a.lastUserMessageAt ?? 0),
      )[0];

    if (!lastAgent) return this.createWindowWithAgent();

    const windowId = nanoid();
    const sessionId = nanoid();
    await Effect.runPromise(
      client.update((root) => {
        root.plugin.kernel.windowStates = [
          ...root.plugin.kernel.windowStates,
          {
            id: windowId,
            sessions: [
              { id: sessionId, agentId: lastAgent.id, lastViewedAt: null },
            ],
            panes: [],
            rootPaneId: null,
            focusedPaneId: null,
            sidebarOpen: false,
            tabSidebarOpen: true,
            sidebarPanel: "overview",
          },
        ];
      }),
    );

    baseWindow.createWindow({ windowId });
    this._mountNewWindows?.();
    return { windowId, agentId: lastAgent.id };
  }

  private getFocusedWebContents(): Electron.WebContents | undefined {
    for (const { win, view } of this.views.values()) {
      if (win.isFocused()) return view.webContents;
    }
    return undefined;
  }

  async showContextMenu(
    items: { id: string; label: string; enabled?: boolean }[],
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const template = items.map((item) => ({
        label: item.label,
        enabled: item.enabled ?? true,
        click: () => resolve(item.id),
      }));
      const menu = Menu.buildFromTemplate(template);
      menu.popup({ callback: () => resolve(null) });
    });
  }

  async pickFiles(): Promise<string[] | null> {
    const focusedWin = [...this.ctx.baseWindow.windows.values()].find(
      (w: Electron.BaseWindow) => w.isFocused(),
    );
    const result = await dialog.showOpenDialog({
      ...(focusedWin ? { window: focusedWin } : {}),
      properties: ["openFile", "multiSelections"],
      title: "Add Context Files",
    } as Electron.OpenDialogOptions);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths;
  }

  async pickDirectory(): Promise<string | null> {
    const focusedWin = [...this.ctx.baseWindow.windows.values()].find(
      (w: Electron.BaseWindow) => w.isFocused(),
    );
    const result = await dialog.showOpenDialog({
      ...(focusedWin ? { window: focusedWin } : {}),
      properties: ["openDirectory", "createDirectory"],
      title: "Choose Directory",
    } as Electron.OpenDialogOptions);

    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0]!;
  }

  async moveTabToNewWindow(opts: {
    sourceWindowId: string;
    sessionId: string;
  }): Promise<{ windowId: string } | null> {
    const { baseWindow, db } = this.ctx;
    const client = db.client;
    const kernel = client.readRoot().plugin.kernel;

    const sourceWinState = (kernel.windowStates ?? []).find(
      (ws) => ws.id === opts.sourceWindowId,
    );
    if (!sourceWinState) return null;

    const session = sourceWinState.sessions.find(
      (s) => s.id === opts.sessionId,
    );
    if (!session) return null;

    const windowId = nanoid();
    const newSessionId = nanoid();

    const sourceWin = baseWindow.windows.get(opts.sourceWindowId);
    const bounds = sourceWin?.getBounds();

    await Effect.runPromise(
      client.update((root) => {
        const k = root.plugin.kernel;
        k.windowStates = [
          ...(k.windowStates ?? []),
          {
            id: windowId,
            sessions: [
              {
                id: newSessionId,
                agentId: session.agentId,
                lastViewedAt: null,
              },
            ],
            panes: [],
            rootPaneId: null,
            focusedPaneId: null,
            sidebarOpen: false,
            tabSidebarOpen: true,
            sidebarPanel: "overview",
          },
        ];
        const srcWs = k.windowStates.find(
          (ws) => ws.id === opts.sourceWindowId,
        );
        if (srcWs) {
          srcWs.sessions = srcWs.sessions.filter(
            (s) => s.id !== opts.sessionId,
          );
        }
      }),
    );

    baseWindow.createWindow({
      windowId,
      ...(bounds
        ? {
            x: bounds.x + 30,
            y: bounds.y + 30,
            width: bounds.width,
            height: bounds.height,
          }
        : {}),
    });
    this._mountNewWindows?.();
    return { windowId };
  }

  async beginTabTearOff(opts: {
    sourceWindowId: string;
    sessionId: string;
    screenX: number;
    screenY: number;
  }): Promise<{ previewWindowId: string } | null> {
    const { baseWindow, db } = this.ctx;
    const client = db.client;
    const kernel = client.readRoot().plugin.kernel;

    const sourceWinState = (kernel.windowStates ?? []).find(
      (ws) => ws.id === opts.sourceWindowId,
    );
    if (!sourceWinState) return null;

    const session = sourceWinState.sessions.find(
      (s) => s.id === opts.sessionId,
    );
    if (!session) return null;

    const agentId = session.agentId;

    await Effect.runPromise(
      client.update((root) => {
        const srcWs = (root.plugin.kernel.windowStates ?? []).find(
          (ws) => ws.id === opts.sourceWindowId,
        );
        if (srcWs) {
          srcWs.sessions = srcWs.sessions.filter(
            (s) => s.id !== opts.sessionId,
          );
        }
      }),
    );

    const viewEntry = this.views.get(opts.sourceWindowId);
    if (!viewEntry) return null;

    const sourceWin = baseWindow.windows.get(opts.sourceWindowId);
    const sourceBounds = sourceWin?.getBounds();
    const srcWidth = sourceBounds?.width ?? 1200;
    const srcHeight = sourceBounds?.height ?? 800;

    const scale = 0.4;
    const previewWidth = Math.round(srcWidth * scale);
    const previewHeight = Math.round(srcHeight * scale);

    const previewId = nanoid();
    const x = Math.round(opts.screenX - previewWidth / 2);
    const y = Math.round(opts.screenY - 20);

    const preview = new BrowserWindow({
      width: previewWidth,
      height: previewHeight,
      x,
      y,
      frame: false,
      hasShadow: true,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      resizable: false,
      roundedCorners: true,
      backgroundColor: "#F4F4F4",
      webPreferences: { sandbox: true, contextIsolation: true },
    });

    const blankHtml = `<!DOCTYPE html>
<html><head><style>
  *{margin:0;padding:0}
  body{overflow:hidden;background:#F4F4F4}
  img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
</style></head><body></body></html>`;

    await preview.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(blankHtml)}`,
    );
    preview.setIgnoreMouseEvents(true);
    preview.showInactive();

    // Capture chat view screenshot in the background and swap it in
    const captureScreenshot = async () => {
      try {
        const { reloader, http } = this.ctx;
        const coreEntry = reloader.get("core");
        const chatRegistry = (kernel.viewRegistry ?? []).find(
          (v) => v.scope === "chat",
        );
        let screenshotDataUrl = "";
        if (coreEntry && chatRegistry) {
          const chatPath = new URL(chatRegistry.url).pathname;
          const chatUrl = `http://localhost:${http.port}${chatPath}/index.html?agentId=${agentId}&wsPort=${http.port}`;

          const offscreen = new WebContentsView({
            webPreferences: {
              sandbox: true,
              contextIsolation: true,
              nodeIntegration: false,
              offscreen: true,
            },
          });
          offscreen.setBounds({
            x: 0,
            y: 0,
            width: srcWidth,
            height: srcHeight,
          });

          const sourceWinRef = baseWindow.windows.get(opts.sourceWindowId);
          if (sourceWinRef) {
            sourceWinRef.contentView.addChildView(offscreen, 0);
          }

          await offscreen.webContents.loadURL(chatUrl);
          await new Promise((r) => setTimeout(r, 500));

          const image = await offscreen.webContents.capturePage();
          screenshotDataUrl = image.toDataURL();

          if (sourceWinRef) {
            sourceWinRef.contentView.removeChildView(offscreen);
          }
          offscreen.webContents.close();
        } else {
          const image = await viewEntry.view.webContents.capturePage();
          screenshotDataUrl = image.toDataURL();
        }

        if (screenshotDataUrl && !preview.isDestroyed()) {
          preview.webContents.executeJavaScript(
            `document.body.innerHTML = '<img src="${screenshotDataUrl}">'`,
          );
        }
      } catch {}
    };
    captureScreenshot();

    this.previewWindows.set(previewId, preview);
    this.pendingTearOffs.set(previewId, {
      sourceWindowId: opts.sourceWindowId,
      sessionId: opts.sessionId,
      agentId,
    });

    preview.on("closed", () => {
      this.previewWindows.delete(previewId);
      this.pendingTearOffs.delete(previewId);
    });

    return { previewWindowId: previewId };
  }

  updateDragWindowPosition(opts: {
    windowId: string;
    screenX: number;
    screenY: number;
  }) {
    const preview = this.previewWindows.get(opts.windowId);
    if (preview && !preview.isDestroyed()) {
      const { width, height } = preview.getBounds();
      preview.setBounds({
        x: Math.round(opts.screenX - width / 2),
        y: Math.round(opts.screenY - 20),
        width,
        height,
      });
      return;
    }
    const win = this.ctx.baseWindow.windows.get(opts.windowId);
    if (!win) return;
    const bounds = win.getBounds();
    win.setPosition(
      Math.round(opts.screenX - bounds.width / 2),
      Math.round(opts.screenY - 20),
    );
  }

  async finalizeTearOff(opts: {
    previewWindowId: string;
    screenX: number;
    screenY: number;
  }): Promise<{ windowId: string } | null> {
    const pending = this.pendingTearOffs.get(opts.previewWindowId);
    if (!pending) return null;

    const preview = this.previewWindows.get(opts.previewWindowId);
    if (preview && !preview.isDestroyed()) preview.close();

    const { baseWindow, db } = this.ctx;
    const client = db.client;

    const windowId = nanoid();
    const newSessionId = nanoid();

    const sourceWin = baseWindow.windows.get(pending.sourceWindowId);
    const sourceBounds = sourceWin?.getBounds();
    const width = sourceBounds?.width ?? 1200;
    const height = sourceBounds?.height ?? 800;

    await Effect.runPromise(
      client.update((root) => {
        const k = root.plugin.kernel;
        k.windowStates = [
          ...(k.windowStates ?? []),
          {
            id: windowId,
            sessions: [
              {
                id: newSessionId,
                agentId: pending.agentId,
                lastViewedAt: null,
              },
            ],
            panes: [],
            rootPaneId: null,
            focusedPaneId: null,
            sidebarOpen: false,
            tabSidebarOpen: true,
            sidebarPanel: "overview",
          },
        ];
      }),
    );

    const x = Math.round(opts.screenX - width / 2);
    const y = Math.round(opts.screenY - 20);

    baseWindow.createWindow({ windowId, x, y, width, height, show: false });
    const newWin = baseWindow.windows.get(windowId);
    if (newWin) {
      newWin.showInactive();
      newWin.focus();
    }

    this._mountNewWindows?.();
    return { windowId };
  }

  async cancelTearOff(opts: { previewWindowId: string }) {
    const pending = this.pendingTearOffs.get(opts.previewWindowId);

    const preview = this.previewWindows.get(opts.previewWindowId);
    if (preview && !preview.isDestroyed()) preview.close();
    this.pendingTearOffs.delete(opts.previewWindowId);
    this.previewWindows.delete(opts.previewWindowId);

    if (pending) {
      const client = this.ctx.db.client;
      await Effect.runPromise(
        client.update((root) => {
          const srcWs = (root.plugin.kernel.windowStates ?? []).find(
            (ws) => ws.id === pending.sourceWindowId,
          );
          if (srcWs) {
            srcWs.sessions = [
              ...srcWs.sessions,
              {
                id: pending.sessionId,
                agentId: pending.agentId,
                lastViewedAt: null,
              },
            ];
          }
        }),
      );
    }
  }

  async openInFinder(dirPath: string) {
    await shell.openPath(dirPath);
  }

  async openExternal(url: string) {
    await shell.openExternal(url);
  }

  async copyToClipboard(text: string) {
    clipboard.writeText(text);
  }

  async confirm(opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    windowId?: string;
  }): Promise<boolean> {
    const win = opts.windowId
      ? this.ctx.baseWindow.windows.get(opts.windowId)
      : [...this.ctx.baseWindow.windows.values()].find(
          (w: Electron.BaseWindow) => w.isFocused(),
        );
    const msgOpts: Electron.MessageBoxOptions = {
      type: "question",
      message: opts.title,
      detail: opts.message,
      buttons: [opts.cancelLabel ?? "Cancel", opts.confirmLabel ?? "OK"],
      defaultId: 1,
      cancelId: 0,
    };
    const result = win
      ? await dialog.showMessageBox(win, msgOpts)
      : await dialog.showMessageBox(msgOpts);
    return result.response === 1;
  }

  evaluate() {
    const { baseWindow, db, http, reloader, rpc } = this.ctx;

    this.effect("preview-cleanup", () => {
      return () => {
        for (const preview of this.previewWindows.values()) {
          if (!preview.isDestroyed()) preview.close();
        }
        this.previewWindows.clear();
        this.pendingTearOffs.clear();
      };
    });

    this.effect("content-views", () => {
      const viewEntries = this.views;
      const scrollTouchHandlers = new Map<
        Electron.WebContents,
        { begin: () => void; end: () => void }
      >();

      let currentViewPath =
        db.client.readRoot().plugin.kernel.orchestratorViewPath ??
        DEFAULT_VIEW_PATH;

      const attachView = (
        windowId: string,
        win: Electron.BaseWindow,
        viewPath: string,
      ) => {
        const view = new WebContentsView({
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            partition: "persist:renderer",
          },
        });

        view.setBackgroundColor("#F4F4F4");
        win.contentView.addChildView(view);

        const layout = () => {
          const { width, height } = win.getContentBounds();
          view.setBounds({ x: 0, y: 0, width, height });
        };
        layout();
        win.on("resize", layout);

        const emitScrollTouch = (phase: "begin" | "end") => {
          rpc.emit.orchestrator.scrollTouch({
            webContentsId: view.webContents.id,
            phase,
          });
        };
        const onScrollTouchBegin = () => emitScrollTouch("begin");
        const onScrollTouchEnd = () => emitScrollTouch("end");
        const scrollTouchWebContents = view.webContents as any;
        scrollTouchHandlers.set(view.webContents, {
          begin: onScrollTouchBegin,
          end: onScrollTouchEnd,
        });
        scrollTouchWebContents.on("scroll-touch-begin", onScrollTouchBegin);
        scrollTouchWebContents.on("scroll-touch-end", onScrollTouchEnd);

        const cwd = process.cwd();
        const qs = `wsPort=${http.port}&cwd=${encodeURIComponent(
          cwd,
        )}&defaultCwd=${encodeURIComponent(
          DEFAULT_CWD,
        )}&webContentsId=${view.webContents.id}&windowId=${encodeURIComponent(
          windowId,
        )}`;
        let url: string;
        if (viewPath.startsWith("http://") || viewPath.startsWith("https://")) {
          const sep = viewPath.includes("?") ? "&" : "?";
          url = `${viewPath}${sep}${qs}`;
        } else {
          const coreEntry = reloader.get("core");
          if (!coreEntry) return;
          const base = coreEntry.url.replace(/\/$/, "");
          url = `${base}${viewPath}?${qs}`;
        }
        view.webContents.loadURL(url);

        viewEntries.set(windowId, { win, view });

        let closeDialogOpen = false;
        const onClose = (event: Electron.Event) => {
          event.preventDefault();
          if (closeDialogOpen) return;
          closeDialogOpen = true;
          dialog
            .showMessageBox(win, {
              type: "question",
              message: "Close window?",
              detail: "This will close any active sessions in this window.",
              buttons: ["Cancel", "Close"],
              defaultId: 1,
              cancelId: 0,
            })
            .then((result) => {
              closeDialogOpen = false;
              if (result.response === 1) {
                (win as any).__zenbu_on_close = null;
                win.close();
              }
            });
        };
        const onClosed = () => {
          Effect.runPromise(
            db.client.update((root) => {
              root.plugin.kernel.windowStates = (
                root.plugin.kernel.windowStates ?? []
              ).filter((ws) => ws.id !== windowId);
            }),
          ).catch(() => {});
        };

        /**
         * nonsense will be deleted
         */
        if (!(win as any).__zenbu_close_attached) {
          (win as any).__zenbu_close_attached = true;
          win.on("close", (event: Electron.Event) => {
            const cb = (win as any).__zenbu_on_close;
            if (cb) cb(event);
          });
          win.on("closed", () => {
            const cb = (win as any).__zenbu_on_closed;
            if (cb) cb();
          });
        }
        (win as any).__zenbu_on_close = onClose;
        (win as any).__zenbu_on_closed = onClosed;
      };

      const teardownAllViews = () => {
        for (const { win, view } of viewEntries.values()) {
          try {
            if (!win.isDestroyed()) {
              (win as any).__zenbu_on_close = null;
              (win as any).__zenbu_on_closed = null;
            }
            const wc = view.webContents;
            if (wc) {
              const handlers = scrollTouchHandlers.get(wc);
              if (handlers) {
                (wc as any).off("scroll-touch-begin", handlers.begin);
                (wc as any).off("scroll-touch-end", handlers.end);
              }
              if (!wc.isDestroyed()) wc.close();
            }
            if (!win.isDestroyed()) {
              win.contentView.removeChildView(view);
            }
          } catch {}
        }
        scrollTouchHandlers.clear();
        this.views = new Map();
      };

      const mountNew = () => {
        for (const [windowId, win] of baseWindow.windows) {
          if (viewEntries.has(windowId)) continue;
          attachView(windowId, win, currentViewPath);
        }
      };

      this._mountNewWindows = mountNew;
      mountNew();

      const unsub = db.client.plugin.kernel.orchestratorViewPath.subscribe(
        (newPath) => {
          const resolved = newPath || DEFAULT_VIEW_PATH;
          if (resolved === currentViewPath) return;
          currentViewPath = resolved;
          teardownAllViews();
          mountNew();
        },
      );

      return () => {
        unsub();
        this._mountNewWindows = null;
        teardownAllViews();
      };
    });

    this.effect("composer-cwd-advice", () => {
      return registerAdvice("chat", {
        moduleId: "views/chat/components/Composer.tsx",
        name: "Composer",
        type: "around",
        modulePath: path.resolve(
          __dirname,
          "..",
          "..",
          "renderer",
          "views",
          "orchestrator",
          "advice",
          "composer-cwd.tsx",
        ),
        exportName: "ComposerWrapper",
      });
    });

    this.effect("no-minimap-advice", () => {
      return registerAdvice("chat", {
        moduleId: "views/chat/components/Minimap.tsx",
        name: "Minimap",
        type: "replace",
        modulePath: path.resolve(
          __dirname,
          "..",
          "..",
          "renderer",
          "views",
          "orchestrator",
          "advice",
          "no-minimap.tsx",
        ),
        exportName: "MinimapNoOp",
      });
    });

    this.effect("devtools-shortcut", () => {
      const accelerator =
        process.platform === "darwin"
          ? "CommandOrControl+Option+I"
          : "CommandOrControl+Shift+I";
      globalShortcut.register(accelerator, () => {
        this.getFocusedWebContents()?.toggleDevTools();
      });
      return () => {
        globalShortcut.unregister(accelerator);
      };
    });

    this.effect("context-menu", () => {
      const handler = (
        _event: Electron.Event,
        contents: Electron.WebContents,
      ) => {
        electronContextMenu({ window: contents, showInspectElement: true });
      };
      app.on("web-contents-created", handler);
      return () => {
        app.off("web-contents-created", handler);
      };
    });

    this.effect("dock-menu", () => {
      if (process.platform !== "darwin") return;
      app.dock?.setMenu(
        Menu.buildFromTemplate([
          {
            label: "New Window",
            click: () => {
              this.createWindowWithAgent();
            },
          },
        ]),
      );
    });

    this.effect("activate", () => {
      const handler = () => {
        if (baseWindow.windows.size === 0) {
          this.createWindowWithLastOrNewAgent();
        }
      };
      app.on("activate", handler);
      return () => {
        app.off("activate", handler);
      };
    });

    this.effect("focused-window-tracking", () => {
      const tracked = new Map<
        Electron.BaseWindow,
        { windowId: string; onFocus: () => void; onBlur: () => void }
      >();

      const writeFocusedWindowId = (id: string | null) => {
        Effect.runPromise(
          db.client.update((root) => {
            if (root.plugin.kernel.focusedWindowId !== id) {
              root.plugin.kernel.focusedWindowId = id;
            }
          }),
        ).catch(() => {});
      };

      const attachIfNew = (windowId: string, win: Electron.BaseWindow) => {
        if (tracked.has(win)) return;
        const onFocus = () => writeFocusedWindowId(windowId);
        const onBlur = () => {
          // Only clear if no other window immediately takes focus. Electron
          // delivers focus on the new window synchronously after blur, so a
          // microtask is enough to debounce.
          queueMicrotask(() => {
            const anyFocused = [...baseWindow.windows.values()].some(
              (w: Electron.BaseWindow) => !w.isDestroyed() && w.isFocused(),
            );
            if (!anyFocused) writeFocusedWindowId(null);
          });
        };
        win.on("focus", onFocus);
        win.on("blur", onBlur);
        tracked.set(win, { windowId, onFocus, onBlur });
        if (win.isFocused()) writeFocusedWindowId(windowId);
      };

      const sweep = () => {
        for (const [windowId, win] of baseWindow.windows) {
          attachIfNew(windowId, win);
        }
        for (const [win, entry] of tracked) {
          if (!baseWindow.windows.get(entry.windowId)) {
            tracked.delete(win);
          }
        }
      };
      sweep();

      const interval = setInterval(sweep, 500);

      return () => {
        clearInterval(interval);
        for (const [win, { onFocus, onBlur }] of tracked) {
          try {
            win.off("focus", onFocus);
            win.off("blur", onBlur);
          } catch {}
        }
        tracked.clear();
      };
    });

    console.log(`[window] service ready (${baseWindow.windows.size} windows)`);
  }
}

runtime.register(WindowService, (import.meta as any).hot);
