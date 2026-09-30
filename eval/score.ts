import type { Proposal } from '../src/core/extract/types'
import { normalizeUrl } from '../src/core/links'
import type { Case, Expected } from './types'

export const FIELDS = [
  'name',
  'contacts',
  'role',
  'source',
  'direction',
  'messageAt',
  'links',
  'deadline',
  'needsReply',
  'match',
  'suggest',
] as const
export type Field = (typeof FIELDS)[number]

const MINUTE = 60_000
const lower = (s: string | null) => (s === null ? null : s.trim().toLowerCase())
const url = (u: string) => normalizeUrl(u) ?? u
const sameSet = (a: string[], b: string[]) => {
  const x = [...new Set(a)].sort()
  const y = [...new Set(b)].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}
const sameTime = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : Math.abs(Date.parse(a) - Date.parse(b)) < MINUTE

/**
 * Every case checks every field. A field the paste does not state expects nothing, so a
 * proposal that invents a value is wrong (D14).
 */
export function checked(_: Expected): Field[] {
  return [...FIELDS]
}

export function fieldCorrect(f: Field, e: Expected, p: Proposal): boolean {
  switch (f) {
    case 'name':
      return lower(p.name) === lower(e.name)
    case 'contacts':
      return sameSet(p.contacts, e.contacts)
    case 'role':
      return lower(p.role) === lower(e.role)
    case 'source':
      return p.source === e.source
    case 'direction':
      return p.direction === e.direction
    case 'messageAt':
      return sameTime(p.messageAt, e.messageAt)
    case 'links':
      return sameSet(
        p.links.map((l) => `${l.kind} ${url(l.url)}`),
        e.links.map((l) => `${l.kind} ${url(l.url)}`),
      )
    case 'deadline':
      return sameTime(p.deadline?.at ?? null, e.deadline)
    case 'needsReply':
      return p.needsReply === e.needsReply
    case 'match':
      // What attaches by default: a strong match. A weak one leaves the target on "New".
      return (p.match?.strength === 'strong' ? p.match.id : null) === e.match
    case 'suggest':
      // The candidate listed first, strong or weak, for information.
      return (p.match?.id ?? null) === e.match
  }
}

export interface CaseResult {
  id: string
  wrong: Field[]
}

export interface Score {
  /** Correct over checked, per field. */
  fields: Record<Field, { correct: number; checked: number }>
  cases: CaseResult[]
}

export function score(cases: Case[], proposals: Proposal[]): Score {
  const fields = Object.fromEntries(
    FIELDS.map((f) => [f, { correct: 0, checked: 0 }]),
  ) as Score['fields']
  const results: CaseResult[] = []
  cases.forEach((c, i) => {
    const p = proposals[i]
    if (!p) throw new Error(`no proposal for ${c.id}`)
    const wrong: Field[] = []
    for (const f of checked(c.expected)) {
      fields[f].checked++
      if (fieldCorrect(f, c.expected, p)) fields[f].correct++
      else wrong.push(f)
    }
    results.push({ id: c.id, wrong })
  })
  return { fields, cases: results }
}

export const ratio = (s: { correct: number; checked: number }) =>
  s.checked === 0 ? 1 : s.correct / s.checked
