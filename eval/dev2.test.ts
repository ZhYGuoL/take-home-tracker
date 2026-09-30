import { describe, expect, it } from 'vitest'
import { extractWithRules } from '../src/core/extract/rules'
import { HOLDOUT, HOLDOUT_ROSTER } from './holdout'
import { FIELDS, score } from './score'

// holdout.ts was written blind, then used to improve the rules, so it is now a second
// development set that guards against regressions (D14). holdout2.ts measures accuracy.
describe('rules on the second development set', () => {
  const self = { name: 'Jo Park', email: 'jo.park@example.com' }
  const s = score(
    HOLDOUT,
    HOLDOUT.map((c) =>
      extractWithRules(c.paste, {
        now: c.pastedAt,
        zone: c.zone,
        candidates: HOLDOUT_ROSTER,
        self,
      }),
    ),
  )

  it.each(FIELDS)('%s is right on every case', (f) => {
    expect(s.fields[f].correct).toBe(s.fields[f].checked)
  })
})
