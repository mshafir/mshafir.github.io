// Dev loop: Vite serves the window with hot reload; Electron loads it. Main-process changes need a restart.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'vite'

await import('./build-main.mjs')

const server = await createServer({ server: { port: 5199, strictPort: true } })
await server.listen()

const electron = createRequire(import.meta.url)('electron')
const extra = (process.env.ELECTRON_EXTRA_ARGS ?? '').split(' ').filter(Boolean)
const child = spawn(electron, ['.', ...extra, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_URL: 'http://localhost:5199/' },
})
child.on('exit', async (code) => {
  await server.close()
  process.exit(code ?? 0)
})
