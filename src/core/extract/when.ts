import { deadlineAfterDays, deadlineAfterHours, deadlineAt, localParts } from '../deadline'
import type { Deadline } from '../types'
import { addDays, instantOf, weekdayOf } from '../zone'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** Zone words and abbreviations as people write them, mapped to IANA zones. */
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
  word ? (ZONES[word.toLowerCase().replace(/\s*time$/, '')] ?? null) : null

const ZONE_RE = String.raw`\b(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT|UTC|GMT|BST|CET|CEST|(?:eastern|central|mountain|pacific)\s+time)\b`

/** The first zone word in a piece of text, such as "5pm ET" or "(Pacific time)". */
function zoneIn(text: string): string | null {
  const m = new RegExp(ZONE_RE, 'i').exec(text)
  return m ? zoneFor(m[1]) : null
}

interface Clock {
  hour: number
  minute: number
  second: number
}

// A clock time: "5pm", "5:00 PM", "11:52:18 PM", "17:05", "17:05:11", "noon", "midnight".
// A time with no colon needs am or pm, so a bare number is never read as a time.
const CLOCK = String.raw`(?:(noon|midnight)|(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?:\s*([ap])\.?\s?m\b\.?)?)`

function clockFrom(m: RegExpExecArray, at: number): Clock | null {
  const word = m[at]
  if (word) return { hour: word.toLowerCase() === 'noon' ? 12 : 0, minute: 0, second: 0 }
  if (m[at + 1] === undefined) return null
  const h = Number(m[at + 1])
  const hasMinutes = m[at + 2] !== undefined
  const min = hasMinutes ? Number(m[at + 2]) : 0
  const sec = m[at + 3] === undefined ? 0 : Number(m[at + 3])
  const mer = m[at + 4]?.toLowerCase()
  if (!hasMinutes && !mer) return null
  if (h > 23 || min > 59 || sec > 59 || (mer && (h < 1 || h > 12))) return null
  let hour = h
  if (mer === 'p' && hour < 12) hour += 12
  if (mer === 'a' && hour === 12) hour = 0
  return { hour, minute: min, second: sec }
}

const pad = (n: number) => String(n).padStart(2, '0')
const monthIndex = (word: string) => MONTHS.indexOf(word.slice(0, 3).toLowerCase())

function instantAt(date: string, c: Clock, zone: string): string {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(instantOf(zone, y, mo, d, c.hour, c.minute, c.second)).toISOString()
}

/** A date with no year is the latest one that is not after `now`, give or take a day. */
function yearFor(month: number, day: number, now: string, zone: string): number {
  const today = localParts(now, zone).date
  const year = Number(today.slice(0, 4))
  return `${year}-${pad(month)}-${pad(day)}` > addDays(today, 1) ? year - 1 : year
}

/** "3/10/26": month first in a US zone, day first elsewhere, unless a part is over 12. */
function numericDate(a: number, b: number, zone: string): [month: number, day: number] {
  if (a > 12) return [b, a]
  if (b > 12) return [a, b]
  return zone.startsWith('America/') ? [a, b] : [b, a]
}

const NAMED_DATE = String.raw`(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?`

/**
 * The instant of a message timestamp, such as "Wed, Sep 30, 2026 at 11:42 AM",
 * "October 9, 2026 at 11:52:18 PM EDT", "Fri, Oct 2, 9:14 AM (3 days ago)", "9/30/26, 11:16 AM",
 * "14/10/2026, 17:05:11", or "Today at 9:15 AM". A stamp with no zone is read in `zone`,
 * as apps show times in the reader's zone. A stamp with no time gives null.
 */
export function parseStamp(text: string, now: string, zone: string): string | null {
  const named = new RegExp(String.raw`\b${NAMED_DATE},?\s*(?:at\s+)?${CLOCK}`, 'i').exec(text)
  if (named) {
    const clock = clockFrom(named, 4)
    const mo = monthIndex(named[1] ?? '') + 1
    const day = Number(named[2])
    if (clock && mo > 0) {
      const z = zoneIn(text.slice(named.index)) ?? zone
      const year = named[3] ? Number(named[3]) : yearFor(mo, day, now, z)
      return instantAt(`${year}-${pad(mo)}-${pad(day)}`, clock, z)
    }
  }
  const numeric = new RegExp(String.raw`\b(\d{1,2})/(\d{1,2})/(\d{2,4}),?\s+${CLOCK}`, 'i').exec(
    text,
  )
  if (numeric) {
    const clock = clockFrom(numeric, 4)
    const [mo, day] = numericDate(Number(numeric[1]), Number(numeric[2]), zone)
    const yr = numeric[3] ?? ''
    if (clock) {
      const z = zoneIn(text.slice(numeric.index)) ?? zone
      return instantAt(`${yr.length === 2 ? `20${yr}` : yr}-${pad(mo)}-${pad(day)}`, clock, z)
    }
  }
  const relative = new RegExp(String.raw`\b(today|yesterday)\b,?\s*(?:at\s+)?${CLOCK}`, 'i').exec(
    text,
  )
  if (relative) {
    const clock = clockFrom(relative, 2)
    if (clock) {
      const today = localParts(now, zone).date
      const date = relative[1]?.toLowerCase() === 'yesterday' ? addDays(today, -1) : today
      return instantAt(date, clock, zone)
    }
  }
  return null
}

/**
 * A bare time such as "12:14 PM" or "10:22" on a chat or DM line. It means today in `zone`,
 * or yesterday when today's would be later than the paste. `day` sets the date when a line
 * above names it, such as "Oct 28" or "Today".
 */
export function parseClock(text: string, now: string, zone: string, day?: string): string | null {
  const re = new RegExp(String.raw`(?:^|[\s·(\[,-])${CLOCK}`, 'gi')
  for (const m of text.matchAll(re)) {
    const clock = clockFrom(m as RegExpExecArray, 1)
    if (!clock) continue
    const at = zoneIn(text) ?? zone
    if (day) return instantAt(day, clock, at)
    const today = localParts(now, at).date
    const t = instantAt(today, clock, at)
    if (Date.parse(t) <= Date.parse(now)) return t
    return instantAt(addDays(today, -1), clock, at)
  }
  return null
}

/** A day named on its own line, such as "Today", "Yesterday", or "Oct 28". */
export function parseDayLine(line: string, now: string, zone: string): string | null {
  const t = line.trim()
  const today = localParts(now, zone).date
  if (/^today$/i.test(t)) return today
  if (/^yesterday$/i.test(t)) return addDays(today, -1)
  const m = new RegExp(String.raw`^${NAMED_DATE}$`, 'i').exec(t)
  if (!m) return null
  const mo = monthIndex(m[1] ?? '') + 1
  const day = Number(m[2])
  const year = m[3] ? Number(m[3]) : yearFor(mo, day, now, zone)
  return `${year}-${pad(mo)}-${pad(day)}`
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
}

function nextWeekday(today: string, weekday: number): string {
  let add = (weekday - weekdayOf(today) + 7) % 7
  if (add === 0) add = 7
  return addDays(today, add)
}

const TRIGGER =
  /\b(?:due|by|before|until|till|deadline(?:\s+(?:is|to))?|(?:move|push|extend)\s+(?:it|your deadline|the deadline)\s+to|aim for|no later than)\b/i

/**
 * A deadline the recruiter states, relative to `now`: "48 hours", "72 hrs", "within 3 days",
 * "by Friday 5pm ET", "end of day Friday", "due Oct 5", "due 10/9", "by noon on Thursday the 22nd",
 * "Your new deadline is Monday, October 19 at 5:00 PM ET". A date with no time is the end of
 * that day (D8). A zone word in the same paragraph sets the zone.
 */
export function parseDeadline(text: string, now: string, zone: string): Deadline | null {
  return explicitDeadline(text, now, zone) ?? durationDeadline(text, now, zone)
}

/**
 * "You'll have 48 hours", "within 3 days", "72 hours to finish it". The number must follow a word
 * that gives her the time, so "should take about 3 hours" or "most people spend 2 days" is not a deadline.
 */
function durationDeadline(text: string, now: string, zone: string): Deadline | null {
  const n = String.raw`(\d{1,3}|an?|one|two|three|four|five|six|seven)\s*(hours?|hrs?|h|days?|weeks?)\b`
  const m =
    new RegExp(
      String.raw`\b(?:have|get|within|allow|give you|giving you|in the next)\s+(?:about\s+|up to\s+|the next\s+)?${n}`,
      'i',
    ).exec(text) ??
    new RegExp(String.raw`\b${n}\s+to\s+(?:finish|complete|submit|do|work on)\b`, 'i').exec(text)
  if (!m) return null
  const count = WORD_NUMBERS[m[1]?.toLowerCase() ?? ''] ?? Number(m[1])
  const unit = m[2]?.toLowerCase() ?? ''
  if (unit.startsWith('h')) return deadlineAfterHours(now, count, zone)
  return deadlineAfterDays(now, unit.startsWith('w') ? count * 7 : count, zone)
}

function explicitDeadline(text: string, now: string, zone: string): Deadline | null {
  // "I will get back to you by Friday" is her promise, not the candidate's deadline.
  const trigger = [...text.matchAll(new RegExp(TRIGGER.source, 'gi'))].find((m) => {
    const sentence =
      text
        .slice(0, m.index)
        .split(/[.!?\n]/)
        .at(-1) ?? ''
    return (
      !/\b(?:i|we)\b/i.test(sentence) ||
      /\byou\b/i.test(sentence.replace(/\bget back to you\b/i, ''))
    )
  })
  if (!trigger) return null
  // The clause after the trigger, up to the end of its sentence. "5 p.m." and "10/9" stay whole.
  const rest = text.slice(trigger.index)
  const clause = rest.split(/(?<!\b[ap]|\d)[.!?](?!\d)|\n/i)[0] ?? rest
  const at = zoneIn(rest.split(/\n\s*\n/)[0] ?? rest) ?? zone
  const today = localParts(now, at).date

  let date: string | null = null
  const named = new RegExp(NAMED_DATE, 'i').exec(clause)
  const numeric = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(clause)
  const weekday = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i.exec(clause)
  const ordinal = /\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b/i.exec(clause)
  if (named) {
    const mo = monthIndex(named[1] ?? '') + 1
    const day = Number(named[2])
    const year = named[3] ? Number(named[3]) : Number(today.slice(0, 4))
    date = `${year}-${pad(mo)}-${pad(day)}`
    if (!named[3] && date < today) date = `${year + 1}-${pad(mo)}-${pad(day)}`
  } else if (numeric) {
    const [mo, day] = numericDate(Number(numeric[1]), Number(numeric[2]), at)
    const yr = numeric[3]
    const year = yr ? Number(yr.length === 2 ? `20${yr}` : yr) : Number(today.slice(0, 4))
    date = `${year}-${pad(mo)}-${pad(day)}`
    if (!yr && date < today) date = `${year + 1}-${pad(mo)}-${pad(day)}`
  } else if (ordinal) {
    const day = Number(ordinal[1])
    const [y, m] = today.split('-').map(Number) as [number, number]
    date = `${y}-${pad(m)}-${pad(day)}`
    if (date < today) date = m === 12 ? `${y + 1}-01-${pad(day)}` : `${y}-${pad(m + 1)}-${pad(day)}`
  } else if (weekday) {
    date = nextWeekday(today, WEEKDAYS.indexOf(weekday[1]?.toLowerCase() ?? ''))
  } else if (/\btomorrow\b/i.test(clause)) {
    date = addDays(today, 1)
  } else if (/\btonight\b/i.test(clause)) {
    date = today
  }
  if (!date) return null

  const eod = /\b(?:end of (?:the )?day|eod|close of business|cob)\b/i.test(clause)
  let clock: Clock | null = null
  if (!eod) {
    // A clock time in the clause, but not the day number of a date such as "October 19".
    const stripped = clause
      .replace(new RegExp(NAMED_DATE, 'gi'), ' ')
      .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
      .replace(/\bthe\s+\d{1,2}(?:st|nd|rd|th)\b/gi, ' ')
    for (const m of stripped.matchAll(new RegExp(`(?:^|\\s)${CLOCK}`, 'gi'))) {
      clock = clockFrom(m as RegExpExecArray, 1)
      if (clock) break
    }
  }
  if (!clock) return deadlineAt(date, null, at)
  return { at: instantAt(date, clock, at), zone: at, dateOnly: false }
}
