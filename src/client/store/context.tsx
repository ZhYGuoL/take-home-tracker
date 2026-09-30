import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from 'react'
import { type Derived, derive } from '../../core/derive'
import type { Live } from '../../core/records'
import type { Candidate } from '../../core/types'
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

export function useLive(): Live {
  const repo = useRepo()
  return useSyncExternalStore(repo.subscribe, repo.getSnapshot)
}

export interface Row {
  candidate: Candidate
  derived: Derived
}

export function useRows(): Row[] {
  const { candidates, entries } = useLive()
  return useMemo(
    () => candidates.map((candidate) => ({ candidate, derived: derive(candidate, entries) })),
    [candidates, entries],
  )
}
