import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { Env, User } from './env'
import { extractRoute, modelEnabled } from './extract'

const user: User = { sub: 'u1', email: 'rae@example.com', name: 'Rae Lin' }
const env: Env = {
  OPENROUTER_API_KEY: 'test-key',
  MODEL_ID: 'openai/gpt-5.4-nano',
  MODEL_ALLOWED_EMAILS: 'rae@example.com',
}
const reading = {
  candidate_name: 'Priya Raman',
  candidate_contacts: [],
  role: null,
  source: null,
  direction: 'in',
  sent_at_text: null,
  deadline_text: null,
  links: [],
  needs_reply: false,
  existing_candidate_id: null,
}
const ctx = { now: '2026-09-30T20:00:00.000Z', zone: 'America/Los_Angeles', candidates: [] }

function app(opts: { who?: User | null; model?: () => Promise<Response> } = {}) {
  const model = vi.fn(
    opts.model ??
      (async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(reading) } }] }),
        )),
  )
  const deps = {
    fetch: model as unknown as typeof fetch,
    currentUser: async () => opts.who ?? null,
  }
  const a = new Hono<{ Bindings: Env }>()
  a.post('/api/extract', (c) => extractRoute(c, deps))
  a.get('/api/model', async (c) => c.json({ enabled: await modelEnabled(c, deps) }))
  return { a, model }
}

const post = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

describe('/api/extract', () => {
  it('returns the reading for an allowed user', async () => {
    const { a, model } = app({ who: user })
    const res = await a.request('/api/extract', post({ paste: 'hello', ctx }), env)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ reading: { candidate_name: 'Priya Raman' } })
    expect(model).toHaveBeenCalledOnce()
  })

  it('is off without a key or a chosen model', async () => {
    const { a, model } = app({ who: user })
    const res = await a.request('/api/extract', post({ paste: 'hello', ctx }), {
      ...env,
      MODEL_ID: '',
    })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'model_off' })
    expect(model).not.toHaveBeenCalled()
  })

  it('refuses a signed-out visitor and a user not on the list', async () => {
    for (const who of [null, { ...user, email: 'someone@example.com' }]) {
      const { a, model } = app({ who })
      const res = await a.request('/api/extract', post({ paste: 'hello', ctx }), env)
      expect(res.status).toBe(403)
      expect(model).not.toHaveBeenCalled()
    }
  })

  it('stops a user over the rate limit', async () => {
    const { a } = app({ who: user })
    const limited: Env = { ...env, MODEL_LIMITER: { limit: async () => ({ success: false }) } }
    const res = await a.request('/api/extract', post({ paste: 'hello', ctx }), limited)
    expect(res.status).toBe(429)
  })

  it('refuses a request with an oversized list of known candidates', async () => {
    const { a, model } = app({ who: user })
    const many = Array.from({ length: 5_000 }, (_, i) => ({
      id: `c-${i}`,
      name: `Person ${i} with a long name`,
      role: '',
      contacts: [`p${i}@example.com`],
      links: [],
    }))
    const res = await a.request(
      '/api/extract',
      post({ paste: 'hi', ctx: { ...ctx, candidates: many } }),
      env,
    )
    expect(res.status).toBe(400)
    expect(model).not.toHaveBeenCalled()
  })

  it('refuses an empty or oversized paste', async () => {
    const { a } = app({ who: user })
    for (const paste of ['  ', 'x'.repeat(20_001)]) {
      const res = await a.request('/api/extract', post({ paste, ctx }), env)
      expect(res.status).toBe(400)
    }
  })

  it('logs no paste text when the model fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { a } = app({
      who: user,
      model: async () => new Response('secret paste text', { status: 500 }),
    })
    const res = await a.request('/api/extract', post({ paste: 'secret paste text', ctx }), env)
    expect(res.status).toBe(502)
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret')
  })
})

describe('/api/model', () => {
  it('says whether the model is on for this user', async () => {
    expect(await (await app({ who: user }).a.request('/api/model', {}, env)).json()).toEqual({
      enabled: true,
    })
    expect(await (await app({ who: null }).a.request('/api/model', {}, env)).json()).toEqual({
      enabled: false,
    })
  })
})
