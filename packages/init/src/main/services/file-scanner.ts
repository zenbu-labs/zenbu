import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import { Service, runtime } from "../runtime"

type FileEntry = { path: string; name: string }

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".zenbu",
  ".next",
  ".turbo",
  ".cache",
  "__pycache__",
])

function shouldIgnore(name: string): boolean {
  return name.startsWith(".") || IGNORED_DIRS.has(name)
}

async function scanDir(root: string): Promise<FileEntry[]> {
  const results: FileEntry[] = []
  const queue: string[] = [root]

  while (queue.length > 0) {
    const dir = queue.pop()!
    let entries: fs.Dirent[]
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (shouldIgnore(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        queue.push(full)
      } else if (entry.isFile()) {
        results.push({
          path: path.relative(root, full),
          name: entry.name,
        })
      }
    }
  }

  results.sort((a, b) => a.path.localeCompare(b.path))
  return results
}

type CwdCache = {
  files: FileEntry[] | null
  scanPromise: Promise<FileEntry[]> | null
  watcher: fs.FSWatcher | null
  debounceTimer: ReturnType<typeof setTimeout> | null
}

export class FileScannerService extends Service {
  static key = "file-scanner"
  static deps = {}

  private caches = new Map<string, CwdCache>()

  evaluate() {
    this.effect("cleanup", () => {
      return () => {
        for (const entry of this.caches.values()) {
          if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
          entry.watcher?.close()
        }
        this.caches.clear()
      }
    })

    console.log(`[file-scanner] service ready`)
  }

  private getOrCreateCache(cwd: string): CwdCache {
    let entry = this.caches.get(cwd)
    if (entry) return entry

    entry = { files: null, scanPromise: null, watcher: null, debounceTimer: null }
    this.caches.set(cwd, entry)

    entry.scanPromise = scanDir(cwd).then((files) => {
      entry!.files = files
      return files
    })

    try {
      entry.watcher = fs.watch(cwd, { recursive: true }, (_event, filename) => {
        if (!filename) return
        const firstSegment = filename.split(path.sep)[0]
        if (shouldIgnore(firstSegment)) return

        if (entry!.debounceTimer) clearTimeout(entry!.debounceTimer)
        entry!.debounceTimer = setTimeout(() => {
          entry!.files = null
          entry!.scanPromise = scanDir(cwd).then((files) => {
            entry!.files = files
            return files
          })
        }, 150)
      })
    } catch {
      // fs.watch with recursive may not be supported everywhere
    }

    return entry
  }

  async listFiles(cwd?: string): Promise<FileEntry[]> {
    const resolved = cwd || process.cwd()
    const entry = this.getOrCreateCache(resolved)
    if (entry.files) return entry.files
    return entry.scanPromise!
  }

  async readFile(filePath: string, cwd?: string): Promise<string> {
    const resolved = cwd || process.cwd()
    const full = path.resolve(resolved, filePath)
    if (!full.startsWith(resolved + path.sep) && full !== resolved) {
      throw new Error("Path traversal not allowed")
    }
    return fsp.readFile(full, "utf8")
  }
}

runtime.register(FileScannerService, (import.meta as any).hot)
