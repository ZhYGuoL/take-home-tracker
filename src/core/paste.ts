import { parseContacts } from './contacts'
import { deadlineAt, instantIn, localParts } from './deadline'
import { type CandidateDraft, candidateFromDraft, emptyDraft } from './draft'
import type { Proposal } from './extract/types'
import { normalizeUrl } from './links'
import type { Applied, Candidate, Link, MessageEntry, Source } from './types'

/** The confirm step after a paste. Every field is what she sees and can change. */
export interface PasteDraft {
  /** "new", or the id of the candidate the message attaches to. */
  target: string
  /** The new candidate's fields. Used only when `target` is "new". */
  candidate: CandidateDraft
  direction: 'in' | 'out'
  messageDate: string
  messageTime: string
  links: Link[]
  needsReply: boolean
  /** Exactly what she pasted. It goes on the timeline. */
  text: string
  /** Every contact the paste shows, kept while she switches the target. */
  proposedContacts?: string[]
  /** A deadline the paste states. When attaching, it replaces the candidate's deadline. */
  dueDate: string
  dueTime: string
  dueZone: string
}

export const MAX_PASTE = 20_000

const isSubmission = (p: Proposal) =>
  p.direction === 'in' && p.links.some((l) => l.kind === 'submission' || l.kind === 'repo')

export function pasteDraft(
  p: Proposal,
  paste: string,
  zone: string,
  now: number,
  source: Source | null,
): PasteDraft {
  const at = p.messageAt ?? new Date(now).toISOString()
  const when = localParts(at, zone)
  const dueZone = p.deadline?.zone ?? zone
  const due = p.deadline ? localParts(p.deadline.at, dueZone) : { date: '', time: '' }
  const doc = p.links.find((l) => l.kind === 'doc')
  const outbound = p.direction === 'out'
  return {
    // A first name alone is not enough to attach. It stays first in her list instead.
    target: p.match?.strength === 'strong' ? p.match.id : 'new',
    candidate: {
      ...emptyDraft(zone, now),
      name: p.name ?? '',
      role: p.role ?? '',
      source: p.source ?? source ?? 'imessage',
      contacts: p.contacts.join(', '),
      takeHomeUrl: doc?.url ?? '',
      // She sent the take-home when she sent this message. An inbound first message does not say.
      sentDate: outbound ? when.date : '',
      sentTime: outbound ? when.time : '',
      dueDate: due.date,
      dueTime: p.deadline?.dateOnly ? '' : due.time,
      dueZone,
    },
    direction: p.direction,
    messageDate: when.date,
    // A submission with no time in the paste waits for her to say when it came in, because a
    // guessed time could make Late wrong. Other messages default to now.
    messageTime: !p.messageAt && isSubmission(p) ? '' : when.time,
    links: p.links,
    needsReply: p.needsReply,
    text: paste.slice(0, MAX_PASTE),
    dueDate: due.date,
    dueTime: p.deadline?.dateOnly ? '' : due.time,
    dueZone,
  }
}

export interface PasteResult {
  /** The candidate to save: new, or the existing one with what the paste added. */
  candidate: Candidate
  entry: MessageEntry
}

/**
 * The records a confirmed paste saves. Attaching adds new contacts, fills an empty
 * take-home link, and applies a deadline the paste states. It never touches the stage (D9).
 */
export function pasteRecords(
  d: PasteDraft,
  zone: string,
  existing: Candidate | null,
  ids: { candidate: string; entry: string },
  now: number,
): PasteResult {
  const links = d.links.flatMap((l) => {
    const url = normalizeUrl(l.url)
    return url ? [{ url, kind: l.kind }] : []
  })
  let candidate: Candidate
  let applied: Applied | undefined
  if (existing) {
    const doc = links.find((l) => l.kind === 'doc')
    const contacts = parseContacts(d.candidate.contacts).filter(
      (c) => !existing.contacts.includes(c),
    )
    const takeHomeUrl = !existing.takeHomeUrl && doc ? doc.url : null
    const deadline = d.dueDate ? deadlineAt(d.dueDate, d.dueTime || null, d.dueZone) : null
    applied = {
      contacts,
      takeHomeUrl,
      deadline: deadline ? { before: existing.deadline, after: deadline } : null,
    }
    candidate = {
      ...existing,
      contacts: [...existing.contacts, ...contacts],
      takeHomeUrl: takeHomeUrl ?? existing.takeHomeUrl,
      deadline: deadline ?? existing.deadline,
    }
  } else {
    candidate = {
      ...candidateFromDraft(d.candidate, zone, {
        id: ids.candidate,
        createdAt: new Date(now).toISOString(),
      }),
      createdFrom: ids.entry,
    }
  }
  const at =
    d.messageDate && d.messageTime
      ? instantIn(d.messageDate, d.messageTime, zone)
      : new Date(now).toISOString()
  return {
    candidate,
    entry: {
      id: ids.entry,
      candidateId: candidate.id,
      kind: 'message',
      at,
      direction: d.direction,
      text: d.text,
      source: candidate.source,
      links,
      needsReply: d.direction === 'in' && d.needsReply,
      ...(applied ? { applied } : {}),
    },
  }
}
