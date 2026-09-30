import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { type AuthConfig, authRoutes, currentUser } from './auth'
import type { Env } from './env'
import { sha256Base64Url } from './seal'

const cfg: AuthConfig = {
  clientId: 'client-1',
  clientSecret: 'secret-1',
  sessionSecret: 'a-test-session-secret-that-is-long-enough-01',
  endpoints: {
    auth: 'https://accounts.test/o/oauth2/v2/auth',
    token: 'https://accounts.test/token',
    revoke: 'https://accounts.test/revoke',
    sheets: 'https://sheets.test',
    drive: 'https://drive.test',
  },
}

const idToken = (claims: Record<string, unknown>) =>
  `x.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.y`

function fakeGoogle(opts: { claims?: Record<string, unknown>; refreshStatus?: number } = {}) {
  const calls: Array<{ url: string; form: URLSearchParams }> = []
  let challenge = ''
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const form = new URLSearchParams(String(init?.body ?? ''))
    calls.push({ url, form })
    if (url.endsWith('/token') && form.get('grant_type') === 'authorization_code') {
      if ((await sha256Base64Url(form.get('code_verifier') ?? '')) !== challenge) {
        return new Response('{"error":"invalid_grant"}', { status: 400 })
      }
      return Response.json({
        access_token: 'at-1',
        refresh_token: 'rt-1',
        expires_in: 3600,
        id_token: idToken({
          iss: 'https://accounts.google.com',
          aud: 'client-1',
          sub: 'g-123',
          email: 'Rae@Example.com',
          email_verified: true,
          name: 'Rae Lin',
          exp: Math.floor(Date.now() / 1000) + 3600,
          ...opts.claims,
        }),
      })
    }
    if (url.endsWith('/token') && form.get('grant_type') === 'refresh_token') {
      if (opts.refreshStatus)
        return new Response('{"error":"invalid_grant"}', { status: opts.refreshStatus })
      return Response.json({ access_token: 'at-2', expires_in: 3600 })
    }
    return new Response('{}')
  })
  const app = new Hono<{ Bindings: Env }>()
  const deps = { fetch: f as unknown as typeof fetch, config: () => cfg }
  authRoutes(app, deps)
  app.get('/whoami', async (c) => c.json(await currentUser(c, deps)))
  return { app, calls, setChallenge: (c: string) => (challenge = c) }
}

const cookiesFrom = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

async function signIn(g: ReturnType<typeof fakeGoogle>) {
  const start = await g.app.request('https://tracker.test/auth/google/start')
  const to = new URL(start.headers.get('location') ?? '')
  g.setChallenge(to.searchParams.get('code_challenge') ?? '')
  const back = await g.app.request(
    `https://tracker.test/auth/google/callback?code=c1&state=${to.searchParams.get('state')}`,
    { headers: { cookie: cookiesFrom(start) } },
  )
  return { start, to, back, cookie: cookiesFrom(back) }
}

describe('sign-in', () => {
  it('sends her to Google with PKCE, offline access, and only the drive.file scope', async () => {
    const { to } = await signIn(fakeGoogle())
    expect(to.origin + to.pathname).toBe(cfg.endpoints.auth)
    expect(to.searchParams.get('scope')).toBe(
      'openid email profile https://www.googleapis.com/auth/drive.file',
    )
    expect(to.searchParams.get('code_challenge_method')).toBe('S256')
    expect(to.searchParams.get('access_type')).toBe('offline')
    expect(to.searchParams.get('redirect_uri')).toBe('https://tracker.test/auth/google/callback')
  })

  it('signs her in with a sealed, HttpOnly session cookie', async () => {
    const g = fakeGoogle()
    const { back, cookie } = await signIn(g)
    expect(back.status).toBe(302)
    expect(back.headers.get('location')).toBe('/')
    const set = back.headers.getSetCookie().find((c) => c.startsWith('tht_session='))
    expect(set).toMatch(/HttpOnly/i)
    expect(set).toMatch(/Secure/i)
    expect(set).not.toContain('rt-1')
    const session = await (
      await g.app.request('https://tracker.test/api/session', { headers: { cookie } })
    ).json()
    expect(session).toMatchObject({
      signedIn: true,
      user: { sub: 'g-123', email: 'rae@example.com', name: 'Rae Lin' },
      accessToken: 'at-1',
      google: { sheets: 'https://sheets.test', drive: 'https://drive.test' },
    })
  })

  it('refuses a callback whose state does not match', async () => {
    const g = fakeGoogle()
    const start = await g.app.request('https://tracker.test/auth/google/start')
    const back = await g.app.request(
      'https://tracker.test/auth/google/callback?code=c1&state=forged',
      {
        headers: { cookie: cookiesFrom(start) },
      },
    )
    expect(back.headers.get('location')).toBe('/?signin=failed')
    expect(back.headers.getSetCookie().some((c) => c.startsWith('tht_session='))).toBe(false)
  })

  it('refuses an ID token for another app or an unverified email', async () => {
    for (const claims of [{ aud: 'other-client' }, { email_verified: false }]) {
      const { back } = await signIn(fakeGoogle({ claims }))
      expect(back.headers.get('location')).toBe('/?signin=failed')
    }
  })

  it('a signed-out visitor has no session and no user', async () => {
    const g = fakeGoogle()
    const res = await g.app.request('https://tracker.test/api/session')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ signedIn: false, setUp: true })
    expect(await (await g.app.request('https://tracker.test/whoami')).json()).toBeNull()
  })

  it('a cookie from another server secret is not a session', async () => {
    const g = fakeGoogle()
    const res = await g.app.request('https://tracker.test/api/session', {
      headers: { cookie: 'tht_session=v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    })
    expect(res.status).toBe(401)
  })
})

describe('the session', () => {
  it('refreshes the Google token when it is about to expire', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const g = fakeGoogle()
      const { cookie } = await signIn(g)
      vi.setSystemTime(Date.now() + 58 * 60_000)
      const res = await g.app.request('https://tracker.test/api/session', { headers: { cookie } })
      expect(((await res.json()) as { accessToken: string }).accessToken).toBe('at-2')
      expect(g.calls.some((c) => c.form.get('grant_type') === 'refresh_token')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('refreshes at once when the browser asks, after Google refused the current token', async () => {
    const g = fakeGoogle()
    const { cookie } = await signIn(g)
    const res = await g.app.request('https://tracker.test/api/session?refresh=1', {
      headers: { cookie },
    })
    expect(((await res.json()) as { accessToken: string }).accessToken).toBe('at-2')
  })

  it('signs her out when Google no longer accepts the grant', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const g = fakeGoogle({ refreshStatus: 400 })
      const { cookie } = await signIn(g)
      vi.setSystemTime(Date.now() + 58 * 60_000)
      const res = await g.app.request('https://tracker.test/api/session', { headers: { cookie } })
      expect(res.status).toBe(401)
    } finally {
      vi.useRealTimers()
    }
  })

  it('sign-out revokes the grant at Google and clears the cookie', async () => {
    const g = fakeGoogle()
    const { cookie } = await signIn(g)
    const res = await g.app.request('https://tracker.test/auth/logout', {
      method: 'POST',
      headers: { cookie, origin: 'https://tracker.test' },
    })
    expect(res.status).toBe(204)
    expect(g.calls.find((c) => c.url === cfg.endpoints.revoke)?.form.get('token')).toBe('rt-1')
    expect(res.headers.getSetCookie().find((c) => c.startsWith('tht_session='))).toMatch(
      /Max-Age=0/i,
    )
  })

  it('another site cannot sign her out', async () => {
    const g = fakeGoogle()
    const { cookie } = await signIn(g)
    const res = await g.app.request('https://tracker.test/auth/logout', {
      method: 'POST',
      headers: { cookie, origin: 'https://evil.test' },
    })
    expect(res.status).toBe(403)
  })
})

describe('without sign-in set up', () => {
  it('says so instead of failing', async () => {
    const app = new Hono<{ Bindings: Env }>()
    authRoutes(app, { fetch, config: () => null })
    expect((await app.request('https://tracker.test/auth/google/start')).status).toBe(503)
    expect(await (await app.request('https://tracker.test/api/session')).json()).toEqual({
      signedIn: false,
      setUp: false,
    })
  })
})
