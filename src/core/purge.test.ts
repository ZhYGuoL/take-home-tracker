import { describe, expect, it } from 'vitest'
import { purgePlan } from './purge'
import type { StoredRecord } from './records'
import { candidate, message } from './testing/fixtures'
import type { Candidate, Entry } from './types'

const at = (m: number) => new Date(Date.UTC(2026, 8, 30, 10, m)).toISOString()
const live = (data: Candidate | Entry, m: number): StoredRecord =>
  'kind' in data
    ? { id: data.id, type: 'entry', updatedAt: at(m), deleted: false, data }
    : { id: data.id, type: 'candidate', updatedAt: at(m), deleted: false, data }
const gone = (id: string, type: 'candidate' | 'entry', m: number): StoredRecord => ({
  id,
  type,
  updatedAt: at(m),
  deleted: true,
  data: null,
})
const always = () => true

describe('purgePlan', () => {
  it('a deleted candidate keeps only its tombstone, and its entries go', () => {
    const a = candidate({ name: 'Ada Lindqvist' })
    const e = message(a, at(1), { text: 'hello' })
    const rows = [
      live(a, 0),
      live(e, 1),
      live({ ...a, notes: 'strong' }, 2),
      gone(e.id, 'entry', 3),
      gone(a.id, 'candidate', 3),
    ]
    expect(purgePlan(rows, always)).toEqual([0, 1, 2, 3])
  })

  it('an entry moved to another candidate keeps its newest row', () => {
    const a = candidate({ name: 'Wrong Person' })
    const b = candidate({ name: 'Right Person' })
    const e = message(a, at(1), { text: 'my take-home is done' })
    const rows = [
      live(a, 0),
      live(b, 0),
      live(e, 1),
      live({ ...e, candidateId: b.id }, 2),
      gone(a.id, 'candidate', 3),
    ]
    // Only the candidate row of A and the old version of the entry that named A go.
    expect(purgePlan(rows, always)).toEqual([0, 2])
  })

  it('an entry deleted with its candidate goes, found by what its last live version names', () => {
    const a = candidate()
    const e = message(a, at(1))
    const rows = [live(a, 0), live(e, 1), gone(e.id, 'entry', 2), gone(a.id, 'candidate', 2)]
    expect(purgePlan(rows, always)).toEqual([0, 1, 2])
  })

  it('an older edit sent later by another device goes too, and the tombstone stays', () => {
    const a = candidate()
    const rows = [gone(a.id, 'candidate', 5), live({ ...a, notes: 'offline edit' }, 4)]
    expect(purgePlan(rows, always)).toEqual([1])
  })

  it('a candidate edited after an old delete is live, and nothing goes', () => {
    const a = candidate()
    const rows = [gone(a.id, 'candidate', 1), live(a, 2)]
    expect(purgePlan(rows, always)).toEqual([])
  })

  it('does nothing twice: after a purge, the plan is empty', () => {
    const a = candidate()
    const rows = [gone(a.id, 'candidate', 3)]
    expect(purgePlan(rows, always)).toEqual([])
  })

  it('purges only the deleted candidates that are due, and never touches unreadable rows', () => {
    const a = candidate()
    const b = candidate()
    const rows = [
      live(a, 0),
      null,
      live(b, 0),
      gone(a.id, 'candidate', 1),
      gone(b.id, 'candidate', 1),
    ]
    expect(purgePlan(rows, (t) => t.id === a.id)).toEqual([0])
  })
})
