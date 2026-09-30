import { describe, expect, it } from 'vitest'
import { createApp } from './app'

describe('worker app', () => {
  it('answers the health check', async () => {
    const res = await createApp({ fetch, currentUser: async () => null }).request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
