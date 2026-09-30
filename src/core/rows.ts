import type { StoredRecord } from './records'
import { isCandidate, isEntry } from './shape'

/** The first row of the `records` tab (D3). */
export const HEADER = ['id', 'type', 'updated_at', 'deleted', 'data']

/**
 * A Sheets cell holds at most 50,000 characters. Longer data goes on in the next cells, from
 * column E up to Z, so a long message or long notes never make a row that Sheets refuses (D3).
 */
const CELL = 45_000
export const DATA_CELLS = 22

export function toRow(r: StoredRecord): string[] {
  const head = [r.id, r.type, r.updatedAt, r.deleted ? '1' : '']
  if (r.deleted) return [...head, '']
  const json = JSON.stringify(r.data)
  const cells: string[] = []
  for (let i = 0; i < json.length; i += CELL) cells.push(json.slice(i, i + CELL))
  return [...head, ...(cells.length > 0 ? cells : [''])]
}

/**
 * A record from a row, or null when the row is not one: the header, an empty row, or a row
 * she edited by hand into a shape the app cannot read. A bad row never stops the others.
 */
export function fromRow(row: readonly unknown[]): StoredRecord | null {
  const cells = row.map((v) => (v === undefined || v === null ? '' : String(v)))
  const [id, type, updatedAt, deleted] = cells
  const data = cells.slice(4).join('')
  if (!id || id === 'id' || (type !== 'candidate' && type !== 'entry')) return null
  if (!updatedAt || Number.isNaN(Date.parse(updatedAt))) return null
  if (deleted === '1') return { id, type, updatedAt, deleted: true, data: null }
  let parsed: unknown
  try {
    parsed = JSON.parse(data ?? '')
  } catch {
    return null
  }
  // Valid JSON is not enough: a row with a missing field would break every screen.
  if (type === 'candidate') {
    return isCandidate(parsed) && parsed.id === id
      ? { id, type, updatedAt, deleted: false, data: parsed }
      : null
  }
  return isEntry(parsed) && parsed.id === id
    ? { id, type, updatedAt, deleted: false, data: parsed }
    : null
}
