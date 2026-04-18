import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

export async function runDoctor(_argv: string[]) {
  const repoRoot = join(homedir(), ".zenbu", "plugins", "zenbu")
  const setupScript = join(repoRoot, "packages", "init", "setup.ts")
  const bunBin = join(homedir(), "Library", "Caches", "Zenbu", "bin", "bun")
  if (!existsSync(setupScript)) {
    console.error(`setup.ts not found at ${setupScript}`)
    console.error(`Is the repo cloned at ~/.zenbu/plugins/zenbu?`)
    process.exit(1)
  }
  if (!existsSync(bunBin)) {
    console.error(`bun binary not found at ${bunBin}`)
    console.error(`Launch Zenbu.app once to bootstrap the toolchain.`)
    process.exit(1)
  }
  const child = spawn(bunBin, [setupScript], {
    stdio: "inherit",
    cwd: repoRoot,
  })
  child.on("exit", (code) => process.exit(code ?? 0))
}
