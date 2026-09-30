import { replaces, type StoredRecord, type Tombstone } from './records'

type LiveEntry = Extract<StoredRecord, { type: 'entry'; deleted: false }>

const newest = <T extends StoredRecord>(rows: T[]): T =>
  rows.reduce((a, b) => (replaces(a, b) ? b : a))

/**
 * The rows to delete from her Sheet so that a deleted candidate leaves no data behind (D3).
 * `rows` are the rows under the header, in Sheet order. `null` is a row the app cannot read,
 * and it is never deleted. `due` picks the deleted candidates to purge now.
 *
 * - A deleted candidate keeps one row, its newest tombstone. It has no data, and it stops an
 *   older edit from another device from bringing the candidate back.
 * - An entry whose newest version names a deleted candidate loses every row. So does an entry
 *   deleted with its candidate, found by the candidate its last live version names.
 * - An entry that moved on to another candidate keeps its newest row. Only its older rows that
 *   name the deleted candidate go.
 *
 * Returns 0-based indexes into `rows`.
 */
export function purgePlan(
  rows: ReadonlyArray<StoredRecord | null>,
  due: (t: Tombstone) => boolean,
): number[] {
  const byId = new Map<string, Array<{ r: StoredRecord; i: number }>>()
  rows.forEach((r, i) => {
    if (r) byId.set(r.id, [...(byId.get(r.id) ?? []), { r, i }])
  })

  const doomed = new Set<string>()
  for (const [id, group] of byId) {
    const top = newest(group.map((g) => g.r))
    if (top.type === 'candidate' && top.deleted && due(top)) doomed.add(id)
  }
  if (doomed.size === 0) return []

  const out: number[] = []
  for (const [id, group] of byId) {
    const top = newest(group.map((g) => g.r))
    if (top.type === 'candidate') {
      if (doomed.has(id)) out.push(...group.filter((g) => g.r !== top).map((g) => g.i))
      continue
    }
    const liveRows = group.flatMap((g): LiveEntry[] =>
      g.r.type === 'entry' && !g.r.deleted ? [g.r] : [],
    )
    const last = liveRows.length > 0 ? newest(liveRows) : null
    const owner = top.deleted ? last?.data.candidateId : top.data.candidateId
    if (owner !== undefined && doomed.has(owner)) {
      out.push(...group.map((g) => g.i))
      continue
    }
    for (const g of group) {
      if (g.r !== top && g.r.type === 'entry' && !g.r.deleted && doomed.has(g.r.data.candidateId)) {
        out.push(g.i)
      }
    }
  }
  return out.sort((a, b) => a - b)
}
