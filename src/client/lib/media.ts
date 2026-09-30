import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (fn) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', fn)
      return () => m.removeEventListener('change', fn)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Phone layout below 768px, as in the design skill. */
export const useIsWide = () => useMediaQuery('(min-width: 768px)')
