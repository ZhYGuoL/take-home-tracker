import { type ModelReading, READING_SCHEMA, SYSTEM_PROMPT, userPrompt } from './model'
import type { ExtractContext } from './types'

export const OPENROUTER = 'https://openrouter.ai/api/v1'

export interface ModelCall {
  model: string
  apiKey: string
  fetch: typeof fetch
  baseUrl?: string
  timeoutMs?: number
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  /** US dollars, as OpenRouter reports it. */
  cost: number | null
  ms: number
}

export class ModelError extends Error {
  constructor(
    readonly kind: 'timeout' | 'http' | 'shape',
    readonly status?: number,
  ) {
    // The message names the failure only. It never carries the paste or the reply (D6).
    super(`model ${kind}${status ? ` ${status}` : ''}`)
  }
}

async function post(call: ModelCall, path: string, body: unknown): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), call.timeoutMs ?? 12_000)
  try {
    const res = await call.fetch(`${call.baseUrl ?? OPENROUTER}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${call.apiKey}`,
        'content-type': 'application/json',
        'x-title': 'take-home-tracker',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) throw new ModelError('http', res.status)
    return await res.json()
  } catch (err) {
    if (err instanceof ModelError) throw err
    if (err instanceof Error && err.name === 'AbortError') throw new ModelError('timeout')
    throw new ModelError('http')
  } finally {
    clearTimeout(timer)
  }
}

function isReading(x: unknown): x is ModelReading {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return (
    Array.isArray(r.candidate_contacts) &&
    Array.isArray(r.links) &&
    (r.direction === 'in' || r.direction === 'out') &&
    typeof r.needs_reply === 'boolean'
  )
}

/** Asks a chat model for a reading of the paste, with structured output. */
export async function readWithModel(
  paste: string,
  ctx: ExtractContext,
  call: ModelCall,
): Promise<{ reading: ModelReading; usage: Usage }> {
  const started = Date.now()
  const json = (await post(call, '/chat/completions', {
    model: call.model,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt(paste, ctx) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'reading', strict: true, schema: READING_SCHEMA },
    },
    // Only providers that do not store or train on requests (D6).
    provider: { data_collection: 'deny', require_parameters: true },
    usage: { include: true },
  })) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
  }
  let reading: unknown
  try {
    reading = JSON.parse(json.choices?.[0]?.message?.content ?? '')
  } catch {
    throw new ModelError('shape')
  }
  if (!isReading(reading)) throw new ModelError('shape')
  return {
    reading,
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
      cost: json.usage?.cost ?? null,
      ms: Date.now() - started,
    },
  }
}

export interface JevAnswers {
  needsReply: number
  direction: 'in' | 'out'
  matchId: string | null
}

/**
 * Asks Jev (TypeSafe on OpenRouter) the three yes/no and choice questions it can answer.
 * Jev returns typed answers, never text, so it cannot read names, links, or dates.
 */
export async function classifyWithJev(
  paste: string,
  ctx: ExtractContext,
  call: ModelCall,
): Promise<{ answers: JevAnswers; usage: Usage }> {
  const started = Date.now()
  const criteria: Record<string, string> = { none: 'None of the known candidates' }
  for (const c of ctx.candidates) {
    criteria[c.id] = `${c.name} (${[...c.contacts, ...c.links].join(', ') || 'no contacts'})`
  }
  const json = (await post(call, '/systemone', {
    model: call.model,
    state: `Recruiter: ${ctx.self?.name ?? 'unknown'}\n\n${paste}`,
    questions: {
      needs_reply: {
        type: 'noul',
        instructions:
          'Is this a message from a candidate that asks the recruiter something or waits on her reply?',
      },
      direction: {
        type: 'choice',
        instructions: 'Who wrote this message?',
        criteria: { in: 'The candidate wrote it', out: 'The recruiter wrote it' },
      },
      match: {
        type: 'choice',
        instructions: 'Which known candidate is this message about?',
        criteria,
      },
    },
  })) as {
    answers?: {
      needs_reply?: { noul?: number }
      direction?: { choice?: string }
      match?: { choice?: string }
    }
    usage?: { input_tokens?: number; output_tokens?: number; cost?: number }
  }
  const a = json.answers
  if (typeof a?.needs_reply?.noul !== 'number' || !a.direction?.choice) {
    throw new ModelError('shape')
  }
  const match = a.match?.choice
  return {
    answers: {
      needsReply: a.needs_reply.noul,
      direction: a.direction.choice === 'out' ? 'out' : 'in',
      matchId:
        match && match !== 'none' && ctx.candidates.some((c) => c.id === match) ? match : null,
    },
    usage: {
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
      cost: json.usage?.cost ?? null,
      ms: Date.now() - started,
    },
  }
}
