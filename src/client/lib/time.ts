import { useEffect, useState } from 'react'

/** The viewer's own IANA time zone. */
export const viewerZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone

/** The current time, updated every 30 seconds so flags change when a deadline passes. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}

export const newId = (): string => crypto.randomUUID()
