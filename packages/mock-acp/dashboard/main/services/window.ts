import path from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { BaseWindow, WebContentsView, Menu, app } from "electron"
import { HttpService } from "./http"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !!process.env.ELECTRON_RENDERER_URL

export class WindowService extends Effect.Service<WindowService>()(
  "WindowService",
  {
    scoped: Effect.gen(function* () {
      const httpService = yield* HttpService
      const appWindows = new Set<BaseWindow>()

      if (process.platform === "darwin") {
        app.dock?.setMenu(
          Menu.buildFromTemplate([
            {
              label: "New Window",
              click: () => Effect.runSync(createAppWindow),
            },
          ]),
        )
      }

      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          for (const win of appWindows) win.close()
          console.log("[window] shutting down")
        }),
      )

      console.log("[window] service ready")

      const createAppWindow = Effect.gen(function* () {
        const baseWindow = new BaseWindow({
          width: 1100,
          height: 700,
          titleBarStyle: "hidden",
          trafficLightPosition: { x: 12, y: 4 },
          title: "Mock Agent Dashboard",
        })

        const orchestratorView = new WebContentsView({
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
          },
        })

        baseWindow.contentView.addChildView(orchestratorView)

        const layout = () => {
          const { width, height } = baseWindow.getContentBounds()
          orchestratorView.setBounds({ x: 0, y: 0, width, height })
        }

        layout()
        baseWindow.on("resize", layout)

        if (isDev) {
          const base = process.env.ELECTRON_RENDERER_URL!.replace(/\/$/, "")
          orchestratorView.webContents.loadURL(
            `${base}/orchestrator/index.html?wsPort=${httpService.port}`,
          )
        } else {
          orchestratorView.webContents.loadFile(
            path.join(__dirname, "../../renderer/orchestrator/index.html"),
            { query: { wsPort: String(httpService.port) } },
          )
        }

        appWindows.add(baseWindow)

        baseWindow.on("closed", () => {
          appWindows.delete(baseWindow)
        })
      })

      return {
        createAppWindow,
      } as const
    }),
  },
) {}
