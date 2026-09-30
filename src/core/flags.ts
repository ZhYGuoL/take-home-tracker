import type { Derived } from './derive'
import type { Candidate, Flag } from './types'

export type Flags = Record<Flag, boolean>

/**
 * Overdue and Late are exact instants compared as numbers, so zones cannot shift them (D8).
 * Overdue needs the stage to still be Sent: once work came in, by link or by her hand, the
 * candidate is no longer overdue.
 */
export function flagsOf(c: Candidate, d: Derived, now: number): Flags {
  const due = c.deadline ? Date.parse(c.deadline.at) : null
  const submitted = d.submittedAt ? Date.parse(d.submittedAt) : null
  return {
    overdue: due !== null && d.stage === 'sent' && now > due,
    late: due !== null && submitted !== null && submitted > due,
    needsReply: d.waitingSince !== null,
  }
}

/** "Needs you": a submission waits for review, a reply is due, or the deadline passed (D9). */
export function needsYou(d: Derived, f: Flags): boolean {
  return d.stage === 'submitted' || f.needsReply || f.overdue
}
