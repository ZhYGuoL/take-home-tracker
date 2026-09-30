import {
  FAKE_CLIENT_ID,
  FAKE_CLIENT_SECRET,
  FAKE_GOOGLE_URL,
  FAKE_SESSION_SECRET,
} from '../shared/fake-google'
import { createApp } from './app'
import { GOOGLE } from './auth'
import { DEV_ENTRY_MARKER } from './dev-marker'
import type { Env } from './env'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

// Local development and tests only (D5). With GOOGLE_CLIENT_ID in .dev.vars it signs in with
// real Google. Without it, it uses the local fake at test/fake-google/server.ts.
// Workers treat every named export of the entry as a handler, so this file exports only the default.
const app = createApp({
  fetch: (input, init) => fetch(input, init),
  auth: (env) =>
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          sessionSecret: env.SESSION_SECRET || FAKE_SESSION_SECRET,
          endpoints: GOOGLE,
        }
      : {
          clientId: FAKE_CLIENT_ID,
          clientSecret: FAKE_CLIENT_SECRET,
          sessionSecret: FAKE_SESSION_SECRET,
          endpoints: {
            auth: `${FAKE_GOOGLE_URL}/o/oauth2/v2/auth`,
            token: `${FAKE_GOOGLE_URL}/token`,
            revoke: `${FAKE_GOOGLE_URL}/revoke`,
            sheets: FAKE_GOOGLE_URL,
            drive: FAKE_GOOGLE_URL,
          },
        },
})

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (!LOCAL_HOSTS.has(new URL(request.url).hostname)) {
      return new Response('Not found', { status: 404 })
    }
    const res = await app.fetch(request, env, ctx)
    const tagged = new Response(res.body, res)
    tagged.headers.set('x-entry', DEV_ENTRY_MARKER)
    return tagged
  },
}
