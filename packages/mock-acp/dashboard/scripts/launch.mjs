#!/usr/bin/env node

/**
 * Bin script for `npx mock-acp-dashboard`
 * Launches the dashboard Electron app in dev mode.
 */
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const devScript = path.join(__dirname, 'dev.mjs')

// Dynamic import to run the dev script
await import(devScript)
