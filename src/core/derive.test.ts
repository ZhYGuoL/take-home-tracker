import { describe, expect, it } from 'vitest'
import { derive } from './derive'
import {
  candidate,
  message,
  opened,
  replied,
  repoLink,
  stage,
  submission,
} from './testing/fixtures'
import { STAGES } from './types'

describe('derive: stage', () => {
  it('a new candidate is Sent', () => {
    const c = candidate()
    expect(derive(c, []).stage).toBe('sent')
  })

  it('a submission link moves Sent to Submitted', () => {
    const c = candidate()
    const d = derive(c, [submission(c, '2026-09-29T18:00:00Z')])
    expect(d.stage).toBe('submitted')
    expect(d.submittedAt).toBe('2026-09-29T18:00:00Z')
  })

  it('a repo link alone also counts as a submission', () => {
    const c = candidate()
    expect(derive(c, [submission(c, '2026-09-29T18:00:00Z', [repoLink])]).stage).toBe('submitted')
  })

  it('a message without a submission link does not change the stage', () => {
    const c = candidate()
    const e = message(c, '2026-09-29T18:00:00Z', {
      text: 'quick question',
      links: [{ url: 'https://docs.example.com/api', kind: 'other' }],
    })
    expect(derive(c, [e]).stage).toBe('sent')
  })

  it('an outbound message with a link is not a submission', () => {
    const c = candidate()
    const e = message(c, '2026-09-29T18:00:00Z', { direction: 'out', links: [repoLink] })
    expect(derive(c, [e]).submittedAt).toBeNull()
  })

  it('opening the submission moves Submitted to Reviewing', () => {
    const c = candidate()
    const d = derive(c, [submission(c, '2026-09-29T18:00:00Z'), opened(c, '2026-09-29T19:00:00Z')])
    expect(d.stage).toBe('reviewing')
  })

  it('opening before any submission does not skip to Reviewing', () => {
    const c = candidate()
    expect(derive(c, [opened(c, '2026-09-29T19:00:00Z')]).stage).toBe('sent')
  })

  it('her click sets any stage, including an earlier one', () => {
    const c = candidate()
    const entries = [
      submission(c, '2026-09-29T18:00:00Z'),
      stage(c, '2026-09-29T19:00:00Z', 'sent'),
    ]
    expect(derive(c, entries).stage).toBe('sent')
  })

  it('uses the first submission time even after a later fix', () => {
    const c = candidate()
    const d = derive(c, [
      submission(c, '2026-09-30T10:00:00Z'),
      submission(c, '2026-09-29T18:00:00Z', [
        { url: 'https://v1.example.com', kind: 'submission' },
      ]),
    ])
    expect(d.submittedAt).toBe('2026-09-29T18:00:00Z')
    expect(d.submission?.url).toBe('https://rowan-pantry.example.com')
  })

  it('ignores entries that belong to another candidate', () => {
    const a = candidate()
    const b = candidate()
    expect(derive(a, [submission(b, '2026-09-29T18:00:00Z')]).stage).toBe('sent')
  })

  it('last activity is the newest entry, or creation when there are none', () => {
    const c = candidate()
    expect(derive(c, []).lastActivityAt).toBe(c.createdAt)
    expect(derive(c, [submission(c, '2026-09-29T18:00:00Z')]).lastActivityAt).toBe(
      '2026-09-29T18:00:00Z',
    )
  })

  it('last activity is what happened, not when she added the candidate', () => {
    // Added today, from a message that came in yesterday.
    const c = candidate({ createdAt: '2026-09-30T12:00:00Z', sentAt: null })
    expect(derive(c, [submission(c, '2026-09-29T13:02:00Z')]).lastActivityAt).toBe(
      '2026-09-29T13:02:00Z',
    )
    // Added today, for a take-home she sent two days ago.
    const sent = candidate({ createdAt: '2026-09-30T12:00:00Z', sentAt: '2026-09-28T16:00:00Z' })
    expect(derive(sent, []).lastActivityAt).toBe('2026-09-28T16:00:00Z')
  })
})

describe('derive: Advanced and Passed come only from her click', () => {
  for (const closed of ['advanced', 'passed'] as const) {
    it(`a submission after ${closed} leaves it ${closed}`, () => {
      const c = candidate()
      const d = derive(c, [
        stage(c, '2026-09-29T10:00:00Z', closed),
        submission(c, '2026-09-29T11:00:00Z'),
        opened(c, '2026-09-29T12:00:00Z'),
      ])
      expect(d.stage).toBe(closed)
    })
  }

  it('no sequence of automatic entries reaches Advanced or Passed', () => {
    const c = candidate()
    const autos = [
      submission(c, '2026-09-29T10:00:00Z'),
      opened(c, '2026-09-29T11:00:00Z'),
      submission(c, '2026-09-29T12:00:00Z', [repoLink]),
      opened(c, '2026-09-29T13:00:00Z'),
      message(c, '2026-09-29T14:00:00Z', { text: 'you are advanced to the next round' }),
    ]
    for (let n = 0; n <= autos.length; n++) {
      const stageNow = derive(c, autos.slice(0, n)).stage
      expect(['sent', 'submitted', 'reviewing']).toContain(stageNow)
    }
  })

  it('no random mix of messages, links, opens, and replies reaches Advanced or Passed', () => {
    // A small seeded generator, so a failure repeats.
    let seed = 42
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31
      return seed / 2 ** 31
    }
    const kinds = ['submission', 'repo', 'question', 'out', 'opened', 'replied'] as const
    for (let run = 0; run < 500; run++) {
      const c = candidate()
      const entries = Array.from({ length: 1 + Math.floor(rand() * 12) }, (_, i) => {
        const at = new Date(
          Date.parse('2026-09-29T00:00:00Z') + Math.floor(rand() * 5e8) + i,
        ).toISOString()
        switch (kinds[Math.floor(rand() * kinds.length)]) {
          case 'submission':
            return submission(c, at)
          case 'repo':
            return submission(c, at, [repoLink])
          case 'question':
            return message(c, at, { text: 'you are advanced? passed?', needsReply: true })
          case 'out':
            return message(c, at, { direction: 'out', text: 'Advanced' })
          case 'opened':
            return opened(c, at)
          default:
            return replied(c, at)
        }
      })
      expect(['sent', 'submitted', 'reviewing']).toContain(derive(c, entries).stage)
    }
  })

  it('every stage is reachable by her click', () => {
    const c = candidate()
    for (const s of STAGES) {
      expect(derive(c, [stage(c, '2026-09-29T10:00:00Z', s)]).stage).toBe(s)
    }
  })
})
