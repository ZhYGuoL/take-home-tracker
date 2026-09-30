import { useMemo } from 'react'
import { byTime } from '../core/derive'
import {
  type CandidateDraft,
  candidateFromDraft,
  emptyDraft,
  submissionFromDraft,
} from '../core/draft'
import type { Entry } from '../core/types'
import { CandidateForm } from './components/CandidateForm'
import { CandidateTable } from './components/CandidateTable'
import { DetailPanel } from './components/DetailPanel'
import { Sheet, SheetHeader } from './components/Sheet'
import { newId, useNow, viewerZone } from './lib/time'
import { close, navigate, useSearch } from './lib/url'
import { type Row, useLive, useRepo, useRows } from './store/context'

export function App() {
  const repo = useRepo()
  const rows = useRows()
  const { entries } = useLive()
  const now = useNow()
  const zone = useMemo(viewerZone, [])
  const search = new URLSearchParams(useSearch())
  const openId = search.get('c')
  const adding = search.get('new') === '1'
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
        <button type="button" className="control primary" onClick={() => navigate({ new: '1' })}>
          Add
        </button>
      </header>
      <main className="panel results">
        {rows.length === 0 ? (
          <div className="empty">
            <p className="empty-title">No candidates</p>
            <button type="button" className="control" onClick={() => navigate({ new: '1' })}>
              Add candidate
            </button>
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
        <Sheet label="Add candidate" variant="dialog" onClose={() => close('new')}>
          <SheetHeader title="Add candidate" onClose={() => close('new')} />
          <CandidateForm
            mode="add"
            initial={emptyDraft(zone, now)}
            zone={zone}
            roles={roles}
            submitLabel="Add"
            onSubmit={add}
            onCancel={() => close('new')}
          />
        </Sheet>
      )}
    </div>
  )
}
