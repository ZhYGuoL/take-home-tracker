import { useMemo } from 'react'
import { type CandidateDraft, candidateFromDraft, submissionFromDraft } from '../core/draft'
import {
  applyFilters,
  countOptions,
  type Filters,
  filtersFromQuery,
  filtersToQuery,
} from '../core/filters'
import { sortRows } from '../core/sort'
import type { Entry } from '../core/types'
import { AddDialog } from './components/AddDialog'
import { CandidateTable } from './components/CandidateTable'
import { DetailPanel } from './components/DetailPanel'
import { EmptyResults } from './components/EmptyResults'
import { FilterBar } from './components/FilterBar'
import { Sheet } from './components/Sheet'
import { makeExtractor } from './lib/extract'
import { useStableOrder } from './lib/order'
import { newId, useNow, viewerZone } from './lib/time'
import { close, navigate, useSearch } from './lib/url'
import { type Row, useLive, useRepo, useRows, useSaveStatus } from './store/context'

const extract = makeExtractor()

export function App() {
  const repo = useRepo()
  const saveStatus = useSaveStatus()
  const { candidates, entries } = useLive()
  // Keyed on the deadline values, so an edit to notes does not restart the clock.
  const deadlineKey = candidates.map((c) => c.deadline?.at ?? '').join('|')
  const deadlines = useMemo(
    () =>
      deadlineKey
        .split('|')
        .filter(Boolean)
        .map((at) => Date.parse(at)),
    [deadlineKey],
  )
  const now = useNow(deadlines)
  const rows = useRows(now)
  const zone = useMemo(viewerZone, [])
  const query = useSearch()
  const search = new URLSearchParams(query)
  const filters = useMemo(() => filtersFromQuery(new URLSearchParams(query)), [query])
  const setFilters = (f: Filters) => navigate(filtersToQuery(f), 'replace')
  const openId = search.get('c')
  const adding = search.get('new') === '1'
  const movingId = search.get('move')
  const moving = entries.find(
    (e): e is Extract<typeof e, { kind: 'message' }> => e.id === movingId && e.kind === 'message',
  )
  const openRow = rows.find((r) => r.candidate.id === openId) ?? null
  const roles = useMemo(
    () => [...new Set(rows.map((r) => r.candidate.role).filter(Boolean))].sort(),
    [rows],
  )

  const add = (draft: CandidateDraft) => {
    const t = Date.now()
    const candidate = candidateFromDraft(draft, zone, {
      id: newId(),
      createdAt: new Date(t).toISOString(),
    })
    const items: Array<typeof candidate | Entry> = [candidate]
    const sub = submissionFromDraft(draft, zone, candidate, newId(), t)
    if (sub) items.push(sub)
    void repo.saveAll(items)
    navigate({ new: null, c: candidate.id }, 'replace')
  }

  const counts = useMemo(() => countOptions(rows, filters, zone), [rows, filters, zone])
  const shown = useMemo(
    () => sortRows(applyFilters(rows, filters, zone), filters.view),
    [rows, filters, zone],
  )

  // A new view or filter sorts again. Her own changes keep rows in place.
  const ordered = useStableOrder(
    shown,
    (r) => r.candidate.id,
    JSON.stringify(filtersToQuery(filters)),
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
        <h1>Take-homes</h1>
        {saveStatus === 'failed' && (
          <span className="save-failed" role="alert">
            Not saved
            <button type="button" className="control small" onClick={() => void repo.retry()}>
              Retry
            </button>
          </span>
        )}
        <button type="button" className="control primary" onClick={() => navigate({ new: '1' })}>
          Add
        </button>
      </header>
      {rows.length > 0 && (
        <FilterBar filters={filters} counts={counts} zone={zone} now={now} onChange={setFilters} />
      )}
      <main className="panel results">
        {rows.length === 0 ? (
          <div className="empty">
            <p className="empty-title">No candidates</p>
            <button type="button" className="control" onClick={() => navigate({ new: '1' })}>
              Add candidate
            </button>
          </div>
        ) : shown.length === 0 ? (
          <EmptyResults rows={rows} filters={filters} zone={zone} onChange={setFilters} />
        ) : (
          <CandidateTable
            rows={ordered}
            now={now}
            zone={zone}
            selectedId={openId}
            onOpen={(id) => navigate({ c: id }, openId ? 'replace' : 'push')}
            onOpenSubmission={openSubmission}
          />
        )}
      </main>
      {openRow && (
        <Sheet
          key={openRow.candidate.id}
          label={openRow.candidate.name}
          variant="drawer"
          onClose={() => close('c')}
        >
          <DetailPanel
            row={openRow}
            entries={entries}
            now={now}
            zone={zone}
            roles={roles}
            onClose={() => close('c')}
            onOpenSubmission={openSubmission}
            onDeleted={() => close('c')}
          />
        </Sheet>
      )}
      {adding && (
        <AddDialog
          zone={zone}
          roles={roles}
          now={now}
          extract={extract}
          self={undefined}
          moving={moving}
          onAddByHand={add}
          onSaved={(id) => navigate({ new: null, move: null, c: id }, 'replace')}
          onClose={() => close('new')}
        />
      )}
    </div>
  )
}
