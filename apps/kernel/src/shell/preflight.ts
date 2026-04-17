import { execFileSync, spawn } from "node:child_process"
import { app } from "electron"

export type PreflightStatus = {
  runningFromDmg: boolean
  xcodeCliInstalled: boolean
  /** Path from `xcode-select -p`, or null if not installed. */
  xcodeDeveloperDir: string | null
}

export function detectPreflight(): PreflightStatus {
  const runningFromDmg = detectRunningFromDmg()
  const xcodeDeveloperDir = detectXcodeDeveloperDir()
  return {
    runningFromDmg,
    xcodeCliInstalled: xcodeDeveloperDir !== null,
    xcodeDeveloperDir,
  }
}

function detectRunningFromDmg(): boolean {
  if (process.platform !== "darwin") return false
  const appPath = app.getAppPath()
  return appPath.startsWith("/Volumes/")
}

function detectXcodeDeveloperDir(): string | null {
  if (process.platform !== "darwin") return "" // non-mac: not applicable; treat as installed
  try {
    const out = execFileSync("xcode-select", ["-p"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
    if (!out) return null
    // Stub state: xcode-select can return a path that doesn't contain git.
    // Quick secondary check: try `git --version`; if it fails with xcode-select
    // error, the tools aren't really available.
    try {
      const gitOut = execFileSync("git", ["--version"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      })
      if (gitOut && gitOut.toLowerCase().includes("xcode-select")) return null
    } catch (err: any) {
      const msg = (err?.stderr?.toString?.() ?? err?.message ?? "").toLowerCase()
      if (msg.includes("xcode-select") || msg.includes("no such file")) return null
    }
    return out
  } catch {
    return null
  }
}

/**
 * Triggers the macOS GUI installer for Command Line Tools. Returns immediately;
 * the installer runs asynchronously. Callers should poll `detectXcodeDeveloperDir`
 * until it returns non-null.
 */
export function triggerXcodeCliInstall(): void {
  if (process.platform !== "darwin") return
  try {
    const child = spawn("xcode-select", ["--install"], {
      detached: true,
      stdio: "ignore",
    })
    child.unref()
  } catch (err) {
    console.error("[preflight] failed to trigger xcode-select --install:", err)
  }
}
