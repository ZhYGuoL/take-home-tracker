import type { SessionResponse } from '../shared/api'
import type { GoogleAccess } from './sync/sheets'

export type Session = Extract<SessionResponse, { signedIn: true }>

/** The session. With `refresh`, the Worker gets a new Google token even if the old one is young. */
export async function fetchSession(
  fetcher: typeof fetch = fetch,
  refresh = false,
): Promise<SessionResponse> {
  const res = await fetcher(refresh ? '/api/session?refresh=1' : '/api/session', {
    credentials: 'same-origin',
  })
  if (res.status === 401) return (await res.json()) as SessionResponse
  if (!res.ok) throw new Error(`session ${res.status}`)
  return (await res.json()) as SessionResponse
}

/**
 * Google access for the Sheets calls. It reuses the token until a minute before it expires,
 * then asks the Worker, which refreshes it with the refresh token only the Worker can read (D4).
 */
export function googleAccess(first: Session, fetcher: typeof fetch = fetch): GoogleAccess {
  let current = first
  return {
    sheets: first.google.sheets,
    drive: first.google.drive,
    async token(fresh = false) {
      if (fresh || current.expiresAt - Date.now() < 60_000) {
        const next = await fetchSession(fetcher, fresh)
        if (!next.signedIn) {
          // She was signed out elsewhere, or Google ended the grant. Start over at sign-in.
          window.location.assign('/')
          throw new Error('signed out')
        }
        current = next
      }
      return current.accessToken
    },
  }
}

export async function signOut(fetcher: typeof fetch = fetch) {
  await fetcher('/auth/logout', { method: 'POST', credentials: 'same-origin' })
}
