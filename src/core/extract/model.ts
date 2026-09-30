import { normalizeContact } from '../contacts'
import { normalizeUrl } from '../links'
import { LINK_KINDS, type Link, type LinkKind, SOURCES, type Source } from '../types'
import { matchCandidate } from './match'
import { findUrls } from './text'
import type { ExtractContext, Proposal } from './types'
import { parseClock, parseDeadline, parseStamp } from './when'

/**
 * What the model returns. It copies text out of the paste. The code reads every time and
 * deadline from that text, so the model never does date math (D16).
 */
export interface ModelReading {
  candidate_name: string | null
  candidate_contacts: string[]
  role: string | null
  source: Source | null
  direction: 'in' | 'out'
  /** The message's timestamp exactly as the paste shows it, such as "Oct 2, 9:14 AM". */
  sent_at_text: string | null
  /** The deadline phrase from her own message, such as "by Friday 5pm ET". */
  deadline_text: string | null
  links: Array<{ url: string; kind: LinkKind }>
  needs_reply: boolean
  existing_candidate_id: string | null
}

/** JSON Schema for structured output, so the reply always has this shape. */
export const READING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'candidate_name',
    'candidate_contacts',
    'role',
    'source',
    'direction',
    'sent_at_text',
    'deadline_text',
    'links',
    'needs_reply',
    'existing_candidate_id',
  ],
  properties: {
    candidate_name: { type: ['string', 'null'] },
    candidate_contacts: { type: 'array', items: { type: 'string' } },
    role: { type: ['string', 'null'] },
    source: { type: ['string', 'null'], enum: [...SOURCES, null] },
    direction: { type: 'string', enum: ['in', 'out'] },
    sent_at_text: { type: ['string', 'null'] },
    deadline_text: { type: ['string', 'null'] },
    links: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'kind'],
        properties: { url: { type: 'string' }, kind: { type: 'string', enum: [...LINK_KINDS] } },
      },
    },
    needs_reply: { type: 'boolean' },
    existing_candidate_id: { type: ['string', 'null'] },
  },
} as const

export const SYSTEM_PROMPT = `You read one message that a recruiter pasted into her take-home tracker. It is a message from a job candidate to her, or her own message to a candidate, copied from iMessage, email, X, LinkedIn, Slack, WhatsApp, or similar. Return only what the paste says. Never guess.

- candidate_name: the candidate's name as written. Prefer a full name from a header or signature. For her own outgoing message, the person she writes to. Never the recruiter.
- candidate_contacts: the candidate's emails, @handles, and phone numbers that appear in the paste. Never the recruiter's.
- role: the job title the paste names, in sentence case. Null if the paste names none.
- source: "email", "x", "linkedin", "imessage", or "other" (Slack, WhatsApp, Telegram, Discord). Null when the paste does not show where it came from.
- direction: "out" when the recruiter wrote it, "in" when the candidate wrote it.
- sent_at_text: the timestamp of the message, copied exactly, such as "Fri, Oct 2, 9:14 AM" or "10:42 AM". Null if none.
- deadline_text: only in her outgoing message, the whole sentence or clause that sets the candidate's deadline, copied exactly, such as "You have 48 hours to finish it" or "Please send it by Friday 5pm ET". Null otherwise.
- links: every link in the paste, with kind "submission" (deployed app or demo video), "repo" (code repository), "doc" (the take-home assignment document), or "other". Skip links inside quoted earlier messages.
- needs_reply: true when the candidate's message asks her something or waits on her. False for a plain submission or thanks. False for her own messages.
- existing_candidate_id: the id of the known candidate this message is about, only when an email, handle, phone, link, or name clearly matches one of them. Null otherwise.`

/** The user message: the known candidates, then the paste. The recruiter's name keeps her out of the answer. */
/**
 * Only the known candidates that the paste mentions: a contact, a link, or a name word.
 * The model never sees the rest of her pipeline (D16).
 */
export function mentioned(paste: string, candidates: ExtractContext['candidates']) {
  const text = paste.toLowerCase()
  const digits = paste.replace(/\D/g, '')
  return candidates
    .filter(
      (c) =>
        c.contacts.some((x) =>
          x.startsWith('+') ? digits.includes(x.replace(/\D/g, '').slice(-10)) : text.includes(x),
        ) ||
        c.links.some((l) =>
          text.includes(
            l
              .replace(/^https?:\/\/(www\.)?/, '')
              .replace(/\/$/, '')
              .toLowerCase(),
          ),
        ) ||
        c.name
          .toLowerCase()
          .split(/\s+/)
          .some(
            (w) =>
              w.length >= 3 && new RegExp(`\\b${w.replace(/[^\p{L}]/gu, '')}`, 'iu').test(paste),
          ),
    )
    .slice(0, 20)
}

export function userPrompt(paste: string, ctx: ExtractContext): string {
  const known = mentioned(paste, ctx.candidates).map((c) => ({
    id: c.id,
    name: c.name,
    contacts: c.contacts,
    links: c.links,
  }))
  return [
    `Recruiter: ${ctx.self?.name ?? 'unknown'}${ctx.self?.email ? ` <${ctx.self.email}>` : ''}`,
    `Known candidates: ${JSON.stringify(known)}`,
    'Paste:',
    '"""',
    paste,
    '"""',
  ].join('\n')
}

const inPaste = (paste: string, value: string) =>
  paste.toLowerCase().includes(value.toLowerCase().trim())

/**
 * Turns the model's reading into a proposal. Anything the paste does not contain is dropped,
 * so an invented link, contact, or id never reaches her.
 */
export function proposalFromReading(r: ModelReading, paste: string, ctx: ExtractContext): Proposal {
  const pasted = new Set(findUrls(paste))
  const links: Link[] = []
  for (const l of r.links) {
    const url = normalizeUrl(l.url)
    if (url && pasted.has(url) && !links.some((x) => x.url === url))
      links.push({ url, kind: l.kind })
  }
  const self = ctx.self?.email?.toLowerCase()
  const contacts = r.candidate_contacts
    .filter(
      (c) =>
        inPaste(paste, c) || inPaste(paste.replace(/[\s().-]/g, ''), c.replace(/[\s().-]/g, '')),
    )
    .map(normalizeContact)
    .filter((c) => c && c !== self)
  const out = r.direction === 'out'
  const sentText = r.sent_at_text && inPaste(paste, r.sent_at_text) ? r.sent_at_text : null
  const dueText = out && r.deadline_text && inPaste(paste, r.deadline_text) ? r.deadline_text : null
  // Every word must be in the paste, so the model cannot borrow a surname from the known list.
  const allIn = (value: string | null) =>
    value?.trim() && value.split(/\s+/).every((w) => inPaste(paste, w)) ? value.trim() : null
  const name = allIn(r.candidate_name)
  const messageAt = sentText
    ? (parseStamp(sentText, ctx.now, ctx.zone) ?? parseClock(sentText, ctx.now, ctx.zone))
    : null
  const contactList = [...new Set(contacts)]
  // The model's pick is strong only when the paste shares real evidence with that candidate.
  // A pick on a first name alone is weak, like the rules', so it never attaches by default.
  const picked = ctx.candidates.find((c) => c.id === r.existing_candidate_id)
  const evidence = picked ? matchCandidate({ name, contacts: contactList, links }, [picked]) : null
  const match = picked
    ? {
        id: picked.id,
        strength: evidence?.strength ?? ('weak' as const),
        via: evidence?.via ?? picked.name,
      }
    : null
  return {
    name,
    contacts: contactList,
    role: allIn(r.role),
    source: r.source,
    direction: r.direction,
    messageAt,
    links,
    // "48 hours" counts from when she sent the message.
    deadline: dueText ? parseDeadline(dueText, messageAt ?? ctx.now, ctx.zone) : null,
    needsReply: !out && r.needs_reply,
    match,
  }
}

/**
 * Combines the two readings. The model decides who and what (name, role, source, direction,
 * reply, match). The rules keep what they read exactly: link addresses, contacts, and any time
 * or deadline the model left out.
 */
export function mergeProposals(rules: Proposal, model: Proposal): Proposal {
  const kinds = new Map(model.links.map((l) => [l.url, l.kind]))
  const links = rules.links.map((l) => ({ ...l, kind: kinds.get(l.url) ?? l.kind }))
  for (const l of model.links) if (!links.some((x) => x.url === l.url)) links.push(l)
  const strong = (p: Proposal) => (p.match?.strength === 'strong' ? p.match : null)
  return {
    name: model.name ?? rules.name,
    contacts: [...new Set([...model.contacts, ...rules.contacts])],
    role: model.role ?? rules.role,
    source: model.source ?? rules.source,
    direction: model.direction,
    // Times come from the rules when they read one: they see the day lines a copied time loses.
    messageAt: rules.messageAt ?? model.messageAt,
    links,
    deadline: model.direction === 'out' ? (rules.deadline ?? model.deadline) : null,
    needsReply: model.needsReply,
    match: strong(rules) ?? strong(model) ?? model.match ?? rules.match,
  }
}
