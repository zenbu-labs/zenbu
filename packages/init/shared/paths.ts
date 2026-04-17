import path from "node:path";
import os from "node:os";

const ZENBU_HOME = path.join(os.homedir(), ".zenbu");

export const INTERNAL_DIR = path.join(ZENBU_HOME, ".internal");
export const RUNTIME_JSON = path.join(INTERNAL_DIR, "runtime.json");
export const DB_CONFIG_JSON = path.join(INTERNAL_DIR, "db.json");
export const SOCKET_DIR = path.join(ZENBU_HOME, "run");
export const CLI_SOCKET_PATH = path.join(SOCKET_DIR, "cli.sock");
