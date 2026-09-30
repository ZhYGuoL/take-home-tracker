import type { ExtractContext } from '../src/core/extract/types'
import { ROSTER } from './cases'
import type { Case } from './types'

/** The recruiter in the fictional messages is "Rae Lin". */
export const SELF = { name: 'Rae Lin', email: 'rae@example.com' }

export function contextFor(c: Case): ExtractContext {
  return { now: c.pastedAt, zone: c.zone, candidates: ROSTER, self: SELF }
}
