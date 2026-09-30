import { TZDate } from '@date-fns/tz'
import type { Deadline } from './types'

const HOUR = 3_600_000

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

function parseDate(date: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) throw new Error(`bad date: ${date}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function parseTime(time: string): [number, number] {
  const m = /^(\d{2}):(\d{2})$/.exec(time)
  if (!m) throw new Error(`bad time: ${time}`)
  return [Number(m[1]), Number(m[2])]
}

/** The instant of a wall-clock date and time in `zone`. */
export function instantIn(date: string, time: string, zone: string): string {
  const [y, mo, d] = parseDate(date)
  const [h, mi] = parseTime(time)
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, 0, zone).getTime()).toISOString()
}

/** A deadline from a date, an optional time, and the zone it was agreed in (D8). */
export function deadlineAt(date: string, time: string | null, zone: string): Deadline {
  if (time) return { at: instantIn(date, time, zone), zone, dateOnly: false }
  const [y, mo, d] = parseDate(date)
  const end = new TZDate(y, mo - 1, d, 23, 59, 59, 999, zone)
  return { at: new Date(end.getTime()).toISOString(), zone, dateOnly: true }
}

/** "48 hours" is exactly 48 real hours after `from` (D8). */
export function deadlineAfterHours(from: string, hours: number, zone: string): Deadline {
  return { at: new Date(Date.parse(from) + hours * HOUR).toISOString(), zone, dateOnly: false }
}

/** "2 days" is the same wall-clock time two calendar days later in `zone` (D8). */
export function deadlineAfterDays(from: string, days: number, zone: string): Deadline {
  const t = new TZDate(Date.parse(from), zone)
  t.setDate(t.getDate() + days)
  return { at: new Date(t.getTime()).toISOString(), zone, dateOnly: false }
}

/** The wall-clock date and time of `iso` in `zone`, for form inputs. */
export function localParts(iso: string, zone: string): { date: string; time: string } {
  const t = new TZDate(Date.parse(iso), zone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`,
    time: `${pad(t.getHours())}:${pad(t.getMinutes())}`,
  }
}

/** A short zone name such as "PDT" or "GMT+2" for `iso` in `zone`. */
export function zoneName(iso: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'short',
  }).formatToParts(new Date(iso))
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? zone
}

function parts(iso: string, zone: string, opts: Intl.DateTimeFormatOptions) {
  const out: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, ...opts })
  for (const p of fmt.formatToParts(new Date(iso))) out[p.type] = p.value
  return out
}

/** "Fri, Oct 2, 2:00 PM". Built from parts, so every browser shows the same shape. */
export function formatDateTime(iso: string, zone: string): string {
  const p = parts(iso, zone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
  })
  return `${p.weekday}, ${p.month} ${p.day}, ${p.hour}:${p.minute} ${p.dayPeriod}`
}

/** "Oct 2". */
export function formatDate(iso: string, zone: string): string {
  const p = parts(iso, zone, { month: 'short', day: 'numeric' })
  return `${p.month} ${p.day}`
}

/** "in 2d 4h", "3h ago", "now". Same shape in every state. */
export function relative(iso: string, now: number): string {
  const diff = Date.parse(iso) - now
  const abs = Math.abs(diff)
  const minutes = Math.floor(abs / 60_000)
  if (minutes < 1) return 'now'
  const days = Math.floor(abs / (24 * HOUR))
  const hours = Math.floor((abs % (24 * HOUR)) / HOUR)
  const mins = minutes % 60
  const span =
    days > 0
      ? hours > 0
        ? `${days}d ${hours}h`
        : `${days}d`
      : hours > 0
        ? `${hours}h`
        : `${mins}m`
  return diff > 0 ? `in ${span}` : `${span} ago`
}
