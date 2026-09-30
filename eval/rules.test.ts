import { describe, expect, it } from 'vitest'
import { extractWithRules } from '../src/core/extract/rules'
import { CASES } from './cases'
import { contextFor } from './context'
import { FIELDS, ratio, score } from './score'

// The rules were written while reading these cases, so this set guards against regressions.
// It does not measure accuracy. The held-out set in holdout.ts does (D14).
describe('rules on the development set', () => {
  const s = score(
    CASES,
    CASES.map((c) => extractWithRules(c.paste, contextFor(c))),
  )

  it.each(FIELDS.filter((f) => f !== 'direction'))('%s is right on every case', (f) => {
    expect(s.fields[f].correct).toBe(s.fields[f].checked)
  })

  it('direction misses only a bare "yes, that is fine" reply', () => {
    expect(ratio(s.fields.direction)).toBeGreaterThanOrEqual(37 / 38)
    expect(s.cases.filter((c) => c.wrong.includes('direction')).map((c) => c.id)).toEqual([
      'outbound-answer',
    ])
  })
})
