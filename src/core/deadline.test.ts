import { describe, expect, it } from 'vitest'
import {
  deadlineAfterDays,
  deadlineAfterHours,
  deadlineAt,
  formatDate,
  formatDateTime,
  formatDeadline,
  instantIn,
  isValidZone,
  localParts,
  relative,
  zoneName,
} from './deadline'

describe('deadlineAt', () => {
  it('reads a date and time in the agreed zone', () => {
    expect(deadlineAt('2026-10-02', '17:00', 'America/New_York')).toEqual({
      at: '2026-10-02T21:00:00.000Z',
      zone: 'America/New_York',
      dateOnly: false,
    })
  })

  it('the same wall-clock time in another zone is a different instant', () => {
    const ny = deadlineAt('2026-10-02', '17:00', 'America/New_York').at
    const la = deadlineAt('2026-10-02', '17:00', 'America/Los_Angeles').at
    expect(Date.parse(la) - Date.parse(ny)).toBe(3 * 3_600_000)
  })

  it('a date with no time is the last millisecond of that day in the zone', () => {
    expect(deadlineAt('2026-10-02', null, 'America/Los_Angeles')).toEqual({
      at: '2026-10-03T06:59:59.999Z',
      zone: 'America/Los_Angeles',
      dateOnly: true,
    })
  })

  it('reads a zone east of UTC', () => {
    expect(instantIn('2026-10-02', '09:00', 'Asia/Kolkata')).toBe('2026-10-02T03:30:00.000Z')
  })
})

describe('durations across a daylight-saving change', () => {
  // US clocks go back one hour on Sunday 2026-11-01.
  const noonPdt = '2026-10-31T19:00:00.000Z'

  it('"48 hours" adds exactly 48 real hours', () => {
    const d = deadlineAfterHours(noonPdt, 48, 'America/Los_Angeles')
    expect(d.at).toBe('2026-11-02T19:00:00.000Z')
    expect(localParts(d.at, 'America/Los_Angeles')).toEqual({ date: '2026-11-02', time: '11:00' })
  })

  it('"2 days" keeps the wall-clock time', () => {
    const d = deadlineAfterDays(noonPdt, 2, 'America/Los_Angeles')
    expect(d.at).toBe('2026-11-02T20:00:00.000Z')
    expect(localParts(d.at, 'America/Los_Angeles')).toEqual({ date: '2026-11-02', time: '12:00' })
  })
})

describe('localParts', () => {
  it('round-trips with instantIn', () => {
    const at = instantIn('2026-12-31', '23:30', 'Europe/Berlin')
    expect(localParts(at, 'Europe/Berlin')).toEqual({ date: '2026-12-31', time: '23:30' })
  })

  it('shows the date in the viewer zone, which can differ from the agreed zone', () => {
    const at = instantIn('2026-10-02', '22:00', 'America/Los_Angeles')
    expect(localParts(at, 'America/New_York')).toEqual({ date: '2026-10-03', time: '01:00' })
  })
})

describe('zones', () => {
  it('names the zone for the instant', () => {
    expect(zoneName('2026-10-02T21:00:00Z', 'America/Los_Angeles')).toBe('PDT')
    expect(zoneName('2026-12-02T21:00:00Z', 'America/Los_Angeles')).toBe('PST')
  })

  it('rejects an unknown zone', () => {
    expect(isValidZone('America/New_York')).toBe(true)
    expect(isValidZone('Mars/Olympus')).toBe(false)
  })
})

describe('relative', () => {
  const now = Date.parse('2026-10-01T12:00:00Z')
  it.each([
    ['2026-10-01T12:00:30Z', 'now'],
    ['2026-10-01T12:45:00Z', 'in 45m'],
    ['2026-10-01T17:00:00Z', 'in 5h'],
    ['2026-10-03T16:00:00Z', 'in 2d 4h'],
    ['2026-10-03T12:00:00Z', 'in 2d'],
    ['2026-10-01T09:00:00Z', '3h ago'],
    ['2026-09-28T12:00:00Z', '3d ago'],
  ])('%s is %s', (iso, text) => {
    expect(relative(iso, now)).toBe(text)
  })
})

describe('formatting', () => {
  it('has one shape, built from parts', () => {
    expect(formatDateTime('2026-10-02T21:00:00Z', 'America/Los_Angeles')).toBe(
      'Fri, Oct 2, 2:00 PM',
    )
    expect(formatDateTime('2026-10-02T21:00:00Z', 'Asia/Tokyo')).toBe('Sat, Oct 3, 6:00 AM')
    expect(formatDateTime('2026-10-03T07:05:00Z', 'America/Los_Angeles')).toBe(
      'Sat, Oct 3, 12:05 AM',
    )
    expect(formatDate('2026-10-02T21:00:00Z', 'Asia/Tokyo')).toBe('Oct 3')
  })

  it('shows a date-only deadline as the end of its day, not as a time the next morning', () => {
    const d = deadlineAt('2026-09-28', null, 'America/Los_Angeles')
    expect(formatDeadline(d, 'America/Los_Angeles')).toBe('Mon, Sep 28, end of day')
    expect(formatDeadline(d, 'America/New_York')).toBe('Mon, Sep 28, end of day PDT')
    const timed = deadlineAt('2026-09-28', '17:00', 'America/Los_Angeles')
    expect(formatDeadline(timed, 'America/New_York')).toBe('Mon, Sep 28, 8:00 PM')
  })
})
