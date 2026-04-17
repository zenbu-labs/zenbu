const path = require("node:path")
const os = require("node:os")
const fs = require("node:fs")
const { spawn } = require("node:child_process")
const { ipcRenderer } = require("electron")

const REPO_URL = "https://github.com/zenbu-labs/zenbu.git"
const pluginDir = path.join(os.homedir(), ".zenbu", "plugins", "zenbu")

const stepsEl = document.getElementById("steps")
const logEl = document.getElementById("log")
const errorEl = document.getElementById("error")
const successEl = document.getElementById("success")
const retryBtn = document.getElementById("retryBtn")

/** Map of stepId -> { el, state } */
const steps = new Map()
const logLines = []

function addStep(id, title) {
  if (steps.has(id)) return steps.get(id)
  const el = document.createElement("div")
  el.className = "step pending"
  el.innerHTML = `
    <div class="icon">○</div>
    <div class="title"></div>
    <div class="detail"></div>
  `
  el.querySelector(".title").textContent = title
  stepsEl.appendChild(el)
  const entry = { el, state: "pending" }
  steps.set(id, entry)
  return entry
}

function setStep(id, state, detail) {
  const entry = steps.get(id)
  if (!entry) return
  entry.el.classList.remove(entry.state)
  entry.el.classList.add(state)
  entry.state = state
  const iconEl = entry.el.querySelector(".icon")
  const detailEl = entry.el.querySelector(".detail")
  switch (state) {
    case "in-progress":
      iconEl.innerHTML = '<div class="spinner"></div>'
      break
    case "done":
      iconEl.textContent = "✓"
      break
    case "error":
      iconEl.textContent = "×"
      break
    case "pending":
      iconEl.textContent = "○"
      break
  }
  if (detail !== undefined) detailEl.textContent = detail
}

function appendLog(line) {
  logLines.push(line)
  // Keep only recent lines
  if (logLines.length > 40) logLines.shift()
  logEl.textContent = logLines.join("\n")
  logEl.scrollTop = logEl.scrollHeight
}

function showError(msg) {
  errorEl.textContent = msg
  errorEl.style.display = "block"
  retryBtn.style.display = "inline-block"
}

function showSuccess(msg) {
  successEl.textContent = msg
  successEl.style.display = "block"
}

function renderInstallOffer(stepId, tool, cmd) {
  const entry = steps.get(stepId)
  if (!entry) return
  const existing = entry.el.nextElementSibling
  if (existing && existing.classList.contains("install-offer")) return
  const offer = document.createElement("div")
  offer.className = "install-offer"
  offer.innerHTML = `
    <span>Install <strong>${tool}</strong>:</span>
    <code>${cmd}</code>
  `
  entry.el.after(offer)
}

/** Parse a single protocol line, return true if recognized. */
function handleProtocolLine(line) {
  const m = /^##ZENBU_STEP:([a-z-]+):(.+)$/.exec(line)
  if (!m) return false
  const event = m[1]
  const rest = m[2]
  switch (event) {
    case "start": {
      const [stepId, ...titleParts] = rest.split(":")
      const title = titleParts.join(":")
      addStep(stepId, title || stepId)
      setStep(stepId, "in-progress")
      return true
    }
    case "done": {
      const stepId = rest
      if (!steps.has(stepId)) addStep(stepId, stepId)
      setStep(stepId, "done")
      return true
    }
    case "error": {
      const [stepId, ...msgParts] = rest.split(":")
      const msg = msgParts.join(":")
      if (!steps.has(stepId)) addStep(stepId, stepId)
      setStep(stepId, "error", msg)
      showError(msg || `Step ${stepId} failed`)
      return true
    }
    case "offer-install": {
      const [tool, ...cmdParts] = rest.split(":")
      const cmd = cmdParts.join(":")
      // Attach to the most-recent in-progress step (most likely ensure_git)
      const recent = [...steps.entries()].reverse().find(([, e]) => e.state === "in-progress")
      if (recent) renderInstallOffer(recent[0], tool, cmd)
      return true
    }
    case "download":
    case "all-done":
      return true
    default:
      return false
  }
}

function handleOutput(buffer) {
  for (const rawLine of buffer.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (!line) continue
    if (handleProtocolLine(line)) continue
    appendLog(line)
    pushRecent(line)
  }
}

/** Ring buffer of the last N non-protocol log lines, for error surfacing. */
const recentLog = []
function pushRecent(line) {
  recentLog.push(line)
  if (recentLog.length > 30) recentLog.shift()
}

function runCommand(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: Object.assign({}, process.env, { FORCE_COLOR: "0" }),
    })
    let stdoutBuf = ""
    let stderrBuf = ""
    proc.stdout.on("data", (data) => {
      stdoutBuf += data.toString()
      const lastNewline = stdoutBuf.lastIndexOf("\n")
      if (lastNewline !== -1) {
        handleOutput(stdoutBuf.slice(0, lastNewline))
        stdoutBuf = stdoutBuf.slice(lastNewline + 1)
      }
    })
    proc.stderr.on("data", (data) => {
      stderrBuf += data.toString()
      const lastNewline = stderrBuf.lastIndexOf("\n")
      if (lastNewline !== -1) {
        handleOutput(stderrBuf.slice(0, lastNewline))
        stderrBuf = stderrBuf.slice(lastNewline + 1)
      }
    })
    proc.on("close", (code) => {
      if (stdoutBuf) handleOutput(stdoutBuf)
      if (stderrBuf) handleOutput(stderrBuf)
      if (code === 0) resolve()
      else reject(new Error(cmd + " exited with code " + code))
    })
    proc.on("error", reject)
  })
}

async function run() {
  errorEl.style.display = "none"
  successEl.style.display = "none"
  retryBtn.style.display = "none"

  try {
    if (!fs.existsSync(pluginDir)) {
      addStep("clone", "Cloning zenbu repo")
      setStep("clone", "in-progress")
      fs.mkdirSync(path.dirname(pluginDir), { recursive: true })
      await runCommand(
        "git",
        ["clone", "--depth", "1", "--progress", REPO_URL, pluginDir],
        os.homedir(),
      )
      setStep("clone", "done")
    }

    const setupScript = path.join(pluginDir, "setup.sh")
    if (!fs.existsSync(setupScript)) {
      throw new Error("setup.sh missing at " + setupScript)
    }
    await runCommand("bash", [setupScript], pluginDir)

    showSuccess("Setup complete — launching…")
    setTimeout(() => ipcRenderer.send("relaunch"), 800)
  } catch (err) {
    // If setup.sh already emitted ##ZENBU_STEP:error, the error box is
    // already showing a useful line. Otherwise, surface the last few log
    // lines as a best-effort hint.
    const currentErr = errorEl.textContent
    if (!currentErr) {
      const tail = recentLog.slice(-5).join("\n").trim()
      const baseMsg = err && err.message ? err.message : String(err)
      showError(tail ? `${baseMsg}\n\n${tail}` : baseMsg)
    }
  }
}

retryBtn.addEventListener("click", () => {
  steps.clear()
  stepsEl.innerHTML = ""
  logLines.length = 0
  logEl.textContent = ""
  run()
})

run()
