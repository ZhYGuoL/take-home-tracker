import type { Context } from 'hono'
import { type ModelCall, readWithModel } from '../core/extract/openrouter'
import { type ExtractRequest, type ExtractResponse, MAX_EXTRACT } from '../shared/api'
import type { Env, User } from './env'

const MAX_CONTEXT = 200_000

export interface ExtractDeps {
  fetch: typeof fetch
  openrouterBase?: string
  currentUser: (c: Context<{ Bindings: Env }>) => Promise<User | null>
}

const allowed = (env: Env, email: string) =>
  (env.MODEL_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase())

/** Is the model on for this user? The client asks before it sends a paste. */
export async function modelEnabled(c: Context<{ Bindings: Env }>, deps: ExtractDeps) {
  const env = c.env ?? {}
  const user = await deps.currentUser(c)
  return Boolean(env.OPENROUTER_API_KEY && env.MODEL_ID && user && allowed(env, user.email))
}

/**
 * Sends one paste to the model and returns its reading. It never logs the paste or the reply,
 * and its errors name only what failed (D6).
 */
export async function extractRoute(
  c: Context<{ Bindings: Env }>,
  deps: ExtractDeps,
): Promise<Response> {
  const env = c.env ?? {}
  const reply = (body: ExtractResponse, status: 200 | 400 | 403 | 429 | 502 | 503) =>
    c.json(body, status)
  if (!env.OPENROUTER_API_KEY || !env.MODEL_ID) return reply({ error: 'model_off' }, 503)
  const user = await deps.currentUser(c)
  if (!user || !allowed(env, user.email)) return reply({ error: 'not_allowed' }, 403)
  if (env.MODEL_LIMITER) {
    const { success } = await env.MODEL_LIMITER.limit({ key: user.sub })
    if (!success) return reply({ error: 'too_many' }, 429)
  }
  let body: ExtractRequest
  try {
    body = await c.req.json<ExtractRequest>()
  } catch {
    return reply({ error: 'bad_request' }, 400)
  }
  if (typeof body?.paste !== 'string' || !body.paste.trim() || body.paste.length > MAX_EXTRACT) {
    return reply({ error: 'bad_request' }, 400)
  }
  // The known candidates travel with the paste. A cap keeps a crafted request from running up cost.
  if (!Array.isArray(body.ctx?.candidates) || JSON.stringify(body.ctx).length > MAX_CONTEXT) {
    return reply({ error: 'bad_request' }, 400)
  }
  const call: ModelCall = {
    model: env.MODEL_ID,
    apiKey: env.OPENROUTER_API_KEY,
    fetch: deps.fetch,
    ...(deps.openrouterBase ? { baseUrl: deps.openrouterBase } : {}),
  }
  try {
    const { reading } = await readWithModel(body.paste, body.ctx, call)
    return reply({ reading }, 200)
  } catch (err) {
    console.error('extract failed', err instanceof Error ? err.message : 'unknown')
    return reply({ error: 'model_failed' }, 502)
  }
}
