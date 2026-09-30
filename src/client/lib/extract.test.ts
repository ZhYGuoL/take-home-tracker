import { describe, expect, it, vi } from 'vitest'
import type { ExtractContext } from '../../core/extract/types'
import { makeExtractor } from './extract'

const ctx: ExtractContext = {
  now: '2026-09-30T20:00:00.000Z',
  zone: 'America/Los_Angeles',
  candidates: [],
  self: { name: 'Rae Lin', email: 'rae@example.com' },
}
const paste = 'hey Rae, it is done: https://app-ex.vercel.app'
const reading = {
  candidate_name: null,
  candidate_contacts: [],
  role: 'Founding engineer',
  source: 'imessage',
  direction: 'in',
  sent_at_text: null,
  deadline_text: null,
  links: [{ url: 'https://app-ex.vercel.app', kind: 'submission' }],
  needs_reply: false,
  existing_candidate_id: null,
}

function fetcher(enabled: boolean, extract: () => Promise<Response>) {
  return vi.fn(async (url: string) =>
    url === '/api/model' ? new Response(JSON.stringify({ enabled })) : extract(),
  ) as unknown as typeof fetch
}

describe('makeExtractor', () => {
  it('uses only the rules when the model is off, and never sends the paste', async () => {
    const extract = vi.fn()
    const f = fetcher(false, extract)
    const p = await makeExtractor(f)(paste, ctx)
    expect(p.role).toBeNull()
    expect(extract).not.toHaveBeenCalled()
  })

  it('merges the model reading when the model is on', async () => {
    const f = fetcher(true, async () => new Response(JSON.stringify({ reading })))
    const p = await makeExtractor(f)(paste, ctx)
    expect(p.role).toBe('Founding engineer')
    expect(p.source).toBe('imessage')
  })

  it('falls back to the rules when the model fails', async () => {
    const f = fetcher(
      true,
      async () => new Response(JSON.stringify({ error: 'model_failed' }), { status: 502 }),
    )
    const p = await makeExtractor(f)(paste, ctx)
    expect(p.links.map((l) => l.kind)).toEqual(['submission'])
    expect(p.role).toBeNull()
  })

  it('falls back to the rules when the model is slow', async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/model') return new Response(JSON.stringify({ enabled: true }))
      return new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      )
    }) as unknown as typeof fetch
    const p = await makeExtractor(f, 20)(paste, ctx)
    expect(p.role).toBeNull()
  })

  it('falls back to the rules when the Worker cannot be reached', async () => {
    const f = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    const p = await makeExtractor(f)(paste, ctx)
    expect(p.links).toHaveLength(1)
  })
})
