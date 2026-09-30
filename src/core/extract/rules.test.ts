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

describe('a name line, then a time line, as a copied chat shows them', () => {
  const priya = { id: 'c-p', name: 'Priya Raman', role: '', contacts: [], links: [] }

  it('reads the sender and the time, and attaches to the candidate with that full name', () => {
    const p = extractWithRules(
      'Priya Raman\nToday 9:14 AM\nHi Rae! My take-home is done: https://priya-ledger.example.com',
      ctx({ candidates: [priya] }),
    )
    expect(p.name).toBe('Priya Raman')
    expect(p.messageAt).toBe('2026-09-30T16:14:00.000Z')
    expect(p.match).toMatchObject({ id: 'c-p', strength: 'strong' })
  })

  it('reads a long time line, with the weekday and month spelled out', () => {
    const p = extractWithRules(
      'Priya Raman\nWednesday, September 30, 2026 at 11:42 AM\nall done',
      ctx(),
    )
    expect(p.messageAt).toBe('2026-09-30T18:42:00.000Z')
  })

  it('reads a time line with a date too', () => {
    const p = extractWithRules('Priya Raman\nFri, Sep 25, 9:14 AM\nhey Rae! all done', ctx())
    expect(p.name).toBe('Priya Raman')
    expect(p.messageAt).toBe('2026-09-25T16:14:00.000Z')
  })

  it('does not take a subject line or a sentence for a name or a time', () => {
    const subject = extractWithRules(
      'Take Home Submission\nSep 30, 2026, 9:14 AM\nHere it is.',
      ctx(),
    )
    expect(subject.name).toBeNull()
    const sentence = extractWithRules(
      'Priya Raman\nCan we move our call to Oct 2 at 3:00 PM instead?',
      ctx(),
    )
    expect(sentence.messageAt).toBeNull()
  })

  it('her own name on top makes it her message, to the person she greets', () => {
    const p = extractWithRules(
      'Rae Lin\nToday 9:14 AM\nHi Omar, here is the take-home. You have 48 hours.',
      ctx(),
    )
    expect(p.direction).toBe('out')
    expect(p.name).toBe('Omar')
    expect(p.deadline?.at).toBe('2026-10-02T16:14:00.000Z')
  })
})
