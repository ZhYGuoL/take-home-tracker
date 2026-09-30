import { describe, expect, it } from 'vitest'
import { deadlineAt } from './deadline'
import { derive } from './derive'
import type { FactRow } from './filters'
import { flagsOf, needsYou } from './flags'
import { sortRows } from './sort'
import { candidate, message, opened, submission } from './testing/fixtures'
import type { Candidate, Entry } from './types'

const NOW = Date.parse('2026-10-05T19:00:00Z')

function row(c: Candidate, entries: Entry[]): FactRow {
  const derived = derive(c, entries)
  const flags = flagsOf(c, derived, NOW)
  return { candidate: c, derived, flags, needsYou: needsYou(derived, flags) }
}

const LA = 'America/Los_Angeles'
const long = candidate({ name: 'Long overdue', deadline: deadlineAt('2026-09-30', '17:00', LA) })
const short = candidate({ name: 'Just overdue', deadline: deadlineAt('2026-10-04', '17:00', LA) })
const oldAsk = candidate({ name: 'Old question', createdAt: '2026-09-01T00:00:00Z' })
const newAsk = candidate({ name: 'New question', createdAt: '2026-09-01T00:00:00Z' })
const oldSub = candidate({ name: 'Old submission', createdAt: '2026-09-01T00:00:00Z' })
const newSub = candidate({ name: 'New submission', createdAt: '2026-09-01T00:00:00Z' })

const rows = [
  row(newSub, [submission(newSub, '2026-10-05T10:00:00Z')]),
  row(newAsk, [message(newAsk, '2026-10-05T09:00:00Z', { needsReply: true })]),
  row(short, []),
  row(oldSub, [submission(oldSub, '2026-10-03T10:00:00Z')]),
  row(oldAsk, [message(oldAsk, '2026-10-02T09:00:00Z', { needsReply: true })]),
  row(long, []),
]

describe('sortRows', () => {
  it('Needs you puts overdue, then replies, then submissions, oldest first', () => {
    expect(sortRows(rows, 'needs').map((r) => r.candidate.name)).toEqual([
      'Long overdue',
      'Just overdue',
      'Old question',
      'New question',
      'Old submission',
      'New submission',
    ])
  })

  it('All puts the latest activity first', () => {
    expect(
      sortRows(rows, 'all')
        .map((r) => r.candidate.name)
        .slice(0, 2),
    ).toEqual(['New submission', 'New question'])
  })

  it('orders waiting replies by when the question came in, not by later activity', () => {
    const early = candidate({ name: 'Early question', createdAt: '2026-09-01T00:00:00Z' })
    const late = candidate({ name: 'Late question', createdAt: '2026-09-01T00:00:00Z' })
    const both = [
      row(late, [message(late, '2026-10-04T09:00:00Z', { needsReply: true })]),
      row(early, [
        submission(early, '2026-10-02T09:00:00Z'),
        message(early, '2026-10-03T09:00:00Z', { needsReply: true }),
        opened(early, '2026-10-05T09:00:00Z'),
      ]),
    ]
    expect(sortRows(both, 'needs').map((r) => r.candidate.name)).toEqual([
      'Early question',
      'Late question',
    ])
  })

  it('does not change its input', () => {
    const before = rows.map((r) => r.candidate.id)
    sortRows(rows, 'needs')
    expect(rows.map((r) => r.candidate.id)).toEqual(before)
  })
})
