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

describe('without knowing who she is', () => {
  const noSelf = ctx({ self: undefined })

  it('a Gmail copy "to Nadia" is her own message', () => {
    const p = extractWithRules(
      `Rae Lin <rae@example.com>
12:52 PM (8 minutes ago)
to Nadia

Hi Nadia, here is the take-home: https://docs.google.com/document/d/1x/edit
You'll have 48 hours.`,
      noSelf,
    )
    expect(p.direction).toBe('out')
    expect(p.name).toBe('Nadia')
    expect(p.contacts).toEqual([])
    expect(p.deadline?.at).toBe('2026-10-02T19:52:00.000Z')
  })

  it('an Outlook reply does not take contacts from the quoted message under it', () => {
    const p = extractWithRules(
      `Here is my repo: https://github.com/ex-lena/app

Lena

From: Rae Lin <rae@example.com>
Sent: Monday, September 28, 2026 3:00 PM
To: Lena Brandt <lena@example.com>
Subject: Take-home

Hi Lena, here is the take-home.`,
      noSelf,
    )
    expect(p.contacts).toEqual([])
    expect(p.direction).toBe('in')
    expect(p.name).toBe('Lena')
  })
})
