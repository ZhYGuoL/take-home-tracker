import { describe, expect, it } from 'vitest'
import { moveMessage } from './move'
import { candidate, message } from './testing/fixtures'
import type { Candidate, Deadline, MessageEntry } from './types'

const due: Deadline = { at: '2026-10-02T21:00:00.000Z', zone: 'America/New_York', dateOnly: false }
const earlier: Deadline = {
  at: '2026-10-01T21:00:00.000Z',
  zone: 'America/New_York',
  dateOnly: false,
}

function attached(to: Candidate): MessageEntry {
  return {
    ...message(to, '2026-09-30T20:00:00Z'),
    applied: {
      contacts: ['sam.okafor@example.com'],
      takeHomeUrl: 'https://docs.example.com/brief',
      deadline: { before: earlier, after: due },
    },
  }
}

describe('moveMessage', () => {
  it('takes back what the paste added to the wrong candidate and gives it to the right one', () => {
    const wrong = candidate({
      name: 'Sam Patel',
      contacts: ['sam.patel@example.com', 'sam.okafor@example.com'],
      takeHomeUrl: 'https://docs.example.com/brief',
      deadline: due,
    })
    const right = candidate({ name: 'Sam Okafor' })
    const entry = attached(wrong)
    const { save, remove } = moveMessage(entry, wrong, right, [entry])
    const [fromAfter, toAfter, moved] = save as [Candidate, Candidate, MessageEntry]
    expect(fromAfter.contacts).toEqual(['sam.patel@example.com'])
    expect(fromAfter.takeHomeUrl).toBe('')
    expect(fromAfter.deadline).toEqual(earlier)
    expect(toAfter.contacts).toEqual(['sam.okafor@example.com'])
    expect(toAfter.takeHomeUrl).toBe('https://docs.example.com/brief')
    expect(toAfter.deadline).toEqual(due)
    expect(moved.candidateId).toBe(right.id)
    expect(remove).toEqual([])
  })

  it('leaves a field she changed after the paste', () => {
    const wrong = candidate({ contacts: [], deadline: { ...due, at: '2026-10-05T21:00:00.000Z' } })
    const entry = attached(wrong)
    const [fromAfter] = moveMessage(entry, wrong, candidate(), [entry]).save as [Candidate]
    expect(fromAfter.deadline?.at).toBe('2026-10-05T21:00:00.000Z')
  })

  it('removes a candidate the paste created when the message was all it had', () => {
    const shell = candidate({ name: 'Sam', contacts: ['sam.okafor@example.com'], deadline: due })
    const entry = message(shell, '2026-09-30T20:00:00Z')
    const created = { ...shell, createdFrom: entry.id }
    const right = candidate({ name: 'Sam Okafor' })
    const { save, remove } = moveMessage(entry, created, right, [entry])
    expect(remove.map((c) => c.id)).toEqual([created.id])
    const [toAfter] = save as [Candidate]
    expect(toAfter.contacts).toEqual(['sam.okafor@example.com'])
    expect(toAfter.deadline).toEqual(due)
  })

  it('keeps a created candidate that has other entries now', () => {
    const shell = candidate()
    const entry = message(shell, '2026-09-30T20:00:00Z')
    const other = message(shell, '2026-10-01T20:00:00Z')
    const { remove } = moveMessage(entry, { ...shell, createdFrom: entry.id }, candidate(), [
      entry,
      other,
    ])
    expect(remove).toEqual([])
  })
})
