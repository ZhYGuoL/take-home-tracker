import { describe, expect, it } from 'vitest'
import { addDays, dateIn, instantOf, offsetAt, wallClock, weekdayOf } from './zone'

const iso = (t: number) => new Date(t).toISOString()
const HOUR = 3_600_000

describe('the test process', () => {
  it('runs in an unusual system zone, so no code can lean on the machine zone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Pacific/Chatham')
  })
})

describe('instantOf', () => {
  it('reads a plain time in a zone west and east of UTC', () => {
    expect(iso(instantOf('America/New_York', 2026, 10, 2, 17, 0))).toBe('2026-10-02T21:00:00.000Z')
    expect(iso(instantOf('Asia/Kolkata', 2026, 10, 2, 9, 0))).toBe('2026-10-02T03:30:00.000Z')
    expect(iso(instantOf('Pacific/Chatham', 2026, 10, 2, 9, 0))).toBe('2026-10-01T19:15:00.000Z')
  })

  it('a time in the hour clocks skip moves forward by the skipped length', () => {
    // 2:30 AM on Sun Mar 8 2026 does not happen in Los Angeles. 3:30 AM PDT is 10:30 UTC.
    expect(iso(instantOf('America/Los_Angeles', 2026, 3, 8, 2, 30))).toBe(
      '2026-03-08T10:30:00.000Z',
    )
  })

  it('a time in the hour that repeats is the first of the two', () => {
    // 1:30 AM on Sun Nov 1 2026 happens twice in Los Angeles: 08:30 UTC (PDT), then 09:30 UTC.
    expect(iso(instantOf('America/Los_Angeles', 2026, 11, 1, 1, 30))).toBe(
      '2026-11-01T08:30:00.000Z',
    )
    // 1:30 AM on Sun Oct 25 2026 happens twice in London: 00:30 UTC (BST), then 01:30 UTC.
    expect(iso(instantOf('Europe/London', 2026, 10, 25, 1, 30))).toBe('2026-10-25T00:30:00.000Z')
  })

  it('handles a half-hour clock change', () => {
    // Lord Howe Island moves from +11:00 to +10:30 at 2:00 AM on Sun Apr 5 2026.
    expect(iso(instantOf('Australia/Lord_Howe', 2026, 4, 5, 12, 0))).toBe(
      '2026-04-05T01:30:00.000Z',
    )
  })

  it('keeps seconds and milliseconds', () => {
    expect(iso(instantOf('UTC', 2026, 10, 2, 23, 59, 59, 999))).toBe('2026-10-02T23:59:59.999Z')
  })

  it('round-trips with wallClock for every hour of a year, in several zones', () => {
    for (const zone of [
      'America/Los_Angeles',
      'Europe/London',
      'Australia/Lord_Howe',
      'Asia/Kolkata',
    ]) {
      const start = Date.parse('2026-01-01T00:00:00Z')
      for (let t = start; t < start + 365 * 24 * HOUR; t += 7 * HOUR) {
        const w = wallClock(t, zone)
        const back = instantOf(zone, w.year, w.month, w.day, w.hour, w.minute, w.second)
        // In a repeated hour the first instant comes back, which is up to an hour earlier.
        expect(t - back).toBeGreaterThanOrEqual(0)
        expect(t - back).toBeLessThanOrEqual(HOUR)
        expect(wallClock(back, zone)).toMatchObject({ hour: w.hour, minute: w.minute })
      }
    }
  })
})

describe('offsetAt and wallClock', () => {
  it('knows daylight saving', () => {
    expect(offsetAt(Date.parse('2026-07-01T12:00:00Z'), 'America/Los_Angeles')).toBe(-7 * HOUR)
    expect(offsetAt(Date.parse('2026-12-01T12:00:00Z'), 'America/Los_Angeles')).toBe(-8 * HOUR)
  })

  it('shows midnight as hour 0', () => {
    expect(wallClock(Date.parse('2026-10-02T07:00:00Z'), 'America/Los_Angeles')).toMatchObject({
      day: 2,
      hour: 0,
      weekday: 5,
    })
  })
})

describe('calendar dates', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('knows the weekday', () => {
    expect(weekdayOf('2026-10-02')).toBe(5)
  })

  it('reads the date of an instant in a zone', () => {
    expect(dateIn(Date.parse('2026-10-03T02:00:00Z'), 'America/Los_Angeles')).toBe('2026-10-02')
    expect(dateIn(Date.parse('2026-10-03T02:00:00Z'), 'Asia/Tokyo')).toBe('2026-10-03')
  })
})
