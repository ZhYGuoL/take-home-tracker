import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { GOOGLE } from './auth'

const withAuth = createApp({
  fetch,
  auth: () => ({
    clientId: 'c',
    clientSecret: 's',
    sessionSecret: 'x'.repeat(40),
    endpoints: GOOGLE,
  }),
})

describe('worker app', () => {
  it('answers the health check', async () => {
    const res = await createApp({ fetch, auth: () => null }).request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('gives a signed-out visitor no session, no model, and no extraction', async () => {
    expect((await withAuth.request('/api/session')).status).toBe(401)
    expect(await (await withAuth.request('/api/model')).json()).toEqual({ enabled: false })
    const env = { OPENROUTER_API_KEY: 'k', MODEL_ID: 'm', MODEL_ALLOWED_EMAILS: 'a@example.com' }
    const res = await withAuth.request(
      '/api/extract',
      { method: 'POST', body: '{"paste":"hi","ctx":{"candidates":[]}}' },
      env,
    )
    expect(res.status).toBe(403)
  })
})
