/**
 * Railway (and other hosts) set `PORT`. Vite preview must bind `0.0.0.0` and use that port.
 * Keeps `vite-plugin-copy-maker-data` preview middleware so `/api/os/*` and `/api/outliers-catalog` work.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = String(process.env.PORT || '4173')
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

const child = spawn(process.execPath, [viteCli, 'preview', '--host', '0.0.0.0', '--port', port], {
  cwd: root,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
