import { describe, expect, it } from 'vitest'
import { extractWithRules } from './rules'
import type { ExtractContext } from './types'

const ctx = (over: Partial<ExtractContext> = {}): ExtractContext => ({
  now: '2026-09-30T20:00:00.000Z', // Wed 1:00 PM PDT
  zone: 'America/Los_Angeles',
  candidates: [],
  self: { name: 'Rae Lin', email: 'rae@example.com' },
  ...over,
})

describe('extractWithRules', () => {
  it('counts "48 hours" from when she sent the message, not from the paste', () => {
    const p = extractWithRules(
      `From: Rae Lin <rae@example.com>
Sent: Monday, September 28, 2026 3:00 PM
To: Nadia Farouk <nadia@example.com>
Subject: Take-home

Hi Nadia, here is the take-home. You'll have 48 hours.`,
      ctx(),
    )
    expect(p.direction).toBe('out')
    expect(p.deadline?.at).toBe('2026-09-30T22:00:00.000Z')
    expect(p.name).toBe('Nadia Farouk')
    expect(p.contacts).toEqual(['nadia@example.com'])
  })
})
