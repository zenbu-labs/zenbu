const agentId = new URLSearchParams(window.location.search).get("agentId") ?? ""

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (!(e.metaKey || e.ctrlKey)) return

  if (e.key === "\\" && !e.shiftKey) {
    e.preventDefault()
    window.parent.postMessage(
      { type: "zenbu-split", action: "split-horizontal", agentId },
      "*",
    )
    return
  }

  if (e.key === "\\" && e.shiftKey) {
    e.preventDefault()
    window.parent.postMessage(
      { type: "zenbu-split", action: "split-vertical", agentId },
      "*",
    )
    return
  }

  if (e.key === "n" && !e.shiftKey) {
    e.preventDefault()
    window.parent.postMessage(
      { type: "zenbu-split", action: "new-tab", agentId },
      "*",
    )
    return
  }
})
