import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { formatDateTime, instantIn, localParts, relative, zoneName } from '../../core/deadline'
import { type CandidateDraft, candidateFromDraft, draftFromCandidate } from '../../core/draft'
import { normalizeUrl, shortUrl } from '../../core/links'
import {
  type Entry,
  type LinkKind,
  SOURCE_LABELS,
  STAGE_LABELS,
  STAGES,
  type Stage,
} from '../../core/types'
import { newId } from '../lib/time'
import type { Row } from '../store/context'
import { useRepo } from '../store/context'
import { CandidateForm } from './CandidateForm'
import { SheetHeader } from './Sheet'

interface Props {
  row: Row
  entries: Entry[]
  now: number
  zone: string
  roles: string[]
  onClose: () => void
  onOpenSubmission: (row: Row) => void
  onDeleted: () => void
}

export function DetailPanel({
  row,
  entries,
  now,
  zone,
  roles,
  onClose,
  onOpenSubmission,
  onDeleted,
}: Props) {
  const repo = useRepo()
  const c = row.candidate
  const [editing, setEditing] = useState(false)
  const [addingLink, setAddingLink] = useState(false)

  if (editing) {
    const save = (draft: CandidateDraft) => {
      void repo.saveCandidate(candidateFromDraft(draft, zone, c))
      setEditing(false)
    }
    return (
      <>
        <SheetHeader title={`Edit ${c.name}`} onClose={() => setEditing(false)} />
        <CandidateForm
          mode="edit"
          initial={draftFromCandidate(c, zone)}
          zone={zone}
          roles={roles}
          submitLabel="Save"
          onSubmit={save}
          onCancel={() => setEditing(false)}
        />
      </>
    )
  }

  const setStage = (stage: Stage) => {
    if (stage === row.derived.stage) return
    void repo.saveEntry({
      id: newId(),
      candidateId: c.id,
      kind: 'stage',
      at: new Date().toISOString(),
      stage,
    })
  }

  return (
    <>
      <SheetHeader
        title={c.name}
        sub={[c.role, SOURCE_LABELS[c.source]].filter(Boolean).join(' · ')}
        onClose={onClose}
      />
      <div className="detail thin-scroll">
        <StageControl stage={row.derived.stage} onChange={setStage} />
        <Facts row={row} now={now} zone={zone} onOpenSubmission={onOpenSubmission} />
        <div className="actions">
          <button type="button" className="control" onClick={() => setAddingLink(true)}>
            Add link
          </button>
          <button type="button" className="control" onClick={() => setEditing(true)}>
            Edit
          </button>
          <DeleteButton
            name={c.name}
            onConfirm={() => void repo.deleteCandidate(c).then(onDeleted)}
          />
        </div>
        {addingLink && <LinkFields candidate={c} zone={zone} onDone={() => setAddingLink(false)} />}
        <Notes
          key={c.id}
          value={c.notes}
          onSave={(notes) => void repo.saveCandidate({ ...c, notes })}
        />
        <Timeline row={row} entries={entries} zone={zone} onOpenSubmission={onOpenSubmission} />
      </div>
    </>
  )
}

function StageControl({ stage, onChange }: { stage: Stage; onChange: (s: Stage) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Stage">
      {STAGES.map((s) => (
        // biome-ignore lint/a11y/useSemanticElements: a segmented control of buttons
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={s === stage}
          className="seg-item"
          data-stage={s}
          onClick={() => onChange(s)}
        >
          {STAGE_LABELS[s]}
        </button>
      ))}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function When({ iso, zone, now }: { iso: string | null; zone: string; now: number }) {
  if (!iso) return <span className="muted">None</span>
  return (
    <span className="num">
      {formatDateTime(iso, zone)} {zoneName(iso, zone)} · {relative(iso, now)}
    </span>
  )
}

function LinkOut({ url, onClick }: { url: string; onClick?: () => void }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="truncate" onClick={onClick}>
      {shortUrl(url)}
    </a>
  )
}

function Facts({
  row,
  now,
  zone,
  onOpenSubmission,
}: {
  row: Row
  now: number
  zone: string
  onOpenSubmission: (row: Row) => void
}) {
  const c = row.candidate
  const { submission, repo } = row.derived
  const d = c.deadline
  const none = <span className="muted">None</span>
  return (
    <dl className="facts">
      <Fact label="Deadline">
        {d ? (
          <span className="stack">
            <When iso={d.at} zone={zone} now={now} />
            {zoneName(d.at, d.zone) !== zoneName(d.at, zone) && (
              <span className="num muted">
                {formatDateTime(d.at, d.zone)} {zoneName(d.at, d.zone)}
              </span>
            )}
          </span>
        ) : (
          none
        )}
      </Fact>
      <Fact label="Sent">
        <When iso={c.sentAt} zone={zone} now={now} />
      </Fact>
      <Fact label="Submitted">
        <When iso={row.derived.submittedAt} zone={zone} now={now} />
      </Fact>
      <Fact label="Submission">
        {submission ? <LinkOut url={submission.url} onClick={() => onOpenSubmission(row)} /> : none}
      </Fact>
      <Fact label="Repo">
        {repo ? <LinkOut url={repo.url} onClick={() => onOpenSubmission(row)} /> : none}
      </Fact>
      <Fact label="Take-home">{c.takeHomeUrl ? <LinkOut url={c.takeHomeUrl} /> : none}</Fact>
      <Fact label="Contact">
        {c.contacts.length > 0 ? <span className="num">{c.contacts.join(', ')}</span> : none}
      </Fact>
    </dl>
  )
}

function DeleteButton({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" className="control" onClick={() => setAsking(true)}>
        Delete
      </button>
    )
  }
  return (
    <>
      <button type="button" className="control danger" onClick={onConfirm}>
        Delete {name}
      </button>
      <button type="button" className="control" onClick={() => setAsking(false)}>
        Keep
      </button>
    </>
  )
}

/** Adds a submission or repo link by hand, with the time it came in. */
function LinkFields({
  candidate,
  zone,
  onDone,
}: {
  candidate: Row['candidate']
  zone: string
  onDone: () => void
}) {
  const repo = useRepo()
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<LinkKind>('submission')
  const [when, setWhen] = useState(() => localParts(new Date().toISOString(), zone))
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const normalized = normalizeUrl(url)
    if (!normalized) {
      setError('Not a web link')
      return
    }
    void repo.saveEntry({
      id: newId(),
      candidateId: candidate.id,
      kind: 'message',
      at: instantIn(when.date, when.time, zone),
      direction: 'in',
      text: '',
      source: candidate.source,
      links: [{ url: normalized, kind }],
      needsReply: false,
    })
    onDone()
  }

  return (
    <form className="inline-form" onSubmit={submit} noValidate aria-label="Add a link">
      <label className="field" data-invalid={error ? true : undefined}>
        <span className="field-label">
          Link
          {error && <span className="field-error">{error}</span>}
        </span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          autoComplete="off"
          // biome-ignore lint/a11y/noAutofocus: she just asked for this field
          autoFocus
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as LinkKind)}>
            <option value="submission">Submission</option>
            <option value="repo">Repo</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Came in</span>
          <input
            type="date"
            value={when.date}
            onChange={(e) => setWhen({ ...when, date: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">Time</span>
          <input
            type="time"
            value={when.time}
            onChange={(e) => setWhen({ ...when, time: e.target.value })}
          />
        </label>
      </div>
      <div className="actions">
        <button type="submit" className="control primary">
          Add link
        </button>
        <button type="button" className="control" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** Saves while she types, and once more when the panel closes, so no close path loses a note. */
function Notes({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  const saved = useRef(value)
  const latest = useRef({ text, onSave })
  latest.current = { text, onSave }

  useEffect(() => {
    if (text === saved.current) return
    const t = window.setTimeout(() => {
      saved.current = text
      latest.current.onSave(text)
    }, 500)
    return () => window.clearTimeout(t)
  }, [text])

  useEffect(
    () => () => {
      const { text: last, onSave: save } = latest.current
      if (last !== saved.current) {
        saved.current = last
        save(last)
      }
    },
    [],
  )

  return (
    <label className="field">
      <span className="field-label">Notes</span>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
    </label>
  )
}

/** Removes one timeline entry, such as a wrong link. The second click confirms. */
function RemoveEntry({ entry }: { entry: Entry }) {
  const repo = useRepo()
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" className="text-button" onClick={() => setAsking(true)}>
        Remove
      </button>
    )
  }
  return (
    <span className="timeline-confirm">
      <button
        type="button"
        className="text-button strong"
        onClick={() => void repo.deleteEntry(entry)}
      >
        Confirm remove
      </button>
      <button type="button" className="text-button" onClick={() => setAsking(false)}>
        Keep
      </button>
    </span>
  )
}

interface Item {
  id: string
  at: string
  label: string
  body?: ReactNode
  /** The entry behind the item. The "Added" and "Take-home sent" items have none. */
  entry?: Entry
}

function entryItem(e: Entry, onOpenSubmission: () => void): Item {
  switch (e.kind) {
    case 'message': {
      const links = e.links.length > 0 && (
        <span className="stack">
          {e.links.map((l) => (
            <span key={l.url} className="timeline-link">
              <span className="muted">
                {l.kind === 'repo' ? 'Repo' : l.kind === 'submission' ? 'Submission' : 'Link'}
              </span>
              <LinkOut url={l.url} onClick={l.kind === 'other' ? undefined : onOpenSubmission} />
            </span>
          ))}
        </span>
      )
      return {
        id: e.id,
        at: e.at,
        label: e.direction === 'in' ? 'From candidate' : 'To candidate',
        body: (
          <>
            {e.text && <p className="message">{e.text}</p>}
            {links}
          </>
        ),
      }
    }
    case 'stage':
      return { id: e.id, at: e.at, label: `Stage set to ${STAGE_LABELS[e.stage]}` }
    case 'opened':
      return { id: e.id, at: e.at, label: 'Opened submission' }
    case 'replied':
      return { id: e.id, at: e.at, label: 'Replied' }
  }
}

function Timeline({
  row,
  entries,
  zone,
  onOpenSubmission,
}: {
  row: Row
  entries: Entry[]
  zone: string
  onOpenSubmission: (row: Row) => void
}) {
  const c = row.candidate
  const items: Item[] = entries
    .filter((e) => e.candidateId === c.id)
    .map((e) => ({ ...entryItem(e, () => onOpenSubmission(row)), entry: e }))
  items.push({ id: 'added', at: c.createdAt, label: 'Added' })
  if (c.sentAt) items.push({ id: 'sent', at: c.sentAt, label: 'Take-home sent' })
  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? 1 : -1))
  return (
    <section className="timeline" aria-label="Timeline">
      <h3 className="section-label">TIMELINE</h3>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <span className="timeline-head">
              <span className="num muted timeline-time">{formatDateTime(item.at, zone)}</span>
              {item.entry && <RemoveEntry entry={item.entry} />}
            </span>
            <span className="timeline-label">{item.label}</span>
            {item.body}
          </li>
        ))}
      </ol>
    </section>
  )
}
