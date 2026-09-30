import { mergeProposals, proposalFromReading } from '../../core/extract/model'
import { extractWithRules } from '../../core/extract/rules'
import type { ExtractContext, Proposal } from '../../core/extract/types'
import type { ExtractRequest, ExtractResponse } from '../../shared/api'

export type Extractor = (paste: string, ctx: ExtractContext) => Promise<Proposal>

/**
 * Reads a paste with the rules, and with the model when the Worker says it is on for her.
 * Any model failure or a wait over `timeoutMs` gives the rules reading, so adding by paste
 * always works (D6).
 */
export function makeExtractor(fetcher: typeof fetch = fetch, timeoutMs = 12_000): Extractor {
  // Whether the model is on is asked again every 5 minutes, so a change on the server shows up.
  let enabled: Promise<boolean> | null = null
  let askedAt = 0
  return async (paste, ctx) => {
    const rules = extractWithRules(paste, ctx)
    if (Date.now() - askedAt > 300_000) {
      enabled = null
      askedAt = Date.now()
    }
    enabled ??= fetcher('/api/model')
      .then((r) => (r.ok ? (r.json() as Promise<{ enabled?: boolean }>) : { enabled: false }))
      .then((j) => j.enabled === true)
      .catch(() => false)
    if (!(await enabled)) return rules
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const request: ExtractRequest = { paste, ctx }
      const res = await fetcher('/api/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      })
      if (!res.ok) return rules
      const body = (await res.json()) as ExtractResponse
      if (!('reading' in body)) return rules
      return mergeProposals(rules, proposalFromReading(body.reading, paste, ctx))
    } catch {
      return rules
    } finally {
      clearTimeout(timer)
    }
  }
}
