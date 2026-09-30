import { describe, expect, it } from 'vitest'
import dev, { DEV_ENTRY_MARKER } from './dev'

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
  props: {},
} as unknown as ExecutionContext

describe('dev worker entry', () => {
  it('serves localhost', async () => {
    const res = await dev.fetch(new Request('http://localhost:5173/api/health'), {}, ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-entry')).toBe(DEV_ENTRY_MARKER)
  })

  it('refuses any other host, so a wrong deploy serves nothing', async () => {
    const res = await dev.fetch(new Request('https://tracker.example.com/api/health'), {}, ctx)
    expect(res.status).toBe(404)
  })
})
