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
    expect(parseStamp(text, NOW, LA)).toBe(iso)
  })

  it('reads 12 AM as midnight', () => {
    expect(parseStamp('Oct 2, 2026 at 12:30 AM', NOW, LA)).toBe('2026-10-02T07:30:00.000Z')
  })

  it('reads a weekday and a time as that day in the past week, as Messages shows it', () => {
    const now = '2026-09-30T20:00:00.000Z' // Wed 1:00 PM PDT
    const LA = 'America/Los_Angeles'
    expect(parseStamp('Friday 9:14 AM', now, LA)).toBe('2026-09-25T16:14:00.000Z')
    expect(parseStamp('Wednesday 9:14 AM', now, LA)).toBe('2026-09-23T16:14:00.000Z')
    // Only when the whole line is the stamp, never inside a sentence.
    expect(parseStamp('see you Friday 9:14 AM', now, LA)).toBeNull()
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

describe('parseDeadline reads only the deadline she sets', () => {
  it('skips her own promise to get back to the candidate', () => {
    expect(parseDeadline('I will get back to you by Friday with next steps.', NOW, LA)).toBeNull()
  })

  it.each([
    ['Your new deadline is Monday, October 19 at 5:00 PM ET.', '2026-10-19T21:00:00.000Z'],
    [
      "Let's move your deadline to Monday 9am PT so you have the weekend.",
      '2026-10-05T16:00:00.000Z',
    ],
    ["It's due 10/9, and text me if you get stuck!", '2026-10-10T06:59:59.999Z'],
    ['Please send it by noon on Thursday the 22nd.', '2026-10-22T19:00:00.000Z'],
    [
      'Please send your repo by Friday, October 16 (Pacific time, since the team is in Seattle).',
      '2026-10-17T06:59:59.999Z',
    ],
    ['Could you aim for end of day Friday ET?', '2026-10-03T03:59:59.999Z'],
  ])('%s', (text, iso) => {
    expect(parseDeadline(text, NOW, LA)?.at).toBe(iso)
  })
})

describe('parseStamp reads more formats', () => {
  it.each([
    ['October 9, 2026 at 11:52:18 PM EDT', '2026-10-10T03:52:18.000Z'],
    ['Fri, Sep 25, 9:14 AM (5 days ago)', '2026-09-25T16:14:00.000Z'],
    ['14/10/2026, 17:05:11', '2026-10-15T00:05:11.000Z'],
  ])('%s', (text, iso) => {
    expect(parseStamp(text, NOW, LA)).toBe(iso)
  })

  it('reads a day-first date outside the US', () => {
    expect(parseStamp('3/10/2026, 09:00', NOW, 'Europe/London')).toBe('2026-10-03T08:00:00.000Z')
  })
})

describe('durations', () => {
  it.each([
    ['It should take about 3-4 hours. You will have 48 hours.', '2026-10-02T20:00:00.000Z'],
    [
      'Please spend no more than 4 hours, and send it by Friday 5pm ET.',
      '2026-10-02T21:00:00.000Z',
    ],
    ['Most people spend 2 days on it. Due by Oct 9.', '2026-10-10T06:59:59.999Z'],
    ['You have 72 hours to finish it.', '2026-10-03T20:00:00.000Z'],
    ['Take the time you need, within 3 days is great.', '2026-10-03T20:00:00.000Z'],
  ])('%s', (text, iso) => {
    expect(parseDeadline(text, NOW, LA)?.at).toBe(iso)
  })

  it('a take-home that "should take 2 hours" sets no deadline', () => {
    expect(parseDeadline('The take-home should take about 2 hours.', NOW, LA)).toBeNull()
  })
})

describe('zones outside the US', () => {
  it.each([
    ['Please send it by Friday 5pm IST.', '2026-10-02T11:30:00.000Z'],
    ['Please send it by Friday 5pm JST.', '2026-10-02T08:00:00.000Z'],
    ['Please send it by Friday 5pm AEST.', '2026-10-02T07:00:00.000Z'],
  ])('%s', (text, iso) => {
    expect(parseDeadline(text, NOW, LA)?.at).toBe(iso)
  })
})
