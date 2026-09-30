export const STAGES = ['sent', 'submitted', 'reviewing', 'advanced', 'passed'] as const
export type Stage = (typeof STAGES)[number]

export const STAGE_LABELS: Record<Stage, string> = {
  sent: 'Sent',
  submitted: 'Submitted',
  reviewing: 'Reviewing',
  advanced: 'Advanced',
  passed: 'Passed',
}

export const SOURCES = ['imessage', 'x', 'email', 'linkedin', 'other'] as const
export type Source = (typeof SOURCES)[number]

export const SOURCE_LABELS: Record<Source, string> = {
  imessage: 'iMessage',
  x: 'X',
  email: 'Email',
  linkedin: 'LinkedIn',
  other: 'Other',
}

export const FLAGS = ['overdue', 'late', 'needsReply'] as const
export type Flag = (typeof FLAGS)[number]

export const FLAG_LABELS: Record<Flag, string> = {
  overdue: 'Overdue',
  late: 'Late',
  needsReply: 'Needs reply',
}

/** An exact instant plus the IANA time zone the deadline was agreed in (D8). */
export interface Deadline {
  at: string
  zone: string
  /** True when only a date was agreed. `at` is then 23:59:59.999 of that date in `zone`. */
  dateOnly: boolean
}

export interface Candidate {
  id: string
  name: string
  role: string
  source: Source
  /** Emails, handles, and phone numbers, normalized by `normalizeContact`. */
  contacts: string[]
  /** When the take-home went out. */
  sentAt: string | null
  deadline: Deadline | null
  takeHomeUrl: string
  notes: string
  createdAt: string
}

export const LINK_KINDS = ['submission', 'repo', 'doc', 'other'] as const
export type LinkKind = (typeof LINK_KINDS)[number]

export interface Link {
  url: string
  kind: LinkKind
}

interface EntryBase {
  id: string
  candidateId: string
  /** When the thing happened, not when it was saved. */
  at: string
}

export interface MessageEntry extends EntryBase {
  kind: 'message'
  direction: 'in' | 'out'
  text: string
  source: Source
  links: Link[]
  needsReply: boolean
}

/** A stage that she set with an explicit click. The only way to reach Advanced or Passed (D9). */
export interface StageEntry extends EntryBase {
  kind: 'stage'
  stage: Stage
}

/** She opened the submission from the app. */
export interface OpenedEntry extends EntryBase {
  kind: 'opened'
  url: string
}

/** She replied to the candidate outside the app. */
export interface RepliedEntry extends EntryBase {
  kind: 'replied'
}

export type Entry = MessageEntry | StageEntry | OpenedEntry | RepliedEntry
