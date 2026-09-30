import { describe, expect, it } from 'vitest'
import { foldName, matchCandidate } from './match'
import type { KnownCandidate } from './types'

const people: KnownCandidate[] = [
  { id: 'a', name: 'Alexandra Chen', role: '', contacts: ['alex@example.com'], links: [] },
  {
    id: 'b',
    name: 'Tomás Rivera',
    role: '',
    contacts: ['@tomasr'],
    links: ['https://github.com/ex-trivera/relay'],
  },
  { id: 'c', name: 'Jordan Lee', role: '', contacts: [], links: [] },
  { id: 'd', name: 'Jordan Park', role: '', contacts: [], links: [] },
]

const m = (input: Partial<Parameters<typeof matchCandidate>[0]>) =>
  matchCandidate({ name: null, contacts: [], links: [], ...input }, people)

describe('matchCandidate', () => {
  it('a shared contact is a strong match', () => {
    expect(m({ contacts: ['alex@example.com'] })).toEqual({
      id: 'a',
      strength: 'strong',
      via: 'alex@example.com',
    })
  })

  it('the same repo owner is a strong match', () => {
    expect(m({ links: [{ url: 'https://github.com/ex-trivera/other', kind: 'repo' }] })?.id).toBe(
      'b',
    )
  })

  it('a take-home doc link never matches, because she sends it to everyone', () => {
    const withDoc = [
      { ...people[1], links: ['https://docs.google.com/document/d/1x/edit'] },
    ] as KnownCandidate[]
    const input = {
      name: 'Omar',
      contacts: [],
      links: [{ url: 'https://docs.google.com/document/d/1x/edit', kind: 'doc' as const }],
    }
    expect(matchCandidate(input, withDoc)).toBeNull()
  })

  it('a shared link gives way when the paste names someone else', () => {
    const input = {
      name: 'Lena Brandt',
      contacts: [],
      links: [{ url: 'https://github.com/ex-trivera/relay', kind: 'repo' as const }],
    }
    expect(matchCandidate(input, people)).toBeNull()
  })

  it('a shared repo still matches under a short form of the same name and a new email', () => {
    const input = {
      name: 'Tom Rivera',
      contacts: ['tom.r@example.org'],
      links: [{ url: 'https://github.com/ex-trivera/relay', kind: 'repo' as const }],
    }
    expect(matchCandidate(input, people)?.id).toBe('b')
  })

  it('a full name matches without accents or case', () => {
    expect(m({ name: 'tomas rivera' })).toMatchObject({ id: 'b', strength: 'strong' })
  })

  it('a short form of a first name is a weak match', () => {
    expect(m({ name: 'Alex' })).toMatchObject({ id: 'a', strength: 'weak' })
  })

  it('a first name two candidates share gives no match', () => {
    expect(m({ name: 'Jordan' })).toBeNull()
  })

  it('an unknown full name gives no match, even when the first name is known', () => {
    expect(m({ name: 'Jordan Smith' })).toBeNull()
  })
})

describe('foldName', () => {
  it('drops accents, case, and extra spaces', () => {
    expect(foldName('  Tomás   RIVERA ')).toBe('tomas rivera')
  })
})
