import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The production Worker entry is the default. The dev entry, which can use the fake
// Google server, is only for the dev server, preview, and the e2e build (D5).
export default defineConfig(({ command, mode }) => {
  const dev = command === 'serve' || mode === 'e2e'
  if (!dev && mode !== 'production') throw new Error(`unknown build mode: ${mode}`)
  return {
    plugins: [
      react(),
      cloudflare({ configPath: dev ? './wrangler.dev.jsonc' : './wrangler.jsonc' }),
    ],
    build: { outDir: dev ? 'dist-e2e' : 'dist' },
  }
})
