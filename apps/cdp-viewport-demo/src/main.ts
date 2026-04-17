import { app, BrowserWindow, WebContentsView, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow
let contentView: WebContentsView | null = null
let debuggerAttached = false

const CONTROL_BAR_HEIGHT = 140

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'orchestrator.html'))

  mainWindow.on('resize', () => {
    layoutContentView()
    if (contentView) {
      const bounds = contentView.getBounds()
      mainWindow.webContents.send('content-resized', {
        width: bounds.width,
        height: bounds.height,
      })
    }
  })
}

function layoutContentView() {
  if (!contentView || !mainWindow) return
  const [width, height] = mainWindow.getContentSize()
  contentView.setBounds({
    x: 0,
    y: CONTROL_BAR_HEIGHT,
    width,
    height: Math.max(0, height - CONTROL_BAR_HEIGHT),
  })
}

function destroyContentView() {
  if (!contentView) return
  if (debuggerAttached) {
    try {
      contentView.webContents.debugger.detach()
    } catch {}
    debuggerAttached = false
  }
  mainWindow.contentView.removeChildView(contentView)
  contentView.webContents.close()
  contentView = null
}

function ensureDebugger(): boolean {
  if (!contentView) return false
  if (!debuggerAttached) {
    try {
      contentView.webContents.debugger.attach('1.3')
      debuggerAttached = true
      contentView.webContents.debugger.on('detach', () => {
        debuggerAttached = false
      })
    } catch (e) {
      console.error('[main] debugger attach failed:', e)
      return false
    }
  }
  return true
}

ipcMain.handle('load-website', async (_event, url: string) => {
  console.log('[main] load-website:', url)
  destroyContentView()
  contentView = new WebContentsView()
  mainWindow.contentView.addChildView(contentView)
  layoutContentView()
  const bounds = contentView.getBounds()
  console.log('[main] contentView bounds:', bounds)
  await contentView.webContents.loadURL(url)
  console.log('[main] URL loaded')
  return { width: bounds.width, height: bounds.height }
})

ipcMain.handle('load-test-page', async () => {
  console.log('[main] load-test-page')
  destroyContentView()
  contentView = new WebContentsView()
  mainWindow.contentView.addChildView(contentView)
  layoutContentView()
  const bounds = contentView.getBounds()
  console.log('[main] contentView bounds:', bounds)
  const filePath = path.join(__dirname, 'test-page.html')
  console.log('[main] loading file:', filePath)
  await contentView.webContents.loadFile(filePath)
  console.log('[main] file loaded')
  return { width: bounds.width, height: bounds.height }
})

ipcMain.handle('set-viewport', async (_event, width: number, height: number) => {
  if (!ensureDebugger()) return false
  await contentView!.webContents.debugger.sendCommand(
    'Emulation.setDeviceMetricsOverride',
    {
      width: Math.round(width),
      height: Math.round(height),
      deviceScaleFactor: 0,
      mobile: false,
    },
  )
  return true
})

ipcMain.handle(
  'animate-viewport',
  async (
    _event,
    fromWidth: number,
    toWidth: number,
    durationMs: number,
  ) => {
    if (!contentView || !ensureDebugger()) return null

    const wc = contentView.webContents
    const bounds = contentView.getBounds()
    const height = bounds.height
    const startTime = performance.now()
    let frameCount = 0
    let lastWidth = -1

    return new Promise<{
      frames: number
      durationMs: number
      avgFps: number
    }>((resolve) => {
      const tick = () => {
        const now = performance.now()
        const elapsed = now - startTime
        const t = Math.min(elapsed / durationMs, 1)

        // easeInOutCubic
        const ease =
          t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2

        const w = Math.round(fromWidth + (toWidth - fromWidth) * ease)

        if (w !== lastWidth) {
          wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
            width: w,
            height,
            deviceScaleFactor: 0,
            mobile: false,
          })
          lastWidth = w
          frameCount++
        }

        mainWindow.webContents.send('viewport-update', {
          width: w,
          height,
          progress: t,
          fps: elapsed > 0 ? frameCount / (elapsed / 1000) : 0,
        })

        if (t < 1) {
          setTimeout(tick, 16)
        } else {
          const totalMs = performance.now() - startTime
          resolve({
            frames: frameCount,
            durationMs: Math.round(totalMs),
            avgFps: Math.round(frameCount / (totalMs / 1000)),
          })
        }
      }
      tick()
    })
  },
)

ipcMain.handle('reset-viewport', async () => {
  if (!contentView || !debuggerAttached) return false
  await contentView.webContents.debugger.sendCommand(
    'Emulation.clearDeviceMetricsOverride',
  )
  return true
})

ipcMain.handle('get-content-size', () => {
  if (!contentView) return null
  const bounds = contentView.getBounds()
  return { width: bounds.width, height: bounds.height }
})

app.whenReady().then(() => {
  createWindow()
  mainWindow.webContents.openDevTools({ mode: 'detach' })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
