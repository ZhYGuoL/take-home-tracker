import { Hono } from 'hono'
import type { Env } from './env'
import { type ExtractDeps, extractRoute, modelEnabled } from './extract'

export type AppDeps = ExtractDeps

export function createApp(deps: AppDeps) {
  const app = new Hono<{ Bindings: Env }>()
  app.get('/api/health', (c) => c.json({ ok: true }))
  app.get('/api/model', async (c) => c.json({ enabled: await modelEnabled(c, deps) }))
  app.post('/api/extract', (c) => extractRoute(c, deps))
  return app
}
