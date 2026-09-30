import type { Applied, Candidate, Deadline, Entry, MessageEntry } from './types'

const same = (a: Deadline | null, b: Deadline | null) => JSON.stringify(a) === JSON.stringify(b)

export interface MoveResult {
  save: Array<Candidate | Entry>
  /** A candidate that only existed because of this message, and has nothing else now. */
  remove: Candidate[]
}

/**
 * Moves a pasted message to another candidate. What the paste added to the first candidate
 * (contacts, the take-home link, a deadline) goes with it, unless she changed it since.
 * A candidate that the paste created, and that has no other entries, is removed.
 */
export function moveMessage(
  entry: MessageEntry,
  from: Candidate,
  to: Candidate,
  fromEntries: readonly Entry[],
): MoveResult {
  const shell =
    from.createdFrom === entry.id &&
    !fromEntries.some((e) => e.candidateId === from.id && e.id !== entry.id)

  // What travels with the message.
  const carried: Applied = shell
    ? {
        contacts: from.contacts,
        takeHomeUrl: from.takeHomeUrl || null,
        deadline: from.deadline ? { before: null, after: from.deadline } : null,
      }
    : (entry.applied ?? { contacts: [], takeHomeUrl: null, deadline: null })

  const save: Array<Candidate | Entry> = []
  if (!shell) {
    const a = entry.applied
    save.push({
      ...from,
      contacts: from.contacts.filter((c) => !a?.contacts.includes(c)),
      takeHomeUrl: a?.takeHomeUrl && from.takeHomeUrl === a.takeHomeUrl ? '' : from.takeHomeUrl,
      deadline:
        a?.deadline && same(from.deadline, a.deadline.after) ? a.deadline.before : from.deadline,
    })
  }

  const contacts = carried.contacts.filter((c) => !to.contacts.includes(c))
  const takeHomeUrl = !to.takeHomeUrl && carried.takeHomeUrl ? carried.takeHomeUrl : null
  const deadline = carried.deadline ? carried.deadline.after : null
  save.push({
    ...to,
    contacts: [...to.contacts, ...contacts],
    takeHomeUrl: takeHomeUrl ?? to.takeHomeUrl,
    deadline: deadline ?? to.deadline,
  })
  save.push({
    ...entry,
    candidateId: to.id,
    applied: {
      contacts,
      takeHomeUrl,
      deadline: deadline ? { before: to.deadline, after: deadline } : null,
    },
  })
  return { save, remove: shell ? [from] : [] }
}
