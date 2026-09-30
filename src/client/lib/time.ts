import { useEffect, useState } from 'react'

/** The viewer's own IANA time zone. */
export const viewerZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone

export const TICK_MS = 30_000

/**
 * Milliseconds until the next render: the next 30-second tick for relative times, or one
 * millisecond after the next deadline, when Overdue turns on. The flag never lags the deadline.
 */
export function nextWake(now: number, deadlines: readonly number[], tick = TICK_MS): number {
  let wait = tick
  for (const d of deadlines) {
    if (d >= now) wait = Math.min(wait, d - now + 1)
  }
  return wait
}

/** The current time. It changes on each tick and right after each deadline in `deadlines`. */
export function useNow(deadlines: readonly number[] = []): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let id = 0
    const arm = () => {
      id = window.setTimeout(
        () => {
          setNow(Date.now())
          arm()
        },
        nextWake(Date.now(), deadlines),
      )
    }
    arm()
    return () => window.clearTimeout(id)
  }, [deadlines])
  return now
}

export const newId = (): string => crypto.randomUUID()
