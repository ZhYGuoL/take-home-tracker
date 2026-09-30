import type { Candidate, Entry } from './types'

export type StoredRecord =
  | { id: string; type: 'candidate'; updatedAt: string; deleted: false; data: Candidate }
  | { id: string; type: 'entry'; updatedAt: string; deleted: false; data: Entry }
  | Tombstone

/** A deleted record keeps only its id and type, so no personal data stays behind (D3). */
export interface Tombstone {
  id: string
  type: 'candidate' | 'entry'
  updatedAt: string
  deleted: true
  data: null
}

/** True when `b` replaces `a`: newer wins, and a tie resolves the same way on every device (D3). */
export function replaces(a: StoredRecord, b: StoredRecord): boolean {
  const d = Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  if (d !== 0) return d > 0
  return JSON.stringify(b) > JSON.stringify(a)
}

export function mergeRecords(
  base: ReadonlyMap<string, StoredRecord>,
  incoming: Iterable<StoredRecord>,
): Map<string, StoredRecord> {
  const out = new Map(base)
  for (const r of incoming) {
    const cur = out.get(r.id)
    if (!cur || replaces(cur, r)) out.set(r.id, r)
  }
  return out
}

export interface Live {
  candidates: Candidate[]
  entries: Entry[]
}

/** The records that are not deleted. Entries of a deleted candidate go with it. */
export function live(records: Iterable<StoredRecord>): Live {
  const candidates: Candidate[] = []
  const entries: Entry[] = []
  for (const r of records) {
    if (r.deleted) continue
    if (r.type === 'candidate') candidates.push(r.data)
    else entries.push(r.data)
  }
  const ids = new Set(candidates.map((c) => c.id))
  return { candidates, entries: entries.filter((e) => ids.has(e.candidateId)) }
}
