import { useMemo } from 'react'
import { byTime } from '../core/derive'
import { CandidateTable } from './components/CandidateTable'
import { newId, useNow, viewerZone } from './lib/time'
import { navigate, useSearch } from './lib/url'
import { type Row, useRepo, useRows } from './store/context'

export function App() {
  const repo = useRepo()
  const rows = useRows()
  const now = useNow()
  const zone = useMemo(viewerZone, [])
  const search = new URLSearchParams(useSearch())
  const openId = search.get('c')

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          -byTime(
            { at: a.derived.lastActivityAt, id: a.candidate.id },
            { at: b.derived.lastActivityAt, id: b.candidate.id },
          ),
      ),
    [rows],
  )

  const openSubmission = (row: Row) => {
    const link = row.derived.submission ?? row.derived.repo
    if (!link || row.derived.stage !== 'submitted') return
    void repo.saveEntry({
      id: newId(),
      candidateId: row.candidate.id,
      kind: 'opened',
      at: new Date().toISOString(),
      url: link.url,
    })
  }

  return (
    <div className="app">
      <header className="top">
        <h1>
          Take-homes <span className="num count">{rows.length}</span>
        </h1>
      </header>
      <main className="panel results">
        {rows.length === 0 ? (
          <div className="empty">
            <p className="empty-title">No candidates</p>
          </div>
        ) : (
          <CandidateTable
            rows={sorted}
            now={now}
            zone={zone}
            selectedId={openId}
            onOpen={(id) => navigate({ c: id })}
            onOpenSubmission={openSubmission}
          />
        )}
      </main>
    </div>
  )
}
