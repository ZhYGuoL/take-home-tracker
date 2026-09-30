import { describe, expect, it } from 'vitest'
import { live, mergeRecords, type StoredRecord } from './records'
import { candidate, submission } from './testing/fixtures'

function cand(name: string, updatedAt: string, deleted = false): StoredRecord {
  return { id: 'c-1', type: 'candidate', updatedAt, deleted, data: candidate({ id: 'c-1', name }) }
}

describe('mergeRecords', () => {
  it('the newer save wins, in either arrival order', () => {
    const older = cand('Old name', '2026-09-30T10:00:00Z')
    const newer = cand('New name', '2026-09-30T10:00:01Z')
    const a = mergeRecords(new Map(), [older, newer])
    const b = mergeRecords(new Map(), [newer, older])
    expect(a.get('c-1')?.data).toMatchObject({ name: 'New name' })
    expect(b.get('c-1')?.data).toMatchObject({ name: 'New name' })
  })

  it('a tie resolves the same way on every device', () => {
    const x = cand('Xavier', '2026-09-30T10:00:00Z')
    const y = cand('Yara', '2026-09-30T10:00:00Z')
    const a = mergeRecords(new Map(), [x, y]).get('c-1')
    const b = mergeRecords(new Map(), [y, x]).get('c-1')
    expect(a).toEqual(b)
  })

  it('does not change the base map', () => {
    const base = mergeRecords(new Map(), [cand('A', '2026-09-30T10:00:00Z')])
    mergeRecords(base, [cand('B', '2026-09-30T11:00:00Z')])
    expect(base.get('c-1')?.data).toMatchObject({ name: 'A' })
  })
})

describe('live', () => {
  it('drops deleted records and the entries of deleted candidates', () => {
    const kept = candidate()
    const gone = candidate()
    const records: StoredRecord[] = [
      {
        id: kept.id,
        type: 'candidate',
        updatedAt: '2026-09-30T10:00:00Z',
        deleted: false,
        data: kept,
      },
      {
        id: gone.id,
        type: 'candidate',
        updatedAt: '2026-09-30T10:00:00Z',
        deleted: true,
        data: gone,
      },
    ]
    for (const c of [kept, gone]) {
      const e = submission(c, '2026-09-30T10:00:00Z')
      records.push({ id: e.id, type: 'entry', updatedAt: e.at, deleted: false, data: e })
    }
    const out = live(records)
    expect(out.candidates.map((c) => c.id)).toEqual([kept.id])
    expect(out.entries.map((e) => e.candidateId)).toEqual([kept.id])
  })
})
