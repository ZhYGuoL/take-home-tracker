import type { Deadline, Link, Source } from '../types'

/** A candidate the paste may belong to. */
export interface KnownCandidate {
  id: string
  name: string
  role: string
  contacts: string[]
  /** Submission and repo links from the candidate's own messages. Never her doc links. */
  links: string[]
}

export interface Match {
  id: string
  /** Strong: a shared email, handle, phone, link, or full name. Weak: only a first name. */
  strength: 'strong' | 'weak'
  /** What matched, such as an email address. Shown to her so she can judge it. */
  via: string
}

/** What the tracker proposes from a paste. She confirms or corrects every field. */
export interface Proposal {
  name: string | null
  contacts: string[]
  role: string | null
  source: Source | null
  direction: 'in' | 'out'
  /** When the message was sent, if the paste shows it. */
  messageAt: string | null
  links: Link[]
  /** A deadline the paste states, such as "48 hours" or "by Friday 5pm ET". */
  deadline: Deadline | null
  needsReply: boolean
  match: Match | null
}

export interface ExtractContext {
  /** When she pastes. Relative dates such as "48 hours" or "Friday" read from here. */
  now: string
  /** Her time zone. A time with no zone in the paste is read in it. */
  zone: string
  candidates: KnownCandidate[]
  /** The signed-in recruiter. Her own name and email are never read as the candidate's. */
  self?: { name: string | null; email: string | null }
}
