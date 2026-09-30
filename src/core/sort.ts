import type { FactRow, View } from './filters'

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY)

function urgency(r: FactRow): [number, number] {
  if (r.flags.overdue) return [0, time(r.candidate.deadline?.at)]
  if (r.flags.needsReply) return [1, time(r.derived.waitingSince)]
  if (r.derived.stage === 'submitted') return [2, time(r.derived.submittedAt)]
  return [3, -time(r.derived.lastActivityAt)]
}

/**
 * "Needs you": overdue first (longest overdue on top), then waiting replies (oldest on top),
 * then submissions waiting for review (oldest on top). "All": latest activity on top.
 */
export function sortRows<R extends FactRow>(rows: readonly R[], view: View): R[] {
  const out = [...rows]
  const byId = (a: R, b: R) => (a.candidate.id < b.candidate.id ? -1 : 1)
  if (view === 'needs') {
    return out.sort((a, b) => {
      const [ra, ta] = urgency(a)
      const [rb, tb] = urgency(b)
      return ra - rb || ta - tb || byId(a, b)
    })
  }
  return out.sort(
    (a, b) => time(b.derived.lastActivityAt) - time(a.derived.lastActivityAt) || byId(a, b),
  )
}
