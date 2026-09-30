import { Hono } from 'hono'
import { type AuthConfig, authRoutes, currentUser } from './auth'
import type { Env } from './env'
import { extractRoute, modelEnabled } from './extract'

export interface AppDeps {
  fetch: typeof fetch
  /** Sign-in settings for a request's env, or null when sign-in is not set up. */
  auth: (env: Env) => AuthConfig | null
  openrouterBase?: string
}

export function createApp(deps: AppDeps) {
  const app = new Hono<{ Bindings: Env }>()
  const authDeps = { fetch: deps.fetch, config: deps.auth }
  const extractDeps = {
    fetch: deps.fetch,
    currentUser: (c: Parameters<typeof currentUser>[0]) => currentUser(c, authDeps),
    ...(deps.openrouterBase ? { openrouterBase: deps.openrouterBase } : {}),
  }
  app.get('/api/health', (c) => c.json({ ok: true }))
  authRoutes(app, authDeps)
  app.get('/api/model', async (c) => c.json({ enabled: await modelEnabled(c, extractDeps) }))
  app.post('/api/extract', (c) => extractRoute(c, extractDeps))
  return app
}
