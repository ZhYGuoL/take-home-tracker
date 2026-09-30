import type { Candidate, Entry, Link, MessageEntry, Stage } from '../types'

let seq = 0
const nextId = (prefix: string) => `${prefix}-${String(++seq).padStart(4, '0')}`

export function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: nextId('c'),
    name: 'Rowan Okafor',
    role: 'Founding engineer',
    source: 'imessage',
    contacts: [],
    sentAt: '2026-09-28T16:00:00.000Z',
    deadline: null,
    takeHomeUrl: '',
    notes: '',
    createdAt: '2026-09-28T16:00:00.000Z',
    ...overrides,
  }
}

export function message(
  c: Candidate,
  at: string,
  overrides: Partial<Omit<MessageEntry, 'kind'>> = {},
): MessageEntry {
  return {
    id: nextId('e'),
    candidateId: c.id,
    at,
    kind: 'message',
    direction: 'in',
    text: '',
    source: c.source,
    links: [],
    needsReply: false,
    ...overrides,
  }
}

export const submissionLink: Link = { url: 'https://rowan-pantry.example.com', kind: 'submission' }
export const repoLink: Link = { url: 'https://github.com/example-rowan/pantry', kind: 'repo' }

export function submission(c: Candidate, at: string, links: Link[] = [submissionLink]): Entry {
  return message(c, at, { links })
}

export function stage(c: Candidate, at: string, s: Stage): Entry {
  return { id: nextId('e'), candidateId: c.id, at, kind: 'stage', stage: s }
}

export function opened(c: Candidate, at: string): Entry {
  return { id: nextId('e'), candidateId: c.id, at, kind: 'opened', url: submissionLink.url }
}

export function replied(c: Candidate, at: string): Entry {
  return { id: nextId('e'), candidateId: c.id, at, kind: 'replied' }
}
