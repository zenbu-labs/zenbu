import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SOCKET_DIR = join(homedir(), ".zenbu", "run");
const SOCKET_PREFIX = "mcp-";
const SOCKET_SUFFIX = ".sock";

export function getMcpSocketPath(agentId: string): string {
  mkdirSync(SOCKET_DIR, { recursive: true });
  return join(SOCKET_DIR, `${SOCKET_PREFIX}${agentId}${SOCKET_SUFFIX}`);
}

export function parseAgentIdFromSocketPath(
  socketPath: string,
): string | null {
  const basename = socketPath.split("/").pop();
  if (
    !basename ||
    !basename.startsWith(SOCKET_PREFIX) ||
    !basename.endsWith(SOCKET_SUFFIX)
  )
    return null;
  return basename.slice(
    SOCKET_PREFIX.length,
    -SOCKET_SUFFIX.length,
  );
}
