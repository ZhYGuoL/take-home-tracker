// Fails when the production build could ship dev-only code (D5).
// Run after `vite build` in production mode.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const bundle = readFileSync(resolve(root, 'dist/take_home_tracker/index.js'), 'utf8')
const problems: string[] = []

for (const marker of ['take-home-tracker-dev-entry', 'fake-google', 'FAKE_GOOGLE']) {
  if (bundle.includes(marker)) problems.push(`production Worker bundle contains "${marker}"`)
}

const redirect = JSON.parse(readFileSync(resolve(root, '.wrangler/deploy/config.json'), 'utf8'))
if (redirect.configPath !== '../../dist/take_home_tracker/wrangler.json') {
  problems.push(`wrangler deploy would use ${redirect.configPath}`)
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
