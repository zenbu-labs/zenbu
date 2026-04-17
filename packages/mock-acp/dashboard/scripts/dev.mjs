import net from 'net'
import { createServer } from 'vite'
import { spawn } from 'child_process'
import electron from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dashboardRoot = path.join(__dirname, '..')

function findPort(preferred) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(preferred, () => {
      srv.close(() => resolve(preferred))
    })
    srv.on('error', () => {
      const srv2 = net.createServer()
      srv2.listen(0, () => {
        const port = srv2.address().port
        srv2.close(() => resolve(port))
      })
    })
  })
}

const port = await findPort(5300)

const server = await createServer({
  root: path.join(dashboardRoot, 'renderer'),
  configFile: path.join(dashboardRoot, 'renderer/vite.config.ts'),
  server: {
    port,
    strictPort: true,
    hmr: { clientPort: port },
  },
})
await server.listen()

const url = server.resolvedUrls.local[0]
console.log(`\n  Dashboard Renderer: ${url}\n`)

const child = spawn(String(electron), ['dashboard/main/index.ts'], {
  cwd: path.join(dashboardRoot, '..'),
  env: {
    ...process.env,
    ELECTRON_RENDERER_URL: url,
    NODE_OPTIONS: '--import=tsx --import=hot-hook/register',
  },
  stdio: 'inherit',
})

child.on('exit', (code) => {
  server.close()
  process.exit(code ?? 0)
})

process.on('SIGINT', () => {
  child.kill()
  server.close()
  process.exit()
})
