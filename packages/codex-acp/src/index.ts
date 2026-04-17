#!/usr/bin/env node

import { createBridge } from "./bridge.ts";

const noLoadSession = process.argv.includes("--no-load-session");
const bridge = createBridge({ noLoadSession });

process.on("SIGINT", () => {
  bridge.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  bridge.close();
  process.exit(0);
});
