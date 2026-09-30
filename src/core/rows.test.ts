import { describe, expect, it } from 'vitest'
import type { StoredRecord } from './records'
import { fromRow, HEADER, toRow } from './rows'
import { candidate, message, stage } from './testing/fixtures'

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

  it('skips valid JSON that is not a whole record, so one hand edit cannot blank the app', () => {
    const row = (type: string, data: unknown) => [
      'x-1',
      type,
      '2026-09-30T10:00:00.000Z',
      '',
      JSON.stringify({ ...(data as object), id: 'x-1' }),
    ]
    const e = message(c, '2026-09-30T09:00:00.000Z')
    const { links: _links, ...noLinks } = e
    expect(fromRow(row('entry', noLinks))).toBeNull()
    expect(fromRow(row('entry', { ...e, kind: 'meeting' }))).toBeNull()
    expect(fromRow(row('entry', { ...e, at: 'soon' }))).toBeNull()
    expect(fromRow(row('entry', { ...stage(c, e.at, 'advanced'), stage: 'hired' }))).toBeNull()
    expect(fromRow(row('candidate', { ...c, contacts: 'a@example.com' }))).toBeNull()
    expect(fromRow(row('candidate', { ...c, source: 'fax' }))).toBeNull()
    expect(
      fromRow(row('candidate', { ...c, deadline: { at: 'x', zone: 'Mars/Base', dateOnly: 1 } })),
    ).toBeNull()
    // A whole record still reads.
    expect(fromRow(row('entry', e))).toMatchObject({ data: { ...e, id: 'x-1' } })
  })
})
