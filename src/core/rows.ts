import type { StoredRecord } from './records'
import { isCandidate, isEntry } from './shape'

/** The first row of the `records` tab (D3). */
export const HEADER = ['id', 'type', 'updated_at', 'deleted', 'data']

export function toRow(r: StoredRecord): string[] {
  return [r.id, r.type, r.updatedAt, r.deleted ? '1' : '', r.deleted ? '' : JSON.stringify(r.data)]
}

/**
 * A record from a row, or null when the row is not one: the header, an empty row, or a row
 * she edited by hand into a shape the app cannot read. A bad row never stops the others.
 */
export function fromRow(row: readonly unknown[]): StoredRecord | null {
  const [id, type, updatedAt, deleted, data] = row.map((v) => (v === undefined ? '' : String(v)))
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
