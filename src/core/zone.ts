// Time zone math with Intl only. It never subclasses or reads the local Date zone, so it gives
// the same answer on any machine, in any browser, and under a test clock that replaces Date.

export interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  /** 0 is Sunday. */
  weekday: number
}

const formats = new Map<string, Intl.DateTimeFormat>()
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function format(zone: string): Intl.DateTimeFormat {
  let f = formats.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    })
    formats.set(zone, f)
  }
  return f
}

/** The wall clock in `zone` at instant `t` (milliseconds since the epoch). */
export function wallClock(t: number, zone: string): WallClock {
  const p: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of format(zone).formatToParts(t)) p[part.type] = part.value
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAYS.indexOf(p.weekday ?? ''),
  }
}

/** How far `zone` is ahead of UTC at instant `t`, in milliseconds. */
export function offsetAt(t: number, zone: string): number {
  const w = wallClock(t, zone)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return asUtc - Math.floor(t / 1000) * 1000
}

/**
 * The instant when the wall clock in `zone` shows the given time.
 * In the hour that repeats when clocks go back, it is the first of the two instants.
 * In the hour that clocks skip, it is the time pushed forward by the skipped length.
 */
export function instantOf(
  zone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): number {
  const local = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  const o1 = offsetAt(local, zone)
  let t = local - o1
  const o2 = offsetAt(t, zone)
  if (o1 === o2) return firstOccurrence(t, local, zone)
  t = local - o2
  const o3 = offsetAt(t, zone)
  if (o2 === o3) return firstOccurrence(t, local, zone)
  // The time falls in a skipped hour. Use the later offset, which moves it forward.
  return local - Math.min(o2, o3)
}

/** In a repeated hour, the same wall clock also happens one offset change earlier. */
function firstOccurrence(t: number, local: number, zone: string): number {
  const before = t - 3 * 3_600_000
  const shift = offsetAt(before, zone) - offsetAt(t, zone)
  if (shift <= 0) return t
  const earlier = t - shift
  return earlier + offsetAt(earlier, zone) === local ? earlier : t
}

/** "YYYY-MM-DD" plus `days` calendar days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** The weekday of a calendar date, 0 for Sunday. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The calendar date of instant `t` in `zone`, as "YYYY-MM-DD". */
export function dateIn(t: number, zone: string): string {
  const w = wallClock(t, zone)
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`
}
