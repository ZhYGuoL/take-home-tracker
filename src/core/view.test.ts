import { describe, expect, it } from 'vitest'
import { deadlineAt } from './deadline'
import type { StoredRecord } from './records'
import { candidate, submission } from './testing/fixtures'
import { VIEW_HEADER, viewRows } from './view'

describe('viewRows', () => {
  it('writes one plain row per live candidate, newest activity first', () => {
    const a = candidate({
      name: 'Ada Lindqvist',
      contacts: ['ada@example.com'],
      deadline: deadlineAt('2026-10-02', '17:00', 'America/Los_Angeles'),
    })
    const b = candidate({ name: 'Ben Osei' })
    const gone = candidate({ name: 'Gone Person' })
    const sub = submission(a, '2026-10-03T10:00:00Z')
    const records: StoredRecord[] = [
      { id: a.id, type: 'candidate', updatedAt: a.createdAt, deleted: false, data: a },
      { id: b.id, type: 'candidate', updatedAt: b.createdAt, deleted: false, data: b },
      { id: gone.id, type: 'candidate', updatedAt: gone.createdAt, deleted: true, data: null },
      { id: sub.id, type: 'entry', updatedAt: sub.at, deleted: false, data: sub },
    ]
    const rows = viewRows(records, Date.parse('2026-10-05T12:00:00Z'), 'America/Los_Angeles')
    expect(rows[0]).toEqual(VIEW_HEADER)
    expect(rows.map((r) => r[0])).toEqual(['Name', 'Ada Lindqvist', 'Ben Osei'])
    expect(rows[1]).toEqual(
      expect.arrayContaining(['Submitted', 'Late', 'Fri, Oct 2, 5:00 PM', 'ada@example.com']),
    )
  })
})
