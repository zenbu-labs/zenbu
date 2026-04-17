const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  loadWebsite: (url) => ipcRenderer.invoke('load-website', url),
  loadTestPage: () => ipcRenderer.invoke('load-test-page'),
  setViewport: (width, height) => ipcRenderer.invoke('set-viewport', width, height),
  animateViewport: (fromWidth, toWidth, durationMs) =>
    ipcRenderer.invoke('animate-viewport', fromWidth, toWidth, durationMs),
  resetViewport: () => ipcRenderer.invoke('reset-viewport'),
  getContentSize: () => ipcRenderer.invoke('get-content-size'),
  onViewportUpdate: (callback) => {
    ipcRenderer.on('viewport-update', (_event, data) => callback(data))
  },
  onContentResized: (callback) => {
    ipcRenderer.on('content-resized', (_event, data) => callback(data))
  },
})
