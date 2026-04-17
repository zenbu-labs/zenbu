import path from "node:path"

export type MockAcpConfig = {
  controlPort: number
  dbPath: string
}

export function parseConfig(args: string[]): MockAcpConfig {
  let controlPort = 0
  let dbPath = path.join(process.cwd(), ".zenbu", "mock-acp", "db")

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--control-port" && args[i + 1]) {
      controlPort = parseInt(args[++i], 10)
    } else if (arg === "--db-path" && args[i + 1]) {
      dbPath = args[++i]
    }
  }

  return { controlPort, dbPath }
}
