import { createApp } from './app'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

/** The production bundle check fails if this string ships (D5). */
export const DEV_ENTRY_MARKER = 'take-home-tracker-dev-entry'

const app = createApp()

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    if (!LOCAL_HOSTS.has(new URL(request.url).hostname)) {
      return new Response('Not found', { status: 404 })
    }
    const res = await app.fetch(request, env, ctx)
    const tagged = new Response(res.body, res)
    tagged.headers.set('x-entry', DEV_ENTRY_MARKER)
    return tagged
  },
}
