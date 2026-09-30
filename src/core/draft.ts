import { parseContacts } from './contacts'
import { deadlineAt, instantIn, localParts } from './deadline'
import { normalizeUrl } from './links'
import type { Candidate, Link, MessageEntry, Source } from './types'

/** What the candidate form edits. Every field is text, as the inputs hold it. */
export interface CandidateDraft {
  name: string
  role: string
  source: Source
  contacts: string
  takeHomeUrl: string
  sentDate: string
  sentTime: string
  dueDate: string
  dueTime: string
  dueZone: string
  notes: string
  /** Only when adding: a submission that already came in. */
  submissionUrl: string
  repoUrl: string
  submittedDate: string
  submittedTime: string
}

export type DraftErrors = Partial<Record<keyof CandidateDraft, string>>

export function emptyDraft(zone: string, now: number): CandidateDraft {
  const sent = localParts(new Date(now).toISOString(), zone)
  return {
    name: '',
    role: '',
    source: 'imessage',
    contacts: '',
    takeHomeUrl: '',
    sentDate: sent.date,
    sentTime: sent.time,
    dueDate: '',
    dueTime: '',
    dueZone: zone,
    notes: '',
    submissionUrl: '',
    repoUrl: '',
    submittedDate: '',
    submittedTime: '',
  }
}

export function draftFromCandidate(c: Candidate, zone: string): CandidateDraft {
  const sent = c.sentAt ? localParts(c.sentAt, zone) : { date: '', time: '' }
  const dueZone = c.deadline?.zone ?? zone
  const due = c.deadline ? localParts(c.deadline.at, dueZone) : { date: '', time: '' }
  return {
    ...emptyDraft(zone, Date.now()),
    name: c.name,
    role: c.role,
    source: c.source,
    contacts: c.contacts.join(', '),
    takeHomeUrl: c.takeHomeUrl,
    sentDate: sent.date,
    sentTime: sent.time,
    dueDate: due.date,
    dueTime: c.deadline?.dateOnly ? '' : due.time,
    dueZone,
    notes: c.notes,
  }
}

function optionalUrl(raw: string): string | null | undefined {
  if (raw.trim() === '') return undefined
  return normalizeUrl(raw)
}

export function validateDraft(d: CandidateDraft): DraftErrors {
  const errors: DraftErrors = {}
  if (d.name.trim() === '') errors.name = 'Required'
  for (const key of ['takeHomeUrl', 'submissionUrl', 'repoUrl'] as const) {
    if (optionalUrl(d[key]) === null) errors[key] = 'Not a web link'
  }
  if (d.sentTime && !d.sentDate) errors.sentDate = 'Date needed'
  if (d.dueTime && !d.dueDate) errors.dueDate = 'Date needed'
  if (d.submittedTime && !d.submittedDate) errors.submittedDate = 'Date needed'
  // A guessed time could make Late wrong, so a submission date needs its time.
  if (d.submittedDate && !d.submittedTime) errors.submittedTime = 'Time needed'
  return errors
}

/** The instant of a date and an optional time in `zone`. A missing time means noon, which only the sent time can have. */
function instantOf(date: string, time: string, zone: string): string | null {
  if (!date) return null
  return instantIn(date, time || '12:00', zone)
}

/**
 * The candidate that a draft describes. When editing, pass the saved candidate as `base`.
 * A date or time the form did not change keeps its exact saved instant, because a wall-clock
 * time in the hour that repeats when clocks go back names two instants (D8).
 */
export function candidateFromDraft(
  d: CandidateDraft,
  zone: string,
  base: Pick<Candidate, 'id' | 'createdAt'> & Partial<Candidate>,
): Candidate {
  const before = base.name !== undefined ? draftFromCandidate(base as Candidate, zone) : null
  const sentSame = before && before.sentDate === d.sentDate && before.sentTime === d.sentTime
  const dueSame =
    before &&
    before.dueDate === d.dueDate &&
    before.dueTime === d.dueTime &&
    before.dueZone === d.dueZone
  return {
    id: base.id,
    createdAt: base.createdAt,
    name: d.name.trim(),
    role: d.role.trim(),
    source: d.source,
    contacts: parseContacts(d.contacts),
    takeHomeUrl: optionalUrl(d.takeHomeUrl) ?? '',
    sentAt: sentSame ? (base.sentAt ?? null) : instantOf(d.sentDate, d.sentTime, zone),
    deadline: dueSame
      ? (base.deadline ?? null)
      : d.dueDate
        ? deadlineAt(d.dueDate, d.dueTime || null, d.dueZone)
        : null,
    notes: d.notes,
  }
}

/** The submission that came in before she added the candidate, if the form has one. */
export function submissionFromDraft(
  d: CandidateDraft,
  zone: string,
  candidate: Candidate,
  id: string,
  now: number,
): MessageEntry | null {
  const links: Link[] = []
  const sub = optionalUrl(d.submissionUrl)
  const repo = optionalUrl(d.repoUrl)
  if (sub) links.push({ url: sub, kind: 'submission' })
  if (repo) links.push({ url: repo, kind: 'repo' })
  if (links.length === 0) return null
  return {
    id,
    candidateId: candidate.id,
    kind: 'message',
    at: instantOf(d.submittedDate, d.submittedTime, zone) ?? new Date(now).toISOString(),
    direction: 'in',
    text: '',
    source: candidate.source,
    links,
    needsReply: false,
  }
}
