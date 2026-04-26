import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const RUNTIME_JSON = join(homedir(), ".zenbu", ".internal", "runtime.json")

/**
 * Handshake written by `CliService.evaluate()` in the running app. Carries
 * the active WebSocket port so the CLI can speak zenrpc on the same transport
 * the renderer uses. Because `CliService` declares `HttpService` as a dep,
 * this file is rewritten whenever the port changes.
 *
 * The CLI reads it once at startup. Commands are short-lived; a port change
 * mid-invocation would show up as a dropped WS and exit the CLI with an
 * error. That's intentional — no reconnection logic.
 */
export type RuntimeConfig = {
  wsPort: number
  wsToken: string
  dbPath: string
  pid: number
}

export function readRuntimeConfig(): RuntimeConfig | null {
  if (!existsSync(RUNTIME_JSON)) return null
  try {
    const data = JSON.parse(readFileSync(RUNTIME_JSON, "utf-8"))
    if (
      typeof data.wsPort !== "number" ||
      typeof data.wsToken !== "string" ||
      typeof data.pid !== "number"
    ) {
      return null
    }
    try {
      process.kill(data.pid, 0)
    } catch {
      return null
    }
    return {
      wsPort: data.wsPort,
      wsToken: data.wsToken,
      dbPath: data.dbPath,
      pid: data.pid,
    }
  } catch {
    return null
  }
}
