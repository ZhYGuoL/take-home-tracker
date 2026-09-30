import type { StoredRecord } from './records'

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
  try {
    const parsed = JSON.parse(data ?? '') as { id?: unknown }
    if (!parsed || typeof parsed !== 'object' || parsed.id !== id) return null
    return type === 'candidate'
      ? { id, type, updatedAt, deleted: false, data: parsed as never }
      : { id, type, updatedAt, deleted: false, data: parsed as never }
  } catch {
    return null
  }
}
