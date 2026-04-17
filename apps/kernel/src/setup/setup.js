const path = require("node:path")
const os = require("node:os")
const fs = require("node:fs")
const { spawn } = require("node:child_process")
const { ipcRenderer } = require("electron")

const REPO_URL = "https://github.com/RobPruzan/zenbu.git"
const pluginDir = path.join(os.homedir(), ".zenbu", "plugins", "zenbu")
const INTERNAL_DIR = path.join(os.homedir(), ".zenbu", ".internal")
const DB_CONFIG_JSON = path.join(INTERNAL_DIR, "db.json")

const statusEl = document.getElementById("status")
const errorEl = document.getElementById("error")
const successEl = document.getElementById("success")
const progressBar = document.getElementById("progressBar")

function updateStatus(msg) {
  statusEl.textContent = msg
}

function runCommand(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: Object.assign({}, process.env, { FORCE_COLOR: "0" }),
    })

    proc.stdout.on("data", (data) => {
      const line = data.toString().trim()
      if (line) updateStatus(line)
    })

    proc.stderr.on("data", (data) => {
      const line = data.toString().trim()
      if (line) updateStatus(line)
    })

    proc.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(cmd + " exited with code " + code))
    })

    proc.on("error", reject)
  })
}

async function run() {
  try {
    if (!fs.existsSync(pluginDir)) {
      updateStatus("Cloning zenbu...")
      fs.mkdirSync(path.dirname(pluginDir), { recursive: true })
      await runCommand("git", ["clone", "--depth", "1", "--progress", REPO_URL, pluginDir], os.homedir())
    } else {
      updateStatus("Repository already exists, skipping clone...")
    }

    if (!fs.existsSync(path.join(pluginDir, "node_modules"))) {
      const setupScript = path.join(pluginDir, "setup.sh")
      if (fs.existsSync(setupScript)) {
        updateStatus("Running setup...")
        await runCommand("bash", [setupScript], pluginDir)
      } else {
        throw new Error("No setup.sh found at " + setupScript)
      }
    } else {
      updateStatus("Dependencies already installed...")
    }

    // Persist db path so the CLI can discover it even when the app isn't running
    const dbPath = path.join(pluginDir, ".zenbu", "db")
    fs.mkdirSync(INTERNAL_DIR, { recursive: true })
    fs.writeFileSync(DB_CONFIG_JSON, JSON.stringify({ dbPath }))

    progressBar.classList.add("done")
    updateStatus("Done!")
    successEl.textContent = "Setup complete! Launching..."
    successEl.style.display = "block"

    setTimeout(() => {
      ipcRenderer.send("relaunch")
    }, 1000)
  } catch (err) {
    errorEl.textContent = err.message || String(err)
    errorEl.style.display = "block"
    progressBar.style.display = "none"
  }
}

run()
