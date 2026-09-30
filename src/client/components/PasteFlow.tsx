import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { parseContacts } from '../../core/contacts'
import { deadlineAt, formatDateTime, zoneName } from '../../core/deadline'
import { type DraftErrors, validateDraft } from '../../core/draft'
import type { ExtractContext, KnownCandidate, Proposal } from '../../core/extract/types'
import { normalizeUrl } from '../../core/links'
import { moveMessage } from '../../core/move'
import { MAX_PASTE, type PasteDraft, pasteDraft, pasteRecords } from '../../core/paste'
import {
  type Candidate,
  type Entry,
  LINK_KINDS,
  type LinkKind,
  type MessageEntry,
  type Source,
} from '../../core/types'
import { newId } from '../lib/time'
import { useLive, useRepo } from '../store/context'
import { CandidateFields, Field } from './CandidateForm'

export type Extractor = (paste: string, ctx: ExtractContext) => Promise<Proposal>

interface Props {
  zone: string
  roles: string[]
  extract: Extractor
  self: ExtractContext['self']
  /** A saved message to move to a new candidate. Only the candidate's fields are asked. */
  moving?: MessageEntry
  onSaved: (candidateId: string) => void
  onCancel: () => void
}

const KIND_LABELS: Record<LinkKind, string> = {
  submission: 'Submission',
  repo: 'Repo',
  doc: 'Take-home doc',
  other: 'Other',
}

const LAST_SOURCE = 'take-home-tracker:last-source'

function lastSource(): Source | null {
  try {
    return (localStorage.getItem(LAST_SOURCE) as Source | null) ?? null
  } catch {
    return null
  }
}

function rememberSource(s: Source) {
  try {
    localStorage.setItem(LAST_SOURCE, s)
  } catch {
    // Private windows can refuse storage. The default source is then iMessage.
  }
}

/** What the matcher knows about each candidate: contacts, and the work links they sent. */
function knownCandidates(candidates: Candidate[], entries: Entry[]): KnownCandidate[] {
  return candidates.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    contacts: c.contacts,
    links: entries.flatMap((e) =>
      e.candidateId === c.id && e.kind === 'message' && e.direction === 'in'
        ? e.links.filter((l) => l.kind === 'submission' || l.kind === 'repo').map((l) => l.url)
        : [],
    ),
  }))
}

/**
 * Sets the target. For a known candidate, the contact field lists only what is new to them,
 * which is exactly what attaching adds. For a new candidate, it lists every contact in the paste.
 */
function withTargetContacts(d: PasteDraft, target: string, candidates: Candidate[]): PasteDraft {
  const all = [...new Set([...(d.proposedContacts ?? parseContacts(d.candidate.contacts))])]
  const known = candidates.find((c) => c.id === target)
  const shown = known ? all.filter((c) => !known.contacts.includes(c)) : all
  return {
    ...d,
    target,
    proposedContacts: all,
    candidate: { ...d.candidate, contacts: shown.join(', ') },
  }
}

export function PasteFlow({ zone, roles, extract, self, moving, onSaved, onCancel }: Props) {
  const repo = useRepo()
  const { candidates, entries } = useLive()
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const [draft, setDraft] = useState<PasteDraft | null>(null)
  const [matchVia, setMatchVia] = useState<{ id: string; via: string } | null>(null)
  const known = useMemo(() => knownCandidates(candidates, entries), [candidates, entries])

  const read = async (paste: string) => {
    if (!paste.trim() || reading) return
    setReading(true)
    const now = Date.now()
    const ctx = { now: new Date(now).toISOString(), zone, candidates: known, self }
    try {
      const p = await extract(paste, ctx)
      setMatchVia(p.match ? { id: p.match.id, via: p.match.via } : null)
      const d = pasteDraft(p, paste, zone, now, lastSource())
      setDraft(moving ? { ...d, target: 'new' } : withTargetContacts(d, d.target, candidates))
    } finally {
      setReading(false)
    }
  }

  // Moving a saved message reads its text at once. There is nothing to paste.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once for the message being moved
  useEffect(() => {
    if (moving) void read(moving.text)
  }, [])

  if (!draft) {
    if (moving) return null
    return (
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          void read(text)
        }}
      >
        <div className="form-body">
          <Field label="Message">
            <textarea
              className="paste-input"
              rows={10}
              value={text}
              maxLength={MAX_PASTE}
              placeholder="Paste a text, DM, or email"
              data-autofocus
              onChange={(e) => setText(e.target.value)}
              onPaste={(e) => {
                // A paste into the empty box is read at once. She pasted, so she wants it read.
                const pasted = e.clipboardData.getData('text')
                if (text.trim() || !pasted.trim()) return
                e.preventDefault()
                setText(pasted.slice(0, MAX_PASTE))
                void read(pasted)
              }}
            />
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="control" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="control primary" disabled={!text.trim() || reading}>
            Read
          </button>
        </div>
      </form>
    )
  }

  const save = (d: PasteDraft) => {
    if (moving) {
      const from = candidates.find((c) => c.id === moving.candidateId)
      if (!from) return
      const { candidate } = pasteRecords(
        { ...d, target: 'new' },
        zone,
        null,
        { candidate: newId(), entry: moving.id },
        Date.now(),
      )
      const { save: records, remove } = moveMessage(moving, from, candidate, entries)
      void repo.saveAll(records).then(() => Promise.all(remove.map((c) => repo.deleteCandidate(c))))
      onSaved(candidate.id)
      return
    }
    const existing = candidates.find((c) => c.id === d.target) ?? null
    const { candidate, entry } = pasteRecords(
      d,
      zone,
      existing,
      { candidate: newId(), entry: newId() },
      Date.now(),
    )
    rememberSource(candidate.source)
    void repo.saveAll([candidate, entry])
    onSaved(candidate.id)
  }

  return (
    <Confirm
      draft={draft}
      setDraft={setDraft}
      moving={Boolean(moving)}
      candidates={candidates}
      matchVia={matchVia}
      zone={zone}
      roles={roles}
      onBack={() => setDraft(null)}
      onSave={save}
    />
  )
}

interface ConfirmProps {
  draft: PasteDraft
  setDraft: (d: PasteDraft) => void
  moving: boolean
  candidates: Candidate[]
  matchVia: { id: string; via: string } | null
  zone: string
  roles: string[]
  onBack: () => void
  onSave: (d: PasteDraft) => void
}

function Confirm({
  draft,
  setDraft,
  moving,
  candidates,
  matchVia,
  zone,
  roles,
  onBack,
  onSave,
}: ConfirmProps) {
  const [errors, setErrors] = useState<DraftErrors>({})
  const [linkErrors, setLinkErrors] = useState<number[]>([])
  const [whenError, setWhenError] = useState<string | null>(null)
  const [applyDue, setApplyDue] = useState(true)
  const isNew = draft.target === 'new'
  const target = candidates.find((c) => c.id === draft.target)
  const sorted = useMemo(
    () =>
      [...candidates].sort((a, b) =>
        a.id === matchVia?.id ? -1 : b.id === matchVia?.id ? 1 : a.name.localeCompare(b.name),
      ),
    [candidates, matchVia],
  )
  const set = (patch: Partial<PasteDraft>) => setDraft({ ...draft, ...patch })
  const setLink = (i: number, patch: Partial<PasteDraft['links'][number]>) =>
    set({ links: draft.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const found = isNew ? validateDraft(draft.candidate) : {}
    const badLinks = draft.links.flatMap((l, i) => (normalizeUrl(l.url) ? [] : [i]))
    const missing = !draft.messageDate ? 'Date needed' : !draft.messageTime ? 'Time needed' : null
    setErrors(found)
    setLinkErrors(badLinks)
    setWhenError(missing)
    if (Object.keys(found).length > 0 || badLinks.length > 0 || missing) return
    onSave(isNew || applyDue ? draft : { ...draft, dueDate: '', dueTime: '' })
  }

  const who = isNew ? draft.candidate.name || 'Candidate' : (target?.name ?? 'Candidate')
  const due = draft.dueDate ? deadlineAt(draft.dueDate, draft.dueTime || null, draft.dueZone) : null

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form-body thin-scroll">
        <fieldset hidden={moving}>
          <legend className="visually-hidden">Attach</legend>
          <Field label="Attach to">
            <select
              value={draft.target}
              onChange={(e) => setDraft(withTargetContacts(draft, e.target.value, candidates))}
            >
              <option value="new">New candidate</option>
              {sorted.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {matchVia && draft.target === matchVia.id && (
            <output className="readout num" aria-label="Matched on">
              {matchVia.via}
            </output>
          )}
        </fieldset>
        {isNew && (
          <CandidateFields
            draft={draft.candidate}
            setDraft={(next) =>
              setDraft({
                ...draft,
                candidate: typeof next === 'function' ? next(draft.candidate) : next,
              })
            }
            errors={errors}
            mode="paste"
            zone={zone}
            roles={roles}
          />
        )}
        <fieldset hidden={moving}>
          <legend>MESSAGE</legend>
          <Field label="From">
            <select
              value={draft.direction}
              onChange={(e) => set({ direction: e.target.value as 'in' | 'out' })}
            >
              <option value="in">{who}</option>
              <option value="out">Me</option>
            </select>
          </Field>
          <div className="field-row">
            <Field label="Sent at" error={whenError ?? undefined}>
              <input
                type="date"
                value={draft.messageDate}
                onChange={(e) => set({ messageDate: e.target.value })}
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={draft.messageTime}
                onChange={(e) => set({ messageTime: e.target.value })}
              />
            </Field>
          </div>
          {draft.links.map((l, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place, and the url changes as she types
            <div className="link-row" key={i}>
              <Field label="Link" error={linkErrors.includes(i) ? 'Not a web link' : undefined}>
                <input
                  value={l.url}
                  inputMode="url"
                  autoComplete="off"
                  onChange={(e) => setLink(i, { url: e.target.value })}
                />
              </Field>
              <Field label="Kind">
                <select
                  value={l.kind}
                  onChange={(e) => setLink(i, { kind: e.target.value as LinkKind })}
                >
                  {LINK_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                className="text-button link-remove"
                onClick={() => set({ links: draft.links.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="actions">
            <button
              type="button"
              className="control small"
              onClick={() => set({ links: [...draft.links, { url: '', kind: 'submission' }] })}
            >
              Add link
            </button>
          </div>
          {draft.direction === 'in' && (
            <label className="option">
              <input
                className="option-check"
                type="checkbox"
                checked={draft.needsReply}
                onChange={(e) => set({ needsReply: e.target.checked })}
              />
              <span className="option-label">Needs reply</span>
            </label>
          )}
        </fieldset>
        {!isNew && target && (
          <fieldset>
            <legend>{`ADDS TO ${target.name.toUpperCase()}`}</legend>
            <Field label="Contact">
              <input
                value={draft.candidate.contacts}
                placeholder="Email, handle, or phone"
                autoComplete="off"
                onChange={(e) =>
                  set({ candidate: { ...draft.candidate, contacts: e.target.value } })
                }
              />
            </Field>
          </fieldset>
        )}
        {!isNew && due && (
          <fieldset>
            <legend>DEADLINE</legend>
            <label className="option">
              <input
                className="option-check"
                type="checkbox"
                checked={applyDue}
                onChange={(e) => setApplyDue(e.target.checked)}
              />
              <span className="option-label">
                Set to{' '}
                <span className="num">
                  {formatDateTime(due.at, zone)} {zoneName(due.at, zone)}
                </span>
              </span>
            </label>
          </fieldset>
        )}
        <fieldset hidden={moving}>
          <legend>PASTED</legend>
          <pre className="paste-text">{draft.text}</pre>
        </fieldset>
      </div>
      <div className="form-actions">
        <button type="button" className="control" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="control primary">
          Save
        </button>
      </div>
    </form>
  )
}
