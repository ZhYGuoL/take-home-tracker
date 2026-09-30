import { createContext, type ReactNode, useContext, useSyncExternalStore } from 'react'
import type { SyncStatus } from '../sync/engine'

export interface SessionValue {
  user: { sub: string; email: string; name: string }
  sync: {
    subscribe(fn: () => void): () => void
    getStatus(): SyncStatus
    push(): Promise<void>
    pull(): Promise<void>
  }
  /**
   * Sends what is unsent, then signs out. If saves still did not reach her Sheet, it does not
   * sign out and says how many, unless `force`. Offline, it changes nothing and says so.
   */
  signOut: (force?: boolean) => Promise<SignOutResult>
}

export type SignOutResult = { unsent: number } | { offline: true } | { done: true }

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ value, children }: { value: SessionValue; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/** The signed-in user and her sync, or null in tests and before sign-in. */
export function useSession(): SessionValue | null {
  return useContext(SessionContext)
}

const noSync = {
  subscribe: () => () => {},
  getStatus: (): SyncStatus => 'synced',
}

export function useSyncStatus(): SyncStatus {
  const sync = useSession()?.sync ?? noSync
  return useSyncExternalStore(sync.subscribe, sync.getStatus)
}
