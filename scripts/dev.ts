// `pnpm dev`: the app and a local fake Google, together. Ctrl-C stops both.
import { type ChildProcess, spawn } from 'node:child_process'

const children: ChildProcess[] = [
  spawn('npx', ['tsx', 'test/fake-google/server.ts'], { stdio: 'inherit' }),
  spawn('npx', ['vite', ...process.argv.slice(2)], { stdio: 'inherit' }),
]

function stop(code = 0) {
  for (const c of children) c.kill('SIGTERM')
  process.exit(code)
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
for (const c of children) c.on('exit', (code) => stop(code ?? 0))
