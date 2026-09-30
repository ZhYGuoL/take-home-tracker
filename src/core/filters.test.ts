import { describe, expect, it } from 'vitest'
import { deadlineAt } from './deadline'
import { derive } from './derive'
import {
  activeCount,
  applyFilters,
  countOptions,
  type FactRow,
  type Filters,
  filtersFromQuery,
  filtersToQuery,
  NO_FILTERS,
} from './filters'
import { flagsOf, needsYou } from './flags'
import { candidate, message, opened, stage, submission } from './testing/fixtures'
import type { Candidate, Entry } from './types'

const LA = 'America/Los_Angeles'
const NOW = Date.parse('2026-10-05T19:00:00Z') // Mon Oct 5, 12:00 PDT

function row(c: Candidate, entries: Entry[]): FactRow {
  const derived = derive(c, entries)
  const flags = flagsOf(c, derived, NOW)
  return { candidate: c, derived, flags, needsYou: needsYou(derived, flags) }
}

// A small fictional pipeline.
const ada = candidate({
  name: 'Ada Lindqvist',
  role: 'Founding engineer',
  source: 'email',
  contacts: ['ada@example.com'],
  deadline: deadlineAt('2026-10-02', '17:00', LA),
})
const ben = candidate({
  name: 'Ben Osei',
  role: 'Founding engineer',
  source: 'x',
  deadline: deadlineAt('2026-10-09', '17:00', LA),
})
const cyd = candidate({
  name: 'Cyd Marsh',
  role: 'Product engineer',
  source: 'imessage',
  deadline: deadlineAt('2026-10-01', '17:00', LA),
})
const dev = candidate({ name: 'Dev Patel', role: '', source: 'linkedin', deadline: null })
const eli = candidate({
  name: 'Eli Brandt',
  role: 'Product engineer',
  source: 'email',
  deadline: deadlineAt('2026-10-02', '23:00', LA),
})

const rows: FactRow[] = [
  // Overdue: deadline passed, nothing in.
  row(ada, []),
  // Needs reply, deadline ahead.
  row(ben, [message(ben, '2026-10-04T10:00:00Z', { needsReply: true })]),
  // Late submission, not yet opened: Submitted.
  row(cyd, [submission(cyd, '2026-10-02T02:00:00Z')]),
  // Advanced.
  row(dev, [stage(dev, '2026-10-03T10:00:00Z', 'advanced')]),
  // On time, reviewing.
  row(eli, [submission(eli, '2026-10-02T20:00:00Z'), opened(eli, '2026-10-03T09:00:00Z')]),
]

const names = (f: Partial<Filters>) =>
  applyFilters(rows, { ...NO_FILTERS, view: 'all', ...f }, LA).map(
    (r) => r.candidate.name.split(' ')[0],
  )

describe('the rows under test', () => {
  it('have the expected stages and flags', () => {
    expect(rows.map((r) => [r.derived.stage, r.flags])).toEqual([
      ['sent', { overdue: true, late: false, needsReply: false }],
      ['sent', { overdue: false, late: false, needsReply: true }],
      ['submitted', { overdue: false, late: true, needsReply: false }],
      ['advanced', { overdue: false, late: false, needsReply: false }],
      ['reviewing', { overdue: false, late: false, needsReply: false }],
    ])
  })
})

describe('each filter alone', () => {
  it('Needs you is overdue, needs reply, or submitted', () => {
    expect(names({ view: 'needs' })).toEqual(['Ada', 'Ben', 'Cyd'])
  })
  it('stage', () => {
    expect(names({ stages: ['sent'] })).toEqual(['Ada', 'Ben'])
  })
  it('flag', () => {
    expect(names({ flags: ['late'] })).toEqual(['Cyd'])
  })
  it('role, including no role', () => {
    expect(names({ roles: ['Product engineer'] })).toEqual(['Cyd', 'Eli'])
    expect(names({ roles: [''] })).toEqual(['Dev'])
  })
  it('source', () => {
    expect(names({ sources: ['email'] })).toEqual(['Ada', 'Eli'])
  })
  it('date range on deadline, inclusive, in the viewer zone', () => {
    expect(names({ date: { field: 'deadline', from: '2026-10-02', to: '2026-10-02' } })).toEqual([
      'Ada',
      'Eli',
    ])
  })
  it('the same deadline falls on the next day for a viewer in New York', () => {
    // Eli's deadline is 11 PM Oct 2 in Los Angeles, which is 2 AM Oct 3 in New York.
    const f: Filters = {
      ...NO_FILTERS,
      view: 'all',
      date: { field: 'deadline', from: '2026-10-03', to: null },
    }
    expect(applyFilters(rows, f, 'America/New_York').map((r) => r.candidate.name)).toEqual([
      'Ben Osei',
      'Eli Brandt',
    ])
  })
  it('a date range leaves out rows without that date', () => {
    expect(names({ date: { field: 'submitted', from: null, to: null } })).toEqual(['Cyd', 'Eli'])
  })
  it('search matches name, role, and contact, every word', () => {
    expect(names({ q: 'ada@example' })).toEqual(['Ada'])
    expect(names({ q: 'product eli' })).toEqual(['Eli'])
  })
})

describe('filters combined', () => {
  it('values in one dimension combine with OR', () => {
    expect(names({ stages: ['sent', 'advanced'] })).toEqual(['Ada', 'Ben', 'Dev'])
    expect(names({ flags: ['overdue', 'late'] })).toEqual(['Ada', 'Cyd'])
  })
  it('dimensions combine with AND', () => {
    expect(names({ roles: ['Founding engineer'], sources: ['x'] })).toEqual(['Ben'])
    expect(names({ view: 'needs', roles: ['Product engineer'] })).toEqual(['Cyd'])
    expect(
      names({
        stages: ['sent', 'submitted', 'reviewing'],
        sources: ['email', 'imessage'],
        date: { field: 'deadline', from: '2026-10-01', to: '2026-10-02' },
      }),
    ).toEqual(['Ada', 'Cyd', 'Eli'])
  })
  it('an impossible combination shows nothing', () => {
    expect(names({ flags: ['late'], stages: ['sent'] })).toEqual([])
  })
})

describe('countOptions', () => {
  it('counts each option against every other filter', () => {
    const f: Filters = { ...NO_FILTERS, view: 'all', sources: ['email'] }
    const c = countOptions(rows, f, LA)
    expect(c.view).toEqual({ needs: 1, all: 2 })
    expect(c.stages).toMatchObject({ sent: 1, reviewing: 1, submitted: 0 })
    // Source counts ignore the source filter itself.
    expect(c.sources).toMatchObject({ email: 2, x: 1, imessage: 1, linkedin: 1 })
    expect(c.roles).toEqual([
      ['Founding engineer', 1],
      ['Product engineer', 1],
    ])
  })

  it('keeps a selected role that no longer has rows, at zero', () => {
    const c = countOptions(rows, { ...NO_FILTERS, roles: ['Designer'] }, LA)
    expect(c.roles).toContainEqual(['Designer', 0])
  })

  it('lists no role last', () => {
    const c = countOptions(rows, { ...NO_FILTERS, view: 'all' }, LA)
    expect(c.roles.at(-1)).toEqual(['', 1])
  })
})

describe('query string', () => {
  it('round-trips every filter, including awkward role names', () => {
    const f: Filters = {
      view: 'all',
      stages: ['submitted', 'reviewing'],
      flags: ['needsReply'],
      roles: ['Founding engineer, infra', 'R&D', ''],
      sources: ['x'],
      date: { field: 'submitted', from: '2026-10-01', to: null },
      q: 'rowan',
    }
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(filtersToQuery(f))) if (v !== null) p.set(k, v)
    expect(filtersFromQuery(new URLSearchParams(p.toString()))).toEqual(f)
  })

  it('the default view writes nothing', () => {
    expect(Object.values(filtersToQuery(NO_FILTERS)).every((v) => v === null)).toBe(true)
  })

  it('drops unknown values', () => {
    const f = filtersFromQuery(new URLSearchParams('stage=sent,bogus&flag=nope&date=when:x:y'))
    expect(f.stages).toEqual(['sent'])
    expect(f.flags).toEqual([])
    expect(f.date).toBeNull()
  })

  it('counts active filters', () => {
    expect(activeCount({ ...NO_FILTERS, stages: ['sent', 'passed'], q: 'x' })).toBe(3)
  })
})
