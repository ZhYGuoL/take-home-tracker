import { useEffect, useState } from 'react'
import { uuidv7Factory } from '../../core/ids'

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

/**
 * The current time. It changes on each tick, right after each deadline in `deadlines`, when the
 * deadlines themselves change, and when she comes back to the tab.
 */
export function useNow(deadlines: readonly number[] = []): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let id = 0
    const tick = () => setNow(Date.now())
    const arm = () => {
      id = window.setTimeout(
        () => {
          tick()
          arm()
        },
        nextWake(Date.now(), deadlines),
      )
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      window.clearTimeout(id)
      tick()
      arm()
    }
    tick()
    arm()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [deadlines])
  return now
}

/** Time-ordered ids, so entries saved in the same minute keep their save order. */
export const newId = uuidv7Factory()
