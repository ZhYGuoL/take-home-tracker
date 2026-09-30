import { describe, expect, it } from 'vitest'
import { parseClock, parseDeadline, parseStamp } from './when'

const LA = 'America/Los_Angeles'
const NOW = '2026-09-30T20:00:00.000Z' // Wed Sep 30, 1:00 PM PDT

describe('parseStamp', () => {
  it.each([
    ['Wed, Sep 30, 2026 at 11:42 AM', '2026-09-30T18:42:00.000Z'],
    ['Tuesday, September 29, 2026 9:05 PM', '2026-09-30T04:05:00.000Z'],
    ['Thu, Oct 1, 2026 at 2:05 AM EDT', '2026-10-01T06:05:00.000Z'],
    ['9/30/26, 11:16 AM', '2026-09-30T18:16:00.000Z'],
    ['Oct 2, 2026, 12:00 PM', '2026-10-02T19:00:00.000Z'],
  ])('%s', (text, iso) => {
    expect(parseStamp(text, LA)).toBe(iso)
  })

  it('reads 12 AM as midnight', () => {
    expect(parseStamp('Oct 2, 2026 at 12:30 AM', LA)).toBe('2026-10-02T07:30:00.000Z')
  })
})

describe('parseClock', () => {
  it('a time earlier today is today', () => {
    expect(parseClock(' 12:14 PM ', NOW, LA)).toBe('2026-09-30T19:14:00.000Z')
  })

  it('a time later than the paste is yesterday', () => {
    expect(parseClock(' 3:04 PM ', NOW, LA)).toBe('2026-09-29T22:04:00.000Z')
  })
})

describe('parseDeadline', () => {
  it.each([
    ['You have 48 hours from now.', '2026-10-02T20:00:00.000Z'],
    ["You'll have 72 hours.", '2026-10-03T20:00:00.000Z'],
    ['Please submit by Friday 5pm ET.', '2026-10-02T21:00:00.000Z'],
    ['Due Oct 5. No stipend.', '2026-10-06T06:59:59.999Z'],
    ['due by EOD Thursday', '2026-10-02T06:59:59.999Z'],
    ['you have 3 days', '2026-10-03T20:00:00.000Z'],
    ['due by tomorrow', '2026-10-02T06:59:59.999Z'],
  ])('%s', (text, iso) => {
    expect(parseDeadline(text, NOW, LA)?.at).toBe(iso)
  })

  it('a weekday named today means next week', () => {
    expect(parseDeadline('by Wednesday 5pm', NOW, LA)?.at).toBe('2026-10-08T00:00:00.000Z')
  })

  it('finds nothing in a message without a deadline', () => {
    expect(parseDeadline('thanks, talk soon', NOW, LA)).toBeNull()
  })
})
