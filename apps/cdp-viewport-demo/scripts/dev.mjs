import { spawn } from 'child_process'
import electron from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const child = spawn(String(electron), ['src/main.ts'], {
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    NODE_OPTIONS: '--import=tsx',
  },
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code ?? 0))

process.on('SIGINT', () => {
  child.kill()
  process.exit()
})
