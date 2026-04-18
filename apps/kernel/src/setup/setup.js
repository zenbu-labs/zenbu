const path = require("node:path")
const os = require("node:os")
const fs = require("node:fs")
const crypto = require("node:crypto")
const https = require("node:https")
const { spawn, execFileSync } = require("node:child_process")
const { ipcRenderer } = require("electron")

const REPO_URL = "https://github.com/zenbu-labs/zenbu.git"
const pluginDir = path.join(os.homedir(), ".zenbu", "plugins", "zenbu")

// Cache root layout matches what `packages/init/setup.ts` expects. See
// docs/objs/create-plugin.md for the invariants.
const CACHE_ROOT = path.join(os.homedir(), "Library", "Caches", "Zenbu")
const BIN_DIR = path.join(CACHE_ROOT, "bin")
const BUN_BIN = path.join(BIN_DIR, "bun")
const BUN_VERSION_MARKER = path.join(BIN_DIR, ".bun.version")
const SETUP_TS = path.join(pluginDir, "packages", "init", "setup.ts")

// Bun binary to bootstrap with. The kernel ships with one known-good
// version; from this point forward, `setup.ts` self-manages the bun
// binary (upgrading it when authors bump the version in `setup/versions.json`).
const BOOTSTRAP_BUN = {
  version: "1.3.12",
  targets: {
    "darwin-aarch64": {
      asset: "bun-darwin-aarch64.zip",
      sha256:
        "6c4bb87dd013ed1a8d6a16e357a3d094959fd5530b4d7061f7f3680c3c7cea1c",
    },
    "darwin-x64": {
      asset: "bun-darwin-x64.zip",
      sha256:
        "0f58c53a3e7947f1e626d2f8d285f97c14b7cadcca9c09ebafc0ae9d35b58c3d",
    },
  },
}

function detectBunTarget() {
  const arch = os.arch()
  if (arch === "arm64") return "darwin-aarch64"
  if (arch === "x64") return "darwin-x64"
  throw new Error(`unsupported architecture: ${arch}`)
}

const quietEl = document.getElementById("quiet")
const verboseEl = document.getElementById("verbose")
const quietLabelEl = document.getElementById("quietLabel")
const errorTextEl = document.getElementById("errorText")
const logEl = document.getElementById("log")
const copyBtn = document.getElementById("copyBtn")
const retryBtn = document.getElementById("retryBtn")
const disclosureBtn = document.getElementById("disclosure")
const disclosureLabel = document.getElementById("disclosureLabel")

/** All log lines (step markers + raw stdout/stderr), in order. */
const logLines = []
/** The most recent step title, used if the process exits with no ZENBU_STEP:error. */
let lastStartedStep = null

function appendLog(line) {
  logLines.push(line)
  if (logLines.length > 400) logLines.shift()
  logEl.textContent = logLines.join("\n")
  if (disclosureBtn.getAttribute("aria-expanded") === "true") {
    logEl.scrollTop = logEl.scrollHeight
  }
}

function setErrorText(msg) {
  errorTextEl.textContent = msg
}

function swapToVerbose() {
  quietEl.style.display = "none"
  verboseEl.style.display = "flex"
}

function resetVerbose() {
  logLines.length = 0
  logEl.textContent = ""
  errorTextEl.textContent = ""
  verboseEl.style.display = "none"
  quietEl.style.display = "flex"
  quietLabelEl.textContent = "Completing install…"
  disclosureBtn.setAttribute("aria-expanded", "false")
  disclosureLabel.textContent = "Show log"
  logEl.style.display = "none"
  lastStartedStep = null
}

disclosureBtn.addEventListener("click", () => {
  const open = disclosureBtn.getAttribute("aria-expanded") === "true"
  const next = !open
  disclosureBtn.setAttribute("aria-expanded", String(next))
  logEl.style.display = next ? "block" : "none"
  disclosureLabel.textContent = next ? "Hide log" : "Show log"
  if (next) logEl.scrollTop = logEl.scrollHeight
})

copyBtn.addEventListener("click", async () => {
  const payload = [
    errorTextEl.textContent || "(no error)",
    "",
    "Log:",
    logLines.join("\n") || "(empty)",
  ].join("\n")
  let ok = false
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(payload)
      ok = true
    }
  } catch {}
  if (!ok) {
    try {
      const { clipboard } = require("electron")
      clipboard.writeText(payload)
      ok = true
    } catch {}
  }
  if (!ok) {
    try {
      const ta = document.createElement("textarea")
      ta.value = payload
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      ok = true
    } catch {}
  }
  if (ok) {
    const orig = copyBtn.textContent
    copyBtn.classList.add("copied")
    copyBtn.textContent = "Copied"
    setTimeout(() => {
      copyBtn.classList.remove("copied")
      copyBtn.textContent = orig
    }, 1200)
  }
})

/**
 * Parse a single `##ZENBU_STEP:` protocol line. Returns true if it was a
 * protocol line (and thus handled; caller should not re-append as raw log).
 */
function handleProtocolLine(line) {
  const m = /^##ZENBU_STEP:([a-z-]+):(.+)$/.exec(line)
  if (!m) return false
  const event = m[1]
  const rest = m[2]
  switch (event) {
    case "start": {
      const [stepId, ...titleParts] = rest.split(":")
      const title = titleParts.join(":") || stepId
      lastStartedStep = title
      appendLog(`→ ${title}`)
      return true
    }
    case "done": {
      // Keep it quiet in the log; success is conveyed by the next step's start
      // or by overall completion. (Adding duplicate "✓ X" lines would be noise.)
      return true
    }
    case "error": {
      const [stepId, ...msgParts] = rest.split(":")
      const msg = msgParts.join(":")
      appendLog(`× ${stepId}`)
      if (msg) appendLog(`  ${msg}`)
      setErrorText(msg ? `${stepId} failed: ${msg}` : `${stepId} failed`)
      swapToVerbose()
      return true
    }
    case "offer-install": {
      const [tool, ...cmdParts] = rest.split(":")
      const cmd = cmdParts.join(":")
      appendLog(`  install ${tool}: ${cmd}`)
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
    // Indent raw lines so they group visually under the last step marker.
    appendLog(line.startsWith(" ") ? line : `  ${line}`)
  }
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
      const i = stdoutBuf.lastIndexOf("\n")
      if (i !== -1) {
        handleOutput(stdoutBuf.slice(0, i))
        stdoutBuf = stdoutBuf.slice(i + 1)
      }
    })
    proc.stderr.on("data", (data) => {
      stderrBuf += data.toString()
      const i = stderrBuf.lastIndexOf("\n")
      if (i !== -1) {
        handleOutput(stderrBuf.slice(0, i))
        stderrBuf = stderrBuf.slice(i + 1)
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

// ---------- step 1: clone + bun binary download ----------

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      // Follow redirects (GitHub releases typically redirect to S3).
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        res.resume()
        downloadFile(res.headers.location, destPath).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`GET ${url} -> ${res.statusCode}`))
        res.resume()
        return
      }
      const out = fs.createWriteStream(destPath)
      res.pipe(out)
      out.on("finish", () => out.close(resolve))
      out.on("error", reject)
    })
    req.on("error", reject)
  })
}

async function sha256(filePath) {
  const hash = crypto.createHash("sha256")
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("end", resolve)
    stream.on("error", reject)
  })
  return hash.digest("hex")
}

async function ensureBunBootstrapped() {
  // If we already have the exact bootstrap version, nothing to do. (setup.ts
  // may have later upgraded bun to a newer version — that's fine, we don't
  // want to downgrade. The version marker carries whatever was last installed.)
  if (fs.existsSync(BUN_BIN)) {
    appendLog(`  ✓ bun already installed at ${BUN_BIN}`)
    return
  }

  const target = detectBunTarget()
  const { asset, sha256: expectedSha } = BOOTSTRAP_BUN.targets[target]
  const tag = `bun-v${BOOTSTRAP_BUN.version}`
  const url = `https://github.com/oven-sh/bun/releases/download/${tag}/${asset}`

  fs.mkdirSync(BIN_DIR, { recursive: true })
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zenbu-bun-"))
  const zipPath = path.join(tmpDir, asset)

  quietLabelEl.textContent = `Downloading bun ${BOOTSTRAP_BUN.version}…`
  appendLog(`  → downloading ${url}`)
  await downloadFile(url, zipPath)

  const actualSha = await sha256(zipPath)
  if (actualSha !== expectedSha) {
    throw new Error(
      `bun sha256 mismatch: expected ${expectedSha}, got ${actualSha}`,
    )
  }

  appendLog(`  → unpacking`)
  execFileSync("unzip", ["-q", asset], { cwd: tmpDir })

  // bun releases extract to a dir like bun-darwin-aarch64/bun
  const extracted = findBunBinary(tmpDir)
  if (!extracted) {
    throw new Error("could not locate bun binary in downloaded archive")
  }
  fs.copyFileSync(extracted, BUN_BIN)
  fs.chmodSync(BUN_BIN, 0o755)
  fs.writeFileSync(BUN_VERSION_MARKER, BOOTSTRAP_BUN.version)

  // Symlink node -> bun so pnpm lifecycle scripts with `#!/usr/bin/env node`
  // shebangs resolve to bun in node-compat mode.
  const nodeLink = path.join(BIN_DIR, "node")
  try {
    fs.unlinkSync(nodeLink)
  } catch {}
  fs.symlinkSync("bun", nodeLink)

  fs.rmSync(tmpDir, { recursive: true, force: true })
  appendLog(`  ✓ bun ${BOOTSTRAP_BUN.version} installed`)
}

function findBunBinary(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = findBunBinary(full)
      if (nested) return nested
    } else if (entry.isFile() && entry.name === "bun") {
      return full
    }
  }
  return null
}

// ---------- step 2: run packages/init/setup.ts via bun ----------

async function run() {
  try {
    // Step 1: clone the repo + download the bun binary. Both are prerequisites
    // for running setup.ts. The rest of the install pipeline (pnpm, deps,
    // registry, config) lives in setup.ts so that it can be updated via
    // regular git pulls without having to rebuild/re-release the kernel.
    if (!fs.existsSync(pluginDir)) {
      quietLabelEl.textContent = "Cloning Zenbu…"
      fs.mkdirSync(path.dirname(pluginDir), { recursive: true })
      await runCommand(
        "git",
        ["clone", "--depth", "1", "--progress", REPO_URL, pluginDir],
        os.homedir(),
      )
    } else {
      appendLog("  ✓ zenbu already cloned")
    }

    await ensureBunBootstrapped()

    // Step 2: hand off to setup.ts, which owns everything else (pnpm install,
    // registry generation, shell shim, PATH wiring, etc).
    if (!fs.existsSync(SETUP_TS)) {
      throw new Error("setup.ts missing at " + SETUP_TS)
    }
    quietLabelEl.textContent = "Completing install…"
    await runCommand(BUN_BIN, [SETUP_TS], pluginDir)

    quietLabelEl.textContent = "Install complete"
    setTimeout(() => ipcRenderer.send("relaunch"), 800)
  } catch (err) {
    // If setup.ts already emitted ##ZENBU_STEP:error, errorTextEl is set.
    // Otherwise, synthesize a one-liner from the exit reason + last step.
    if (!errorTextEl.textContent) {
      const baseMsg = err && err.message ? err.message : String(err)
      const where = lastStartedStep ? ` during "${lastStartedStep}"` : ""
      setErrorText(`Install failed${where}: ${baseMsg}`)
    }
    swapToVerbose()
  }
}

retryBtn.addEventListener("click", () => {
  resetVerbose()
  run()
})

run()
