import { describe, expect, it } from 'vitest'
import { derive } from './derive'
import { extractWithRules } from './extract/rules'
import type { KnownCandidate } from './extract/types'
import { pasteDraft, pasteRecords } from './paste'
import { candidate, stage } from './testing/fixtures'

const LA = 'America/Los_Angeles'
const NOW = Date.parse('2026-09-30T20:00:00.000Z')
const ids = { candidate: 'c-new', entry: 'e-new' }

function read(paste: string, known: KnownCandidate[] = []) {
  const p = extractWithRules(paste, {
    now: new Date(NOW).toISOString(),
    zone: LA,
    candidates: known,
    self: { name: 'Rae Lin', email: 'rae@example.com' },
  })
  return pasteDraft(p, paste, LA, NOW, null)
}

const submissionEmail = `From: Priya Raman <priya.raman@example.com>
Date: Wed, Sep 30, 2026 at 11:42 AM
Subject: Take-home submission

Hi Rae, here it is: https://ledgerline-priya.netlify.app and https://github.com/ex-praman/ledgerline

Best,
Priya`

describe('a paste from a new candidate', () => {
  it('prefills name, contact, links, and the time it was sent', () => {
    const d = read(submissionEmail)
    expect(d.target).toBe('new')
    expect(d.candidate.name).toBe('Priya Raman')
    expect(d.candidate.contacts).toBe('priya.raman@example.com')
    expect(d.candidate.source).toBe('email')
    expect([d.messageDate, d.messageTime]).toEqual(['2026-09-30', '11:42'])
    expect(d.links.map((l) => l.kind)).toEqual(['submission', 'repo'])
  })

  it('saves a candidate whose stage is Submitted, at the time the email was sent', () => {
    const { candidate: c, entry } = pasteRecords(read(submissionEmail), LA, null, ids, NOW)
    expect(c.name).toBe('Priya Raman')
    expect(entry.at).toBe('2026-09-30T18:42:00.000Z')
    const d = derive(c, [entry])
    expect(d.stage).toBe('submitted')
    expect(d.submittedAt).toBe('2026-09-30T18:42:00.000Z')
  })

  it('keeps her corrections', () => {
    const d = read(submissionEmail)
    d.candidate.name = 'Priya R. Raman'
    d.links = d.links.map((l) => (l.kind === 'repo' ? { ...l, kind: 'other' } : l))
    const { candidate: c, entry } = pasteRecords(d, LA, null, ids, NOW)
    expect(c.name).toBe('Priya R. Raman')
    expect(entry.links.map((l) => l.kind)).toEqual(['submission', 'other'])
  })
})

describe('her own message sending the take-home', () => {
  const send = `Hi Nadia, here is the take-home assignment: https://docs.google.com/document/d/1Ex/edit
Please submit by Friday 5pm ET.`

  it('proposes a Sent candidate with the doc and the deadline', () => {
    const { candidate: c, entry } = pasteRecords(read(send), LA, null, ids, NOW)
    expect(c.name).toBe('Nadia')
    expect(c.takeHomeUrl).toBe('https://docs.google.com/document/d/1Ex/edit')
    expect(c.deadline).toEqual({
      at: '2026-10-02T21:00:00.000Z',
      zone: 'America/New_York',
      dateOnly: false,
    })
    expect(c.sentAt).toBe('2026-09-30T20:00:00.000Z')
    expect(entry.direction).toBe('out')
    expect(derive(c, [entry]).stage).toBe('sent')
  })
})

describe('a second paste from the same candidate', () => {
  const priya = candidate({
    id: 'c-priya',
    name: 'Priya Raman',
    contacts: ['priya.raman@example.com'],
  })
  const known: KnownCandidate[] = [
    { id: priya.id, name: priya.name, role: priya.role, contacts: priya.contacts, links: [] },
  ]

  it('attaches to her, and adds a new contact without a duplicate', () => {
    const d = read(`${submissionEmail}\n(555) 010-0142`, known)
    expect(d.target).toBe('c-priya')
    const { candidate: c, entry } = pasteRecords(d, LA, priya, ids, NOW)
    expect(c.id).toBe('c-priya')
    expect(entry.candidateId).toBe('c-priya')
    expect(c.contacts).toEqual(['priya.raman@example.com', '+15550100142'])
  })

  it('never changes an Advanced candidate, even with a new submission link', () => {
    const d = read(submissionEmail, known)
    const { candidate: c, entry } = pasteRecords(d, LA, priya, ids, NOW)
    const advanced = stage(priya, '2026-09-30T10:00:00.000Z', 'advanced')
    expect(derive(c, [advanced, entry]).stage).toBe('advanced')
  })

  it('a paste with no stated deadline keeps the one she has', () => {
    const due = { at: '2026-10-09T00:00:00.000Z', zone: LA, dateOnly: false }
    const { candidate: c } = pasteRecords(
      read(submissionEmail, known),
      LA,
      { ...priya, deadline: due },
      ids,
      NOW,
    )
    expect(c.deadline).toEqual(due)
  })
})

describe('a first name alone', () => {
  it('does not attach, because another person can share it', () => {
    const sam = candidate({ id: 'c-sam', name: 'Samantha Patel' })
    const known: KnownCandidate[] = [
      { id: sam.id, name: sam.name, role: '', contacts: [], links: [] },
    ]
    const d = read(`hey it's Sam - here's my submission https://sam-app.vercel.app`, known)
    expect(d.target).toBe('new')
  })
})

describe('limits', () => {
  it('keeps at most 20,000 characters of a paste', () => {
    expect(read('x'.repeat(30_000)).text).toHaveLength(20_000)
  })
})
