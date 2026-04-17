import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

export async function runDoctor(_argv: string[]) {
  const setupScript = join(
    homedir(),
    ".zenbu",
    "plugins",
    "zenbu",
    "setup.sh",
  )
  if (!existsSync(setupScript)) {
    console.error(`setup.sh not found at ${setupScript}`)
    console.error(`Is the repo cloned at ~/.zenbu/plugins/zenbu?`)
    process.exit(1)
  }
  const child = spawn("bash", [setupScript], {
    stdio: "inherit",
    cwd: join(homedir(), ".zenbu", "plugins", "zenbu"),
  })
  child.on("exit", (code) => process.exit(code ?? 0))
}
