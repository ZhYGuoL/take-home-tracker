import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from 'react'
import { derive } from '../../core/derive'
import type { FactRow } from '../../core/filters'
import { flagsOf, needsYou } from '../../core/flags'
import type { Live } from '../../core/records'
import type { Repo } from './repo'

const RepoContext = createContext<Repo | null>(null)

export function RepoProvider({ repo, children }: { repo: Repo; children: ReactNode }) {
  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>
}

export function useRepo(): Repo {
  const repo = useContext(RepoContext)
  if (!repo) throw new Error('useRepo outside RepoProvider')
  return repo
}

export function useSaveStatus() {
  const repo = useRepo()
  return useSyncExternalStore(repo.subscribeStatus, repo.getStatus)
}

export function useLive(): Live {
  const repo = useRepo()
  return useSyncExternalStore(repo.subscribe, repo.getSnapshot)
}

export type Row = FactRow

/** Every candidate with its stage, flags, and "Needs you" at `now`. */
export function useRows(now: number): Row[] {
  const { candidates, entries } = useLive()
  return useMemo(
    () =>
      candidates.map((candidate) => {
        const derived = derive(candidate, entries)
        const flags = flagsOf(candidate, derived, now)
        return { candidate, derived, flags, needsYou: needsYou(derived, flags) }
      }),
    [candidates, entries, now],
  )
}
