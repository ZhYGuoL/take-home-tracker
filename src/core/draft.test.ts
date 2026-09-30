import { describe, expect, it } from 'vitest'
import {
  type CandidateDraft,
  candidateFromDraft,
  draftFromCandidate,
  emptyDraft,
  submissionFromDraft,
  validateDraft,
  whenProblem,
} from './draft'

const LA = 'America/Los_Angeles'
const now = Date.parse('2026-09-30T17:05:00Z') // 10:05 PDT
const base = { id: 'c-1', createdAt: '2026-09-30T17:05:00.000Z' }

function draft(overrides: Partial<CandidateDraft> = {}): CandidateDraft {
  return { ...emptyDraft(LA, now), name: 'Rowan Okafor', ...overrides }
}

describe('emptyDraft', () => {
  it('starts with the take-home sent now, in her zone', () => {
    const d = emptyDraft(LA, now)
    expect([d.sentDate, d.sentTime, d.dueZone]).toEqual(['2026-09-30', '10:05', LA])
  })
})

const check = (d: CandidateDraft) => validateDraft(d, { zone: LA, now })

describe('validateDraft', () => {
  it('needs a name', () => {
    expect(check(draft({ name: '  ' })).name).toBe('Required')
  })

  it('rejects a link that is not a web link', () => {
    expect(check(draft({ submissionUrl: 'see message' })).submissionUrl).toBe('Not a web link')
  })

  it('needs the time of a submission, because the time decides Late', () => {
    expect(check(draft({ submittedDate: '2026-10-01' })).submittedTime).toBe('Time needed')
  })

  it('refuses a submission later than now, and a sent date after today', () => {
    expect(
      check(draft({ submittedDate: '2026-09-30', submittedTime: '11:00' })).submittedDate,
    ).toBe('Later than now')
    expect(check(draft({ sentDate: '2026-10-01', sentTime: '' })).sentDate).toBe('Later than now')
    // A sent date of today with no time is fine, even in the morning.
    expect(check(draft({ sentDate: '2026-09-30', sentTime: '' })).sentDate).toBeUndefined()
  })

  it('accepts a complete draft', () => {
    expect(check(draft({ takeHomeUrl: 'docs.example.com/d/abc' }))).toEqual({})
  })
})

describe('candidateFromDraft', () => {
  it('a sent date with no time is noon, or now when noon is still ahead today', () => {
    // It is 10:05 in Los Angeles.
    const today = candidateFromDraft(draft({ sentDate: '2026-09-30', sentTime: '' }), LA, base, now)
    expect(today.sentAt).toBe('2026-09-30T17:05:00.000Z')
    const earlier = candidateFromDraft(
      draft({ sentDate: '2026-09-28', sentTime: '' }),
      LA,
      base,
      now,
    )
    expect(earlier.sentAt).toBe('2026-09-28T19:00:00.000Z')
  })

  it('reads the deadline in its own zone, not her zone', () => {
    const c = candidateFromDraft(
      draft({ dueDate: '2026-10-02', dueTime: '17:00', dueZone: 'America/New_York' }),
      LA,
      base,
    )
    expect(c.deadline).toEqual({
      at: '2026-10-02T21:00:00.000Z',
      zone: 'America/New_York',
      dateOnly: false,
    })
  })

  it('a deadline date with no time is the end of that day', () => {
    const c = candidateFromDraft(draft({ dueDate: '2026-10-02' }), LA, base)
    expect(c.deadline?.dateOnly).toBe(true)
  })

  it('normalizes links and contacts', () => {
    const c = candidateFromDraft(
      draft({
        takeHomeUrl: 'docs.example.com/d/abc',
        contacts: 'Rowan@Example.com, (555) 010-0142',
      }),
      LA,
      base,
    )
    expect(c.takeHomeUrl).toBe('https://docs.example.com/d/abc')
    expect(c.contacts).toEqual(['rowan@example.com', '+15550100142'])
  })

  it('round-trips through draftFromCandidate', () => {
    const d = draft({
      role: 'Founding engineer',
      dueDate: '2026-10-02',
      dueTime: '17:00',
      dueZone: 'America/New_York',
      notes: 'strong systems background',
    })
    const c = candidateFromDraft(d, LA, base)
    const again = candidateFromDraft(draftFromCandidate(c, LA), LA, base)
    expect(again).toEqual(c)
  })
})

describe('editing keeps exact instants the form did not change', () => {
  // 1:30 AM on Sun Nov 1 2026 happens twice in Los Angeles. This is the second, PST, one.
  const secondOneThirty = { at: '2026-11-01T09:30:00.000Z', zone: LA, dateOnly: false }

  it('a name edit keeps a deadline in the repeated hour', () => {
    const saved = { ...candidateFromDraft(draft(), LA, base), deadline: secondOneThirty }
    const edited = candidateFromDraft(
      { ...draftFromCandidate(saved, LA), name: 'Rowan O.' },
      LA,
      saved,
    )
    expect(edited.deadline).toEqual(secondOneThirty)
    expect(edited.name).toBe('Rowan O.')
  })

  it('a changed deadline time is read again', () => {
    const saved = { ...candidateFromDraft(draft(), LA, base), deadline: secondOneThirty }
    const edited = candidateFromDraft(
      { ...draftFromCandidate(saved, LA), dueTime: '09:00' },
      LA,
      saved,
    )
    expect(edited.deadline?.at).toBe('2026-11-01T17:00:00.000Z')
  })
})

describe('submissionFromDraft', () => {
  const c = candidateFromDraft(draft(), LA, base)

  it('makes no entry without a link', () => {
    expect(submissionFromDraft(draft(), LA, c, 'e-1', now)).toBeNull()
  })

  it('makes an inbound message with the submission and repo links', () => {
    const e = submissionFromDraft(
      draft({
        submissionUrl: 'rowan-pantry.example.com',
        repoUrl: 'github.com/example-rowan/pantry',
        submittedDate: '2026-10-01',
        submittedTime: '09:30',
      }),
      LA,
      c,
      'e-1',
      now,
    )
    expect(e).toMatchObject({
      direction: 'in',
      at: '2026-10-01T16:30:00.000Z',
      links: [
        { url: 'https://rowan-pantry.example.com/', kind: 'submission' },
        { url: 'https://github.com/example-rowan/pantry', kind: 'repo' },
      ],
    })
  })

  it('uses now when the submission has no date', () => {
    const e = submissionFromDraft(draft({ submissionUrl: 'x.example.com' }), LA, c, 'e-1', now)
    expect(e?.at).toBe(new Date(now).toISOString())
  })
})

describe('whenProblem', () => {
  it('names what is missing, or a time later than now, with a minute of slack', () => {
    expect(whenProblem('', '09:00', LA, now)).toBe('Date needed')
    expect(whenProblem('2026-09-30', '', LA, now)).toBe('Time needed')
    expect(whenProblem('2026-09-30', '10:06', LA, now)).toBeNull()
    expect(whenProblem('2026-09-30', '10:07', LA, now)).toBe('Later than now')
    expect(whenProblem('2026-09-29', '23:00', LA, now)).toBeNull()
  })
})
