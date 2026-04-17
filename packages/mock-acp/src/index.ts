#!/usr/bin/env node

import { parseConfig } from "./config.ts"
import { createControlServer } from "./control/server.ts"
import { createBridge } from "./bridge.ts"
import { registerWithDaemon, type AgentRegistration } from "./daemon-client.ts"
import { stopDaemon, isDaemonRunning, getDaemonPort, getDaemonPid } from "./registry.ts"

// Handle daemon CLI commands
const args = process.argv.slice(2)
if (args[0] === "daemon") {
  const subCmd = args[1]
  if (subCmd === "stop") {
    const stopped = stopDaemon()
    console.log(stopped ? "Daemon stopped" : "Daemon not running")
    process.exit(0)
  } else if (subCmd === "status") {
    if (isDaemonRunning()) {
      console.log(`Daemon running (pid: ${getDaemonPid()}, port: ${getDaemonPort()})`)
    } else {
      console.log("Daemon not running")
    }
    process.exit(0)
  } else if (subCmd === "restart") {
    stopDaemon()
    // Will auto-start on next agent spawn
    console.log("Daemon stopped. Will auto-start on next agent spawn.")
    process.exit(0)
  } else {
    console.log("Usage: mock-acp daemon [start|stop|status|restart]")
    process.exit(1)
  }
}

const config = parseConfig(args)

console.error("[mock-acp] starting...")
console.error(`[mock-acp] db path: ${config.dbPath}`)
console.error(`[mock-acp] control port: ${config.controlPort || "auto"}`)

const controlServer = await createControlServer(config)
const bridge = createBridge(controlServer)

// Register with daemon (auto-starts daemon if not running)
let registration: AgentRegistration | null = null
try {
  registration = await registerWithDaemon({
    controlPort: controlServer.port,
    cwd: process.cwd(),
    status: "ready",
  })
  // Make registration available to the engine
  ;(controlServer as any)._registration = registration
  console.error(`[mock-acp] registered with daemon (id: ${registration.id})`)
} catch (err) {
  console.error(`[mock-acp] failed to register with daemon: ${err}`)
}

console.error(`[mock-acp] ready (control port: ${controlServer.port})`)

async function shutdown() {
  if (registration) {
    registration.stopHeartbeat()
    await registration.unregister().catch(() => {})
  }
  bridge.close()
  controlServer.close()
  process.exit(0)
}

process.on("SIGINT", () => shutdown())
process.on("SIGTERM", () => shutdown())
