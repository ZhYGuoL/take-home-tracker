import {
  deadlineAfterDays,
  deadlineAfterHours,
  deadlineAt,
  instantIn,
  localParts,
} from '../deadline'
import type { Deadline } from '../types'
import { addDays, weekdayOf } from '../zone'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** US zone words and abbreviations as people write them, mapped to IANA zones. */
const ZONES: Record<string, string> = {
  et: 'America/New_York',
  est: 'America/New_York',
  edt: 'America/New_York',
  eastern: 'America/New_York',
  ct: 'America/Chicago',
  cst: 'America/Chicago',
  cdt: 'America/Chicago',
  central: 'America/Chicago',
  mt: 'America/Denver',
  mst: 'America/Denver',
  mdt: 'America/Denver',
  mountain: 'America/Denver',
  pt: 'America/Los_Angeles',
  pst: 'America/Los_Angeles',
  pdt: 'America/Los_Angeles',
  pacific: 'America/Los_Angeles',
  utc: 'UTC',
  gmt: 'UTC',
  bst: 'Europe/London',
  cet: 'Europe/Berlin',
  cest: 'Europe/Berlin',
}

export const zoneFor = (word: string | undefined): string | null =>
  word ? (ZONES[word.toLowerCase()] ?? null) : null

const pad = (n: number) => String(n).padStart(2, '0')

function to24(hour: number, minute: number, meridiem: string | undefined): string | null {
  if (hour > 23 || minute > 59) return null
  let h = hour
  const m = meridiem?.toLowerCase().replace(/\./g, '')
  if (m === 'pm' && h < 12) h += 12
  if (m === 'am' && h === 12) h = 0
  return `${pad(h)}:${pad(minute)}`
}

const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)`
const ZONE_WORD = String.raw`(?:\s*\(?\b(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT|UTC|GMT|BST|CET|CEST)\b\)?)?`

function monthIndex(word: string): number {
  return MONTHS.indexOf(word.slice(0, 3).toLowerCase())
}

/**
 * The instant of a header timestamp such as "Wed, Sep 30, 2026 at 11:42 AM",
 * "Tuesday, September 29, 2026 9:05 PM", "Thu, Oct 1, 2026 at 2:05 AM EDT", or "9/30/26, 11:16 AM".
 * A stamp with no zone is read in `zone`, as a mail app shows it in the reader's zone.
 */
export function parseStamp(text: string, zone: string): string | null {
  const named = new RegExp(
    String.raw`\b([A-Z][a-z]{2,8})\.?\s+(\d{1,2}),?\s+(\d{4}),?\s*(?:at\s+)?${TIME}${ZONE_WORD}`,
    'i',
  ).exec(text)
  if (named) {
    const [, mon = '', day, year, h, min, mer, z] = named
    const mo = monthIndex(mon)
    const time = to24(Number(h), Number(min ?? 0), mer)
    if (mo >= 0 && time) {
      return instant(`${year}-${pad(mo + 1)}-${pad(Number(day))}`, time, zoneFor(z) ?? zone)
    }
  }
  const numeric = new RegExp(
    String.raw`\b(\d{1,2})/(\d{1,2})/(\d{2,4}),?\s+${TIME}${ZONE_WORD}`,
    'i',
  ).exec(text)
  if (numeric) {
    const [, mo, day, yr = '', h, min, mer, z] = numeric
    const year = yr.length === 2 ? `20${yr}` : yr
    const time = to24(Number(h), Number(min ?? 0), mer)
    if (time)
      return instant(`${year}-${pad(Number(mo))}-${pad(Number(day))}`, time, zoneFor(z) ?? zone)
  }
  return null
}

/**
 * A bare time such as "12:14 PM" on a DM or LinkedIn line. It means today in her zone,
 * or yesterday when today's would be later than the paste.
 */
export function parseClock(text: string, now: string, zone: string): string | null {
  const m = new RegExp(String.raw`(?:^|\s|·)${TIME}${ZONE_WORD}(?:\s|$|\()`, 'i').exec(text)
  if (!m) return null
  const [, h, min, mer, z] = m
  const time = to24(Number(h), Number(min ?? 0), mer)
  if (!time) return null
  const at = zoneFor(z) ?? zone
  const today = localParts(now, at).date
  const t = instant(today, time, at)
  if (Date.parse(t) <= Date.parse(now)) return t
  return instant(addDays(today, -1), time, at)
}

const instant = instantIn

/** The next date that falls on `weekday`, after today in `zone`. Today counts only if `today`. */
function nextWeekday(now: string, zone: string, weekday: number, includeToday: boolean): string {
  const today = localParts(now, zone).date
  let add = (weekday - weekdayOf(today) + 7) % 7
  if (add === 0 && !includeToday) add = 7
  return addDays(today, add)
}

/**
 * A deadline stated in the text, relative to `now`:
 * "48 hours", "3 days", "a week", "by Friday 5pm ET", "EOD Thursday", "due Oct 5", "tomorrow".
 * A date with no time is the end of that day (D8).
 */
export function parseDeadline(text: string, now: string, zone: string): Deadline | null {
  const t = text.toLowerCase()

  const hours = /\b(\d{1,3})\s*(?:hours?|hrs?|h)\b/.exec(t)
  if (hours) return deadlineAfterHours(now, Number(hours[1]), zone)

  const days = /\b(\d{1,2}|a|one|two|three|four|five|six|seven)\s*(days?|weeks?)\b/.exec(t)
  if (days && /\b(have|get|within|in|take|takes|you'll|you will)\b/.test(t)) {
    const words: Record<string, number> = {
      a: 1,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
    }
    const n = words[days[1] ?? ''] ?? Number(days[1])
    return deadlineAfterDays(now, days[2]?.startsWith('week') ? n * 7 : n, zone)
  }

  const onDay = new RegExp(
    String.raw`\b(?:by|due|before|until|eod|end of day)\s+(?:eod\s+)?(?:on\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?(?:\s+(?:at\s+)?${TIME})?${ZONE_WORD}`,
    'i',
  ).exec(text)
  if (onDay) {
    const [, wd = '', h, min, mer, z] = onDay
    const at = zoneFor(z) ?? zone
    const date = nextWeekday(now, at, WEEKDAYS.indexOf(wd.toLowerCase()), false)
    const time = h ? to24(Number(h), Number(min ?? 0), mer) : null
    return deadlineAt(date, time, at)
  }

  const onDate = new RegExp(
    String.raw`\b(?:by|due|before|until)\s+(?:on\s+)?([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?(?:\s+(?:at\s+)?${TIME})?${ZONE_WORD}`,
    'i',
  ).exec(text)
  if (onDate) {
    const [, mon = '', day, year, h, min, mer, z] = onDate
    const mo = monthIndex(mon)
    if (mo >= 0) {
      const at = zoneFor(z) ?? zone
      const thisYear = Number(localParts(now, at).date.slice(0, 4))
      const date = `${year ?? thisYear}-${pad(mo + 1)}-${pad(Number(day))}`
      const time = h ? to24(Number(h), Number(min ?? 0), mer) : null
      return deadlineAt(date, time, at)
    }
  }

  if (/\b(?:by|due|until)\s+(?:eod\s+)?tomorrow\b/.test(t)) {
    return deadlineAt(addDays(localParts(now, zone).date, 1), null, zone)
  }
  return null
}
