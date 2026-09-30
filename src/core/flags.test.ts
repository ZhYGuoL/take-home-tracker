import { describe, expect, it } from 'vitest'
import { deadlineAt } from './deadline'
import { derive } from './derive'
import { awaitingReply, flagsOf, needsYou } from './flags'
import { candidate, message, opened, replied, stage, submission } from './testing/fixtures'
import type { Candidate, Entry } from './types'

// Deadline: Fri Oct 2 2026, 5:00 PM in New York = 21:00:00.000Z.
const due = deadlineAt('2026-10-02', '17:00', 'America/New_York')
const DUE = Date.parse(due.at)

function flags(c: Candidate, entries: Entry[], now: number) {
  return flagsOf(c, derive(c, entries), entries, now)
}

describe('Late', () => {
  const c = candidate({ deadline: due })

  it('a submission exactly at the deadline is not late', () => {
    expect(flags(c, [submission(c, due.at)], DUE + 1).late).toBe(false)
  })

  it('a submission one millisecond after the deadline is late', () => {
    const at = new Date(DUE + 1).toISOString()
    expect(flags(c, [submission(c, at)], DUE + 2).late).toBe(true)
  })

  it('is the same instant however the submission time was written', () => {
    // 2:30 PM in Los Angeles is 5:30 PM in New York: 30 minutes late.
    const la = '2026-10-02T14:30:00-07:00'
    expect(flags(c, [submission(c, la)], DUE + 3_600_000).late).toBe(true)
    // 1:59 PM in Los Angeles is 4:59 PM in New York: on time.
    expect(flags(c, [submission(c, '2026-10-02T13:59:00-07:00')], DUE).late).toBe(false)
  })

  it('uses the first submission, so a later fix does not make it late', () => {
    const entries = [
      submission(c, '2026-10-02T20:00:00Z'),
      submission(c, '2026-10-03T09:00:00Z', [
        { url: 'https://fix.example.com', kind: 'submission' },
      ]),
    ]
    expect(flags(c, entries, DUE + 86_400_000).late).toBe(false)
  })

  it('is never on without a deadline', () => {
    const open = candidate({ deadline: null })
    expect(flags(open, [submission(open, '2030-01-01T00:00:00Z')], Date.now()).late).toBe(false)
  })

  it('a date-only deadline allows the whole day in its zone', () => {
    const dayOnly = candidate({ deadline: deadlineAt('2026-10-02', null, 'America/Los_Angeles') })
    // 11:59 PM on Oct 2 in Los Angeles is 06:59 UTC on Oct 3.
    const last = '2026-10-03T06:59:59.999Z'
    expect(flags(dayOnly, [submission(dayOnly, last)], Date.parse(last)).late).toBe(false)
    const next = '2026-10-03T07:00:00.000Z'
    expect(flags(dayOnly, [submission(dayOnly, next)], Date.parse(next)).late).toBe(true)
  })
})

describe('Overdue', () => {
  const c = candidate({ deadline: due })

  it('is off exactly at the deadline, and on one millisecond after', () => {
    expect(flags(c, [], DUE).overdue).toBe(false)
    expect(flags(c, [], DUE + 1).overdue).toBe(true)
  })

  it('is off once anything was submitted, even late', () => {
    const late = new Date(DUE + 60_000).toISOString()
    const f = flags(c, [submission(c, late)], DUE + 120_000)
    expect(f.overdue).toBe(false)
    expect(f.late).toBe(true)
  })

  it('is off for an Advanced or Passed candidate', () => {
    for (const s of ['advanced', 'passed'] as const) {
      expect(flags(c, [stage(c, '2026-10-01T00:00:00Z', s)], DUE + 1).overdue).toBe(false)
    }
  })

  it('does not depend on the viewer: the instant is the same everywhere', () => {
    // 5:00:01 PM in New York is 2:00:01 PM in Los Angeles and 22:00:01 in London.
    expect(flags(c, [], Date.parse('2026-10-02T14:00:01-07:00')).overdue).toBe(true)
    expect(flags(c, [], Date.parse('2026-10-02T21:59:59+01:00')).overdue).toBe(false)
  })

  it('is never on without a deadline', () => {
    expect(flags(candidate(), [], Date.parse('2099-01-01T00:00:00Z')).overdue).toBe(false)
  })
})

describe('Needs reply', () => {
  const c = candidate()
  const ask = (at: string) => message(c, at, { text: 'can I use Postgres?', needsReply: true })

  it('is on when her latest inbound message asks for a reply', () => {
    expect(awaitingReply(c.id, [ask('2026-10-01T10:00:00Z')])).toBe(true)
  })

  it('a reply mark after it clears it', () => {
    expect(
      awaitingReply(c.id, [ask('2026-10-01T10:00:00Z'), replied(c, '2026-10-01T11:00:00Z')]),
    ).toBe(false)
  })

  it('an outbound message after it clears it', () => {
    const out = message(c, '2026-10-01T11:00:00Z', { direction: 'out', text: 'yes' })
    expect(awaitingReply(c.id, [ask('2026-10-01T10:00:00Z'), out])).toBe(false)
  })

  it('a new question after her reply turns it back on', () => {
    const entries = [
      ask('2026-10-01T10:00:00Z'),
      replied(c, '2026-10-01T11:00:00Z'),
      ask('2026-10-01T12:00:00Z'),
    ]
    expect(awaitingReply(c.id, entries)).toBe(true)
  })

  it('a later inbound message that needs nothing clears it', () => {
    const fyi = message(c, '2026-10-01T12:00:00Z', { text: 'never mind, figured it out' })
    expect(awaitingReply(c.id, [ask('2026-10-01T10:00:00Z'), fyi])).toBe(false)
  })

  it('stage changes and opening the submission do not clear it', () => {
    const entries = [ask('2026-10-01T10:00:00Z'), opened(c, '2026-10-01T11:00:00Z')]
    expect(awaitingReply(c.id, entries)).toBe(true)
  })
})

describe('needsYou', () => {
  const now = DUE + 1
  const cases: Array<[string, (c: Candidate) => Entry[], boolean]> = [
    ['Sent, deadline ahead', () => [], false],
    ['Submitted and not opened', (c) => [submission(c, '2026-10-02T12:00:00Z')], true],
    [
      'Reviewing',
      (c) => [submission(c, '2026-10-02T12:00:00Z'), opened(c, '2026-10-02T13:00:00Z')],
      false,
    ],
    [
      'Reviewing with a question waiting',
      (c) => [
        submission(c, '2026-10-02T12:00:00Z'),
        opened(c, '2026-10-02T13:00:00Z'),
        message(c, '2026-10-02T14:00:00Z', { needsReply: true }),
      ],
      true,
    ],
    ['Advanced', (c) => [stage(c, '2026-10-02T12:00:00Z', 'advanced')], false],
    [
      'Passed with a question waiting',
      (c) => [
        stage(c, '2026-10-02T12:00:00Z', 'passed'),
        message(c, '2026-10-02T13:00:00Z', { needsReply: true }),
      ],
      true,
    ],
  ]

  for (const [name, make, expected] of cases) {
    it(`${name}: ${expected ? 'shows' : 'hidden'}`, () => {
      const c = candidate({ deadline: deadlineAt('2026-10-09', '17:00', 'America/New_York') })
      const entries = make(c)
      const d = derive(c, entries)
      expect(needsYou(d, flagsOf(c, d, entries, now))).toBe(expected)
    })
  }

  it('Overdue shows', () => {
    const c = candidate({ deadline: due })
    const d = derive(c, [])
    expect(needsYou(d, flagsOf(c, d, [], now))).toBe(true)
  })
})
