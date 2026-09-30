import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `vite build` with the default mode makes the production bundle.
// Any other mode (dev server, e2e) runs the dev Worker entry.
export default defineConfig(({ command, mode }) => {
  const production = command === 'build' && mode === 'production'
  return {
    plugins: [
      react(),
      cloudflare({ configPath: production ? './wrangler.jsonc' : './wrangler.dev.jsonc' }),
    ],
    build: { outDir: production ? 'dist' : `dist-${mode}` },
  }
})
