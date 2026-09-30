import { byTime, type Derived } from './derive'
import type { Candidate, Entry, Flag } from './types'

export type Flags = Record<Flag, boolean>

/**
 * True when the candidate's latest message is inbound, is marked as needing a reply,
 * and no reply mark or outbound message comes after it (D7).
 */
export function awaitingReply(candidateId: string, entries: readonly Entry[]): boolean {
  let awaiting = false
  const own = entries.filter((e) => e.candidateId === candidateId).sort(byTime)
  for (const e of own) {
    if (e.kind === 'message') awaiting = e.direction === 'in' && e.needsReply
    else if (e.kind === 'replied') awaiting = false
  }
  return awaiting
}

/** Overdue and Late are exact instants compared as numbers, so zones cannot shift them (D8). */
export function flagsOf(c: Candidate, d: Derived, entries: readonly Entry[], now: number): Flags {
  const due = c.deadline ? Date.parse(c.deadline.at) : null
  const submitted = d.submittedAt ? Date.parse(d.submittedAt) : null
  const closed = d.stage === 'advanced' || d.stage === 'passed'
  return {
    overdue: due !== null && submitted === null && now > due && !closed,
    late: due !== null && submitted !== null && submitted > due,
    needsReply: awaitingReply(c.id, entries),
  }
}

/** "Needs you": a submission waits for review, a reply is due, or the deadline passed (D9). */
export function needsYou(d: Derived, f: Flags): boolean {
  return d.stage === 'submitted' || f.needsReply || f.overdue
}
