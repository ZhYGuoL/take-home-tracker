import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  formatDateTime,
  formatDeadline,
  instantIn,
  localParts,
  relative,
  zoneName,
} from '../../core/deadline'
import {
  type CandidateDraft,
  candidateFromDraft,
  draftFromCandidate,
  whenProblem,
} from '../../core/draft'
import { normalizeUrl, shortUrl } from '../../core/links'
import { moveMessage } from '../../core/move'
import {
  type Entry,
  type LinkKind,
  MAX_TEXT,
  type MessageEntry,
  SOURCE_LABELS,
  STAGE_LABELS,
  STAGES,
  type Stage,
} from '../../core/types'
import { newId } from '../lib/time'
import { navigate } from '../lib/url'
import type { Row } from '../store/context'
import { useLive, useRepo } from '../store/context'
import { FlagBadges } from './Badges'
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
  const [adding, setAdding] = useState<'link' | 'message' | null>(null)

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

  // A reply comes after the message it answers, even one she dated in the future by mistake.
  const markReplied = () => {
    const latest = entries
      .filter((e) => e.candidateId === c.id && e.kind === 'message')
      .reduce((max, e) => Math.max(max, Date.parse(e.at) + 1), 0)
    void repo.saveEntry({
      id: newId(),
      candidateId: c.id,
      kind: 'replied',
      at: new Date(Math.max(Date.now(), latest)).toISOString(),
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
        <FlagBadges flags={row.flags} />
        <Facts row={row} now={now} zone={zone} onOpenSubmission={onOpenSubmission} />
        <div className="actions">
          {row.flags.needsReply && (
            <button type="button" className="control primary" onClick={markReplied}>
              Replied
            </button>
          )}
          <button type="button" className="control" onClick={() => setAdding('message')}>
            Add message
          </button>
          <button type="button" className="control" onClick={() => setAdding('link')}>
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
        {adding === 'link' && (
          <LinkFields candidate={c} zone={zone} onDone={() => setAdding(null)} />
        )}
        {adding === 'message' && (
          <MessageFields candidate={c} zone={zone} onDone={() => setAdding(null)} />
        )}
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

/**
 * A toolbar of buttons, one per stage. Arrow keys move focus only. A stage changes only when
 * she presses a button, so no key press can reach Advanced or Passed by accident (D9).
 */
function StageControl({ stage, onChange }: { stage: Stage; onChange: (s: Stage) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const [focused, setFocused] = useState(() => STAGES.indexOf(stage))

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: focused + 1,
      ArrowDown: focused + 1,
      ArrowLeft: focused - 1,
      ArrowUp: focused - 1,
      Home: 0,
      End: STAGES.length - 1,
    }
    const target = moves[e.key]
    if (target === undefined) return
    e.preventDefault()
    const next = (target + STAGES.length) % STAGES.length
    setFocused(next)
    refs.current[next]?.focus()
  }

  return (
    <div className="seg" role="toolbar" aria-label="Stage" onKeyDown={onKeyDown}>
      {STAGES.map((s, i) => (
        <button
          key={s}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          aria-pressed={s === stage}
          tabIndex={i === focused ? 0 : -1}
          className="seg-item"
          data-stage={s}
          onFocus={() => setFocused(i)}
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

/** A time on one line and how long ago on the next, as in the table, so no line breaks inside. */
function When({ iso, zone, now }: { iso: string | null; zone: string; now: number }) {
  if (!iso) return <span className="muted">None</span>
  return (
    <span className="stack">
      <span className="num">
        {formatDateTime(iso, zone)} {zoneName(iso, zone)}
      </span>
      <span className="num muted">{relative(iso, now)}</span>
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
        {d?.dateOnly ? (
          <span className="stack">
            <span className="num">{formatDeadline(d, zone)}</span>
            <span className="num muted">{relative(d.at, now)}</span>
          </span>
        ) : d ? (
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
      <button type="button" className="control primary" onClick={onConfirm}>
        Delete {name}
      </button>
      <button type="button" className="control" onClick={() => setAsking(false)}>
        Keep
      </button>
    </>
  )
}

/**
 * The instant of the date and time fields. When she left them as shown, it is the exact
 * current instant, so two entries saved in the same minute keep their order.
 */
function instantOrNow(
  when: { date: string; time: string },
  shown: { date: string; time: string },
  zone: string,
): string {
  if (when.date === shown.date && when.time === shown.time) return new Date().toISOString()
  return instantIn(when.date, when.time, zone)
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
  const [shown] = useState(when)
  const [error, setError] = useState<string | null>(null)
  const [whenError, setWhenError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const normalized = normalizeUrl(url)
    const missing = whenProblem(when.date, when.time, zone, Date.now())
    setError(normalized ? null : 'Not a web link')
    setWhenError(missing)
    if (!normalized || missing) return
    void repo.saveEntry({
      id: newId(),
      candidateId: candidate.id,
      kind: 'message',
      at: instantOrNow(when, shown, zone),
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
      <label className="field">
        <span className="field-label">Kind</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as LinkKind)}>
          <option value="submission">Submission</option>
          <option value="repo">Repo</option>
        </select>
      </label>
      <div className="field-row">
        <label className="field" data-invalid={whenError ? true : undefined}>
          <span className="field-label">
            Came in
            {whenError && <span className="field-error">{whenError}</span>}
          </span>
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

/** Logs a message by hand: what the candidate sent, or what she sent them. */
function MessageFields({
  candidate,
  zone,
  onDone,
}: {
  candidate: Row['candidate']
  zone: string
  onDone: () => void
}) {
  const repo = useRepo()
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [text, setText] = useState('')
  const [needsReply, setNeedsReply] = useState(true)
  const [when, setWhen] = useState(() => localParts(new Date().toISOString(), zone))
  const [shown] = useState(when)

  const [whenError, setWhenError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const missing = whenProblem(when.date, when.time, zone, Date.now())
    setWhenError(missing)
    if (missing) return
    void repo.saveEntry({
      id: newId(),
      candidateId: candidate.id,
      kind: 'message',
      at: instantOrNow(when, shown, zone),
      direction,
      text: text.trim(),
      source: candidate.source,
      links: [],
      needsReply: direction === 'in' && needsReply,
    })
    onDone()
  }

  return (
    <form className="inline-form" onSubmit={submit} noValidate aria-label="Add a message">
      <label className="field">
        <span className="field-label">From</span>
        <select value={direction} onChange={(e) => setDirection(e.target.value as 'in' | 'out')}>
          <option value="in">{candidate.name}</option>
          <option value="out">Me</option>
        </select>
      </label>
      <div className="field-row">
        <label className="field" data-invalid={whenError ? true : undefined}>
          <span className="field-label">
            Date
            {whenError && <span className="field-error">{whenError}</span>}
          </span>
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
      <label className="field">
        <span className="field-label">Message</span>
        <textarea
          rows={3}
          maxLength={MAX_TEXT}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // biome-ignore lint/a11y/noAutofocus: she just asked for this field
          autoFocus
        />
      </label>
      {direction === 'in' && (
        <label className="option">
          <input
            className="option-check"
            type="checkbox"
            checked={needsReply}
            onChange={(e) => setNeedsReply(e.target.checked)}
          />
          <span className="option-label">Needs reply</span>
        </label>
      )}
      <div className="actions">
        <button type="submit" className="control primary">
          Add message
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
      <textarea
        rows={3}
        maxLength={MAX_TEXT}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </label>
  )
}

/** Moves a message that went to the wrong candidate. Picking the right one is the whole fix. */
function MoveEntry({ entry }: { entry: MessageEntry }) {
  const repo = useRepo()
  const { candidates, entries } = useLive()
  const [open, setOpen] = useState(false)
  const from = candidates.find((c) => c.id === entry.candidateId)
  const others = candidates
    .filter((c) => c.id !== entry.candidateId)
    .sort((a, b) => a.name.localeCompare(b.name))
  if (!from) return null
  if (!open) {
    return (
      <button type="button" className="text-button" onClick={() => setOpen(true)}>
        Move
      </button>
    )
  }
  const moveTo = (id: string) => {
    if (id === 'new') {
      navigate({ new: '1', move: entry.id })
      return
    }
    const to = candidates.find((c) => c.id === id)
    if (!to) return
    const { save, remove } = moveMessage(entry, from, to, entries)
    void repo.saveAll(save).then(() => Promise.all(remove.map((c) => repo.deleteCandidate(c))))
    if (remove.length > 0) navigate({ c: to.id }, 'replace')
  }
  return (
    <select
      className="move-select"
      aria-label="Move to"
      value=""
      // biome-ignore lint/a11y/noAutofocus: she just asked to move this message
      autoFocus
      onBlur={() => setOpen(false)}
      onChange={(e) => {
        if (e.target.value) moveTo(e.target.value)
      }}
    >
      <option value="">Move to</option>
      <option value="new">New candidate</option>
      {others.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
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
              {item.entry && (
                <span className="timeline-actions">
                  {item.entry.kind === 'message' && <MoveEntry entry={item.entry} />}
                  <RemoveEntry entry={item.entry} />
                </span>
              )}
            </span>
            <span className="timeline-label">{item.label}</span>
            {item.body}
          </li>
        ))}
      </ol>
    </section>
  )
}
