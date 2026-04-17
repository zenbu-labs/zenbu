import { BaseWindow, WebContentsView } from "electron"

export function openDevtools(options: {
  controlPort: number
  rendererUrl: string
  wsPort: number
  viewId: string
}): BaseWindow {
  const win = new BaseWindow({
    width: 900,
    height: 600,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 12, y: 4 },
  })

  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.contentView.addChildView(view)

  const layout = () => {
    const { width, height } = win.getContentBounds()
    view.setBounds({ x: 0, y: 0, width, height })
  }

  layout()
  win.on("resize", layout)

  const url = `${options.rendererUrl}?controlPort=${options.controlPort}&wsPort=${options.wsPort}&viewId=${options.viewId}`
  view.webContents.loadURL(url)

  return win
}
