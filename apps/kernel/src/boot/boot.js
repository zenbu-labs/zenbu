const { ipcRenderer } = require("electron")

const labelEl = document.getElementById("label")

ipcRenderer.on("zenbu:boot-status", (_event, payload) => {
  if (!payload || typeof payload !== "object") return
  if (typeof payload.message === "string") {
    labelEl.textContent = payload.message
  }
})

ipcRenderer.on("zenbu:boot-error", (_event, payload) => {
  if (!payload || typeof payload !== "object") return
  if (typeof payload.message === "string") {
    labelEl.textContent = payload.message
  }
})
