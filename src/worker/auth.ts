import type { Context, Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { SessionResponse } from '../shared/api'
import type { Env, User } from './env'
import { randomToken, seal, sha256Base64Url, unseal } from './seal'

export interface GoogleEndpoints {
  auth: string
  token: string
  revoke: string
  /** Where the browser calls the Sheets and Drive APIs. */
  sheets: string
  drive: string
}

/** The real Google endpoints. The production Worker has no other choice (D5). */
export const GOOGLE: GoogleEndpoints = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  revoke: 'https://oauth2.googleapis.com/revoke',
  sheets: 'https://sheets.googleapis.com',
  drive: 'https://www.googleapis.com',
}

export interface AuthConfig {
  clientId: string
  clientSecret: string
  sessionSecret: string
  endpoints: GoogleEndpoints
}

export interface AuthDeps {
  fetch: typeof fetch
  /** Sign-in settings for this request, or null when sign-in is not set up. */
  config: (env: Env) => AuthConfig | null
}

export const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file'
const SESSION = 'tht_session'
const OAUTH = 'tht_oauth'
const SESSION_DAYS = 180
const REFRESH_EARLY_MS = 5 * 60_000

interface Session {
  sub: string
  email: string
  name: string
  /** The Google refresh token. Only the Worker can read it. */
  rt: string
  at: string
  atExp: number
}

type C = Context<{ Bindings: Env }>

const secure = (c: C) => new URL(c.req.url).protocol === 'https:'

function cookieOptions(c: C, maxAge: number) {
  return { httpOnly: true, secure: secure(c), sameSite: 'Lax' as const, path: '/', maxAge }
}

async function writeSession(c: C, cfg: AuthConfig, s: Session) {
  setCookie(c, SESSION, await seal(s, cfg.sessionSecret), cookieOptions(c, SESSION_DAYS * 86_400))
}

async function readSession(c: C, cfg: AuthConfig): Promise<Session | null> {
  return unseal<Session>(getCookie(c, SESSION), cfg.sessionSecret)
}

/** The signed-in user, from the session cookie alone. No network call. */
export async function currentUser(c: C, deps: AuthDeps): Promise<User | null> {
  const cfg = deps.config(c.env ?? {})
  if (!cfg) return null
  const s = await readSession(c, cfg)
  return s ? { sub: s.sub, email: s.email, name: s.name } : null
}

/** The payload of an ID token that came straight from Google's token endpoint over TLS. */
function idTokenClaims(idToken: string): Record<string, unknown> | null {
  const part = idToken.split('.')[1]
  if (!part) return null
  try {
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
  } catch {
    return null
  }
}

async function postForm(deps: AuthDeps, url: string, form: Record<string, string>) {
  return deps.fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  })
}

function notSetUp(c: C) {
  return c.text('Sign-in is not set up on this server.', 503)
}

export function authRoutes(app: Hono<{ Bindings: Env }>, deps: AuthDeps) {
  app.get('/auth/google/start', async (c) => {
    const cfg = deps.config(c.env ?? {})
    if (!cfg) return notSetUp(c)
    const state = randomToken()
    const verifier = randomToken(48)
    setCookie(
      c,
      OAUTH,
      await seal({ state, verifier, exp: Date.now() + 600_000 }, cfg.sessionSecret),
      { ...cookieOptions(c, 600), path: '/auth' },
    )
    const url = new URL(cfg.endpoints.auth)
    url.search = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: `${new URL(c.req.url).origin}/auth/google/callback`,
      response_type: 'code',
      scope: SCOPES,
      state,
      code_challenge: await sha256Base64Url(verifier),
      code_challenge_method: 'S256',
      access_type: 'offline',
      // "consent" makes Google return a refresh token on every sign-in, on any device.
      prompt: 'consent select_account',
      include_granted_scopes: 'true',
    }).toString()
    return c.redirect(url.toString(), 302)
  })

  app.get('/auth/google/callback', async (c) => {
    const cfg = deps.config(c.env ?? {})
    if (!cfg) return notSetUp(c)
    const failed = () => {
      deleteCookie(c, OAUTH, { path: '/auth' })
      return c.redirect('/?signin=failed', 302)
    }
    const pending = await unseal<{ state: string; verifier: string; exp: number }>(
      getCookie(c, OAUTH),
      cfg.sessionSecret,
    )
    const code = c.req.query('code')
    if (!pending || !code || pending.exp < Date.now() || c.req.query('state') !== pending.state) {
      return failed()
    }
    const res = await postForm(deps, cfg.endpoints.token, {
      grant_type: 'authorization_code',
      code,
      code_verifier: pending.verifier,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: `${new URL(c.req.url).origin}/auth/google/callback`,
    }).catch(() => null)
    if (!res?.ok) return failed()
    const tokens = (await res.json()) as {
      access_token?: string
      expires_in?: number
      refresh_token?: string
      id_token?: string
    }
    const claims = tokens.id_token ? idTokenClaims(tokens.id_token) : null
    const valid =
      claims &&
      claims.aud === cfg.clientId &&
      (claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com') &&
      typeof claims.exp === 'number' &&
      claims.exp * 1000 > Date.now() &&
      claims.email_verified === true &&
      typeof claims.sub === 'string' &&
      typeof claims.email === 'string'
    if (!valid || !tokens.access_token || !tokens.refresh_token) return failed()
    await writeSession(c, cfg, {
      sub: claims.sub as string,
      email: (claims.email as string).toLowerCase(),
      name: typeof claims.name === 'string' ? claims.name : (claims.email as string),
      rt: tokens.refresh_token,
      at: tokens.access_token,
      atExp: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    })
    deleteCookie(c, OAUTH, { path: '/auth' })
    return c.redirect('/', 302)
  })

  app.get('/api/session', async (c) => {
    const cfg = deps.config(c.env ?? {})
    const signedOut = (setUp: boolean) => c.json<SessionResponse>({ signedIn: false, setUp }, 401)
    if (!cfg) return signedOut(false)
    let s = await readSession(c, cfg)
    if (!s) return signedOut(true)
    if (s.atExp - Date.now() < REFRESH_EARLY_MS) {
      const res = await postForm(deps, cfg.endpoints.token, {
        grant_type: 'refresh_token',
        refresh_token: s.rt,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
      }).catch(() => null)
      if (res?.status === 400 || res?.status === 401) {
        // Google no longer accepts the grant: she revoked it, or it expired. Sign her out.
        deleteCookie(c, SESSION, { path: '/' })
        return signedOut(true)
      }
      if (!res?.ok) return c.json({ error: 'google_unreachable' }, 502)
      const t = (await res.json()) as { access_token: string; expires_in?: number }
      s = { ...s, at: t.access_token, atExp: Date.now() + (t.expires_in ?? 3600) * 1000 }
      await writeSession(c, cfg, s)
    }
    return c.json<SessionResponse>({
      signedIn: true,
      user: { sub: s.sub, email: s.email, name: s.name },
      accessToken: s.at,
      expiresAt: s.atExp,
      google: { sheets: cfg.endpoints.sheets, drive: cfg.endpoints.drive },
    })
  })

  app.post('/auth/logout', async (c) => {
    // A form on another site cannot sign her out: the browser sends its own Origin.
    const origin = c.req.header('origin')
    if (origin && origin !== new URL(c.req.url).origin) return c.text('Forbidden', 403)
    const cfg = deps.config(c.env ?? {})
    if (cfg) {
      const s = await readSession(c, cfg)
      // Revoking at Google ends this grant, so a copied cookie stops working too (D4).
      if (s) await postForm(deps, cfg.endpoints.revoke, { token: s.rt }).catch(() => null)
    }
    deleteCookie(c, SESSION, { path: '/' })
    return c.body(null, 204)
  })
}
