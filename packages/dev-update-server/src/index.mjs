#!/usr/bin/env node
/**
 * Local dev update server for testing electron-updater without code-signing
 * or GitHub publishing.
 *
 * electron-updater on macOS expects the feed URL to serve:
 *   - `/latest-mac.yml`   — the manifest electron-builder writes alongside
 *                           the artifact. Contains version, files, sha512.
 *   - `/<artifact>.zip`   — the update payload.
 *
 * This server just static-serves a directory (default: the kernel's
 * `apps/kernel/dist/`) with Range-request support so electron-updater's
 * resumable downloads work. Pure Node, no build step.
 *
 * Usage:
 *   pnpm --filter @zenbu/dev-update-server start
 *   pnpm --filter @zenbu/dev-update-server start -- --port 9000
 *   pnpm --filter @zenbu/dev-update-server start -- --dir /custom/path
 *
 * Point the kernel at it with:
 *   ZENBU_UPDATE_FEED_URL=http://localhost:8888 pnpm dev
 */

import { createServer } from "node:http"
import { createReadStream, statSync } from "node:fs"
import { access, constants } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

function parseArgs(argv) {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  // Default: the kernel's dist directory, relative to this package.
  // This package lives at `packages/dev-update-server/src/index.mjs`;
  // kernel dist is at `apps/kernel/dist/`.
  const defaultDir = path.resolve(__dirname, "..", "..", "..", "apps", "kernel", "dist")

  let dir = defaultDir
  let port = 8888

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dir" || a === "-d") {
      dir = path.resolve(argv[++i] ?? "")
    } else if (a === "--port" || a === "-p") {
      port = Number(argv[++i]) || 8888
    } else if (a === "--help" || a === "-h") {
      console.log("Usage: dev-update-server [--dir <path>] [--port <n>]")
      process.exit(0)
    }
  }
  return { dir, port }
}

const CONTENT_TYPES = {
  ".yml": "application/yaml",
  ".yaml": "application/yaml",
  ".zip": "application/zip",
  ".dmg": "application/x-apple-diskimage",
  ".blockmap": "application/octet-stream",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
}

function contentTypeFor(p) {
  const ext = path.extname(p).toLowerCase()
  return CONTENT_TYPES[ext] ?? "application/octet-stream"
}

function serve(req, res, rootDir) {
  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/")
  // Guard against path traversal — resolve within rootDir.
  const abs = path.join(rootDir, urlPath.replace(/^\/+/, ""))
  if (!abs.startsWith(rootDir)) {
    res.statusCode = 403
    res.end("forbidden")
    return
  }

  let stat
  try {
    stat = statSync(abs)
  } catch {
    res.statusCode = 404
    res.end("not found")
    log(req, 404, 0)
    return
  }

  if (stat.isDirectory()) {
    res.statusCode = 404
    res.end("not found (directory listing disabled)")
    log(req, 404, 0)
    return
  }

  const size = stat.size
  const ct = contentTypeFor(abs)
  res.setHeader("Content-Type", ct)
  res.setHeader("Accept-Ranges", "bytes")
  res.setHeader("Cache-Control", "no-cache")

  // Range support — electron-updater's resumable downloader sends one.
  const rangeHeader = req.headers["range"]
  if (typeof rangeHeader === "string") {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)
    if (m) {
      const start = m[1] ? Number(m[1]) : 0
      const end = m[2] ? Number(m[2]) : size - 1
      if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end < size &&
        start <= end
      ) {
        res.statusCode = 206
        res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`)
        res.setHeader("Content-Length", String(end - start + 1))
        const stream = createReadStream(abs, { start, end })
        stream.pipe(res)
        log(req, 206, end - start + 1)
        return
      }
    }
  }

  res.statusCode = 200
  res.setHeader("Content-Length", String(size))
  const stream = createReadStream(abs)
  stream.pipe(res)
  log(req, 200, size)
}

function log(req, status, bytes) {
  const ts = new Date().toISOString().slice(11, 23)
  const kb = (bytes / 1024).toFixed(1)
  console.log(`${ts} ${status} ${req.method} ${req.url}  ${kb}kb`)
}

const { dir, port } = parseArgs(process.argv.slice(2))

try {
  await access(dir, constants.R_OK)
} catch {
  console.error(`[dev-update-server] directory not found or unreadable: ${dir}`)
  console.error(`Run \`pnpm release --mac\` inside apps/kernel first.`)
  process.exit(1)
}

const server = createServer((req, res) => serve(req, res, dir))

server.listen(port, () => {
  console.log(`[dev-update-server] serving ${dir}`)
  console.log(`[dev-update-server] listening on http://localhost:${port}`)
  console.log(`[dev-update-server] point kernel at it:`)
  console.log(`  ZENBU_UPDATE_FEED_URL=http://localhost:${port} pnpm dev`)
})
