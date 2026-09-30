import { describe, expect, it } from 'vitest'
import {
  type ModelReading,
  mentioned,
  mergeProposals,
  proposalFromReading,
  userPrompt,
} from './model'
import { extractWithRules } from './rules'
import type { ExtractContext } from './types'

const ctx: ExtractContext = {
  now: '2026-09-30T20:00:00.000Z',
  zone: 'America/Los_Angeles',
  candidates: [
    { id: 'c-priya', name: 'Priya Raman', role: '', contacts: ['priya@example.com'], links: [] },
  ],
  self: { name: 'Rae Lin', email: 'rae@example.com' },
}

const paste = `Priya Raman
Fri, Sep 25, 9:14 AM
hey Rae! live: https://ledger-ex.vercel.app code: github.com/ex-praman/ledger
can I also add tests later?`

const reading = (over: Partial<ModelReading> = {}): ModelReading => ({
  candidate_name: 'Priya Raman',
  candidate_contacts: [],
  role: null,
  source: null,
  direction: 'in',
  sent_at_text: 'Fri, Sep 25, 9:14 AM',
  deadline_text: null,
  links: [
    { url: 'https://ledger-ex.vercel.app', kind: 'submission' },
    { url: 'github.com/ex-praman/ledger', kind: 'repo' },
  ],
  needs_reply: true,
  existing_candidate_id: 'c-priya',
  ...over,
})

describe('proposalFromReading', () => {
  it('reads the time from the copied text with the tested date reader', () => {
    const p = proposalFromReading(reading(), paste, ctx)
    expect(p.messageAt).toBe('2026-09-25T16:14:00.000Z')
    expect(p.links.map((l) => l.url)).toEqual([
      'https://ledger-ex.vercel.app/',
      'https://github.com/ex-praman/ledger',
    ])
    expect(p.match?.id).toBe('c-priya')
  })

  it('drops a link, contact, time, or id that the paste does not contain', () => {
    const p = proposalFromReading(
      reading({
        links: [{ url: 'https://invented-ex.vercel.app', kind: 'submission' }],
        candidate_contacts: ['invented@example.com'],
        sent_at_text: 'Mon, Oct 5, 9:00 AM',
        existing_candidate_id: 'c-nobody',
      }),
      paste,
      ctx,
    )
    expect(p.links).toEqual([])
    expect(p.contacts).toEqual([])
    expect(p.messageAt).toBeNull()
    expect(p.match).toBeNull()
  })

  it('never takes her own email as the candidate contact', () => {
    const p = proposalFromReading(
      reading({ candidate_contacts: ['rae@example.com'] }),
      `${paste}\nrae@example.com`,
      ctx,
    )
    expect(p.contacts).toEqual([])
  })

  it('reads a deadline only from her own outgoing message', () => {
    const out = 'Hi Priya, here is the take-home. You have 48 hours.'
    const p = proposalFromReading(
      reading({ direction: 'out', deadline_text: 'You have 48 hours', needs_reply: true }),
      out,
      ctx,
    )
    expect(p.deadline?.at).toBe('2026-10-02T20:00:00.000Z')
    expect(p.needsReply).toBe(false)
    const inbound = proposalFromReading(reading({ deadline_text: 'You have 48 hours' }), out, ctx)
    expect(inbound.deadline).toBeNull()
  })
})

describe('mergeProposals', () => {
  it('takes who and what from the model, and exact links from the rules', () => {
    const rules = extractWithRules(paste, ctx)
    const model = proposalFromReading(
      reading({
        links: [{ url: 'github.com/ex-praman/ledger', kind: 'other' }],
        role: 'Founding engineer',
      }),
      paste,
      ctx,
    )
    const m = mergeProposals(rules, model)
    expect(m.role).toBe('Founding engineer')
    expect(m.links).toEqual([
      { url: 'https://ledger-ex.vercel.app/', kind: 'submission' },
      { url: 'https://github.com/ex-praman/ledger', kind: 'other' },
    ])
    expect(m.needsReply).toBe(true)
  })

  it('keeps a strong rules match when the model finds none', () => {
    const rules = extractWithRules(`${paste}\npriya@example.com`, ctx)
    const model = proposalFromReading(reading({ existing_candidate_id: null }), paste, ctx)
    expect(mergeProposals(rules, model).match?.id).toBe('c-priya')
  })
})

describe('userPrompt', () => {
  it('names her, lists the candidates the paste mentions, and fences the paste', () => {
    const text = userPrompt('hello from Priya', ctx)
    expect(text).toContain('Recruiter: Rae Lin <rae@example.com>')
    expect(text).toContain('"id":"c-priya"')
    expect(text).toContain('"""\nhello from Priya\n"""')
  })
})

describe('mentioned', () => {
  const roster = [
    { id: 'a', name: 'Priya Raman', role: '', contacts: ['priya@example.com'], links: [] },
    { id: 'b', name: 'Omar Haddad', role: '', contacts: ['+15550100163'], links: [] },
    {
      id: 'c',
      name: 'Lena Fischer',
      role: '',
      contacts: [],
      links: ['https://github.com/ex-lena/app'],
    },
    { id: 'd', name: 'Mei Tanaka', role: '', contacts: [], links: [] },
  ]

  it('sends only the candidates the paste names or shares a contact or link with', () => {
    const paste = 'from priya@example.com, cc (555) 010-0163, see github.com/ex-lena/app'
    expect(mentioned(paste, roster).map((c) => c.id)).toEqual(['a', 'b', 'c'])
    expect(mentioned('hi, it is Mei', roster).map((c) => c.id)).toEqual(['d'])
  })

  it('sends none for a paste that mentions nobody', () => {
    expect(mentioned('thanks, talk soon', roster)).toEqual([])
    expect(userPrompt('thanks, talk soon', { ...ctx, candidates: roster })).toContain(
      'Known candidates: []',
    )
  })
})
