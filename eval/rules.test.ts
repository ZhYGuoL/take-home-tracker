import { describe, expect, it } from 'vitest'
import { extractWithRules } from '../src/core/extract/rules'
import { CASES } from './cases'
import { contextFor } from './context'
import { FIELDS, type Field, score } from './score'

// The rules were written while reading these cases, so this set guards against regressions.
// It does not measure accuracy. The blind set in holdout2.ts does (D14).
// Floors: correct cases out of 38 per field, as of the strict scorer. A drop fails the build.
const FLOOR: Record<Field, number> = {
  name: 38,
  contacts: 38,
  role: 38,
  source: 36,
  direction: 37,
  messageAt: 38,
  links: 38,
  deadline: 38,
  needsReply: 38,
  // First-name-only cases are suggested first but never attach by default.
  match: 35,
  suggest: 38,
}

describe('rules on the first development set', () => {
  const s = score(
    CASES,
    CASES.map((c) => extractWithRules(c.paste, contextFor(c))),
  )

  it.each(FIELDS)('%s does not drop below its floor', (f) => {
    expect(s.fields[f].correct).toBeGreaterThanOrEqual(FLOOR[f])
  })
})
