import { createApp } from './app'
import { DEV_ENTRY_MARKER } from './dev-marker'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

// Workers treat every named export of the entry as a handler, so this file exports only the default.
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
