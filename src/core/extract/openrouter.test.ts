import { describe, expect, it, vi } from 'vitest'
import { classifyWithJev, ModelError, readWithModel } from './openrouter'
import type { ExtractContext } from './types'

const ctx: ExtractContext = {
  now: '2026-09-30T20:00:00.000Z',
  zone: 'America/Los_Angeles',
  candidates: [{ id: 'c-1', name: 'Priya Raman', role: '', contacts: [], links: [] }],
  self: { name: 'Rae Lin', email: 'rae@example.com' },
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

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

describe('readWithModel', () => {
  it('asks for structured output from providers that do not store data', async () => {
    const f = fakeFetch({
      choices: [{ message: { content: JSON.stringify(reading) } }],
      usage: { prompt_tokens: 900, completion_tokens: 80, cost: 0.0004 },
    })
    const out = await readWithModel('hi', ctx, { model: 'm', apiKey: 'k', fetch: f })
    expect(out.reading.candidate_name).toBe('Priya Raman')
    expect(out.usage).toMatchObject({ inputTokens: 900, outputTokens: 80, cost: 0.0004 })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    const body = JSON.parse(String(init.body))
    expect(body.provider).toEqual({ data_collection: 'deny', require_parameters: true })
    expect(body.response_format.type).toBe('json_schema')
    expect(body.temperature).toBe(0)
  })

  it('fails with a short error that carries no paste or reply', async () => {
    const f = fakeFetch({ error: 'secret paste text' }, 500)
    const err = await readWithModel('secret paste text', ctx, {
      model: 'm',
      apiKey: 'k',
      fetch: f,
    }).catch((e) => e)
    expect(err).toBeInstanceOf(ModelError)
    expect(String(err.message)).toBe('model http 500')
  })

  it('rejects a reply that is not the expected shape', async () => {
    const f = fakeFetch({ choices: [{ message: { content: '{"name":"x"}' } }] })
    await expect(readWithModel('hi', ctx, { model: 'm', apiKey: 'k', fetch: f })).rejects.toThrow(
      'model shape',
    )
  })

  it('times out', async () => {
    const f = vi.fn(
      (_: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          ),
        ),
    )
    await expect(
      readWithModel('hi', ctx, {
        model: 'm',
        apiKey: 'k',
        fetch: f as typeof fetch,
        timeoutMs: 10,
      }),
    ).rejects.toThrow('model timeout')
  })
})

describe('classifyWithJev', () => {
  it('asks the three typed questions and reads the answers', async () => {
    const f = fakeFetch({
      answers: {
        needs_reply: { type: 'noul', noul: 0.93 },
        direction: { type: 'choice', choice: 'in' },
        match: { type: 'choice', choice: 'c-1' },
      },
      usage: { input_tokens: 300, output_tokens: 20, cost: 0.00002 },
    })
    const out = await classifyWithJev('hi', ctx, { model: 'jev-1.13', apiKey: 'k', fetch: f })
    expect(out.answers).toEqual({ needsReply: 0.93, direction: 'in', matchId: 'c-1' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/systemone')
    const body = JSON.parse(String(init.body))
    expect(Object.keys(body.questions)).toEqual(['needs_reply', 'direction', 'match'])
    expect(body.questions.match.criteria).toHaveProperty('none')
  })
})
