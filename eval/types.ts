import type { LinkKind, Source } from '../src/core/types'

/** A candidate already in the tracker, for the attach tests. */
export interface RosterEntry {
  id: string
  name: string
  role: string
  contacts: string[]
  links: string[]
}

/** What a correct reading of the paste says. `null` means the paste does not say. */
export interface Expected {
  name: string | null
  contacts: string[]
  role: string | null
  source: Source | null
  direction: 'in' | 'out'
  /** When the message was sent, if the paste shows it. ISO instant. */
  messageAt: string | null
  links: Array<{ url: string; kind: LinkKind }>
  /** A deadline the paste states. ISO instant. */
  deadline: string | null
  needsReply: boolean
  /** The roster id this paste belongs to, or null for a new candidate. */
  match: string | null
}

export interface Case {
  id: string
  /** What she pastes, exactly as copied. Fictional. */
  paste: string
  /** When she pastes it, and her zone. Relative dates read from here. */
  pastedAt: string
  zone: string
  expected: Expected
}
