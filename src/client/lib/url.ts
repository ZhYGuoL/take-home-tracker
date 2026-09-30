import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
const notify = () => {
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  window.addEventListener('popstate', fn)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('popstate', fn)
  }
}

/** The current query string. Changes when the app navigates or she uses the back button. */
export function useSearch(): string {
  return useSyncExternalStore(subscribe, () => window.location.search)
}

/**
 * Sets query parameters. `null` removes one.
 * `push` adds a history step, so the phone's back gesture closes what this opened.
 */
export function navigate(
  changes: Record<string, string | null>,
  mode: 'push' | 'replace' = 'push',
) {
  const params = new URLSearchParams(window.location.search)
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) params.delete(k)
    else params.set(k, v)
  }
  const qs = params.toString()
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`
  if (url === `${window.location.pathname}${window.location.search}`) return
  if (mode === 'push') window.history.pushState({ pushed: true }, '', url)
  else window.history.replaceState(window.history.state, '', url)
  notify()
}

/**
 * Closes what a query parameter opened. When the app opened it, this steps back in history,
 * so the back gesture does not reopen it. After a reload, it removes the parameter instead.
 */
export function close(param: string) {
  if (window.history.state?.pushed && new URLSearchParams(window.location.search).has(param)) {
    window.history.back()
  } else {
    navigate({ [param]: null }, 'replace')
  }
}
