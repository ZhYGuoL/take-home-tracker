import { describe, expect, it } from 'vitest'
import type { StoredRecord } from './records'
import { fromRow, HEADER, toRow } from './rows'
import { candidate } from './testing/fixtures'

const c = candidate({ id: 'c-1', name: 'Rowan Okafor' })
const live: StoredRecord = {
  id: 'c-1',
  type: 'candidate',
  updatedAt: '2026-09-30T10:00:00.000Z',
  deleted: false,
  data: c,
}

describe('rows', () => {
  it('round-trips a record', () => {
    expect(fromRow(toRow(live))).toEqual(live)
  })

  it('a deleted record keeps no data in its row', () => {
    const row = toRow({
      id: 'c-1',
      type: 'candidate',
      updatedAt: '2026-09-30T10:00:00.000Z',
      deleted: true,
      data: null,
    })
    expect(row).toEqual(['c-1', 'candidate', '2026-09-30T10:00:00.000Z', '1', ''])
    expect(fromRow(row)).toMatchObject({ deleted: true, data: null })
  })

  it('skips the header, empty rows, and rows edited into something else', () => {
    expect(fromRow(HEADER)).toBeNull()
    expect(fromRow([])).toBeNull()
    expect(fromRow(['c-1', 'person', '2026-09-30T10:00:00.000Z', '', '{}'])).toBeNull()
    expect(fromRow(['c-1', 'candidate', 'yesterday', '', JSON.stringify(c)])).toBeNull()
    expect(fromRow(['c-1', 'candidate', '2026-09-30T10:00:00.000Z', '', '{not json'])).toBeNull()
    // The data must belong to the row's id.
    expect(
      fromRow(['c-2', 'candidate', '2026-09-30T10:00:00.000Z', '', JSON.stringify(c)]),
    ).toBeNull()
  })
})
