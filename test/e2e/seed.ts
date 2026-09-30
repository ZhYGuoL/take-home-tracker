import type { Page } from '@playwright/test'
import { deadlineAt } from '../../src/core/deadline'
import type { StoredRecord } from '../../src/core/records'
import { toRow } from '../../src/core/rows'
import type { Candidate, Entry, Link, Source, Stage } from '../../src/core/types'
import { FAKE_GOOGLE_URL } from '../../src/shared/fake-google'

let seq = 0
const id = (p: string) => `${p}-${++seq}`

export function person(
  name: string,
  opts: Partial<Omit<Candidate, 'deadline'>> & {
    due?: [date: string, time: string | null, zone: string]
  } = {},
): Candidate {
  const { due, ...rest } = opts
  return {
    id: id('c'),
    name,
    role: 'Founding engineer',
    source: 'imessage' as Source,
    contacts: [],
    sentAt: '2026-09-28T16:00:00.000Z',
    takeHomeUrl: '',
    notes: '',
    createdAt: '2026-09-28T16:00:00.000Z',
    ...rest,
    deadline: due ? deadlineAt(...due) : null,
  }
}

export const submitted = (
  c: Candidate,
  at: string,
  url = `https://${c.id}.example.com`,
): Entry => ({
  id: id('e'),
  candidateId: c.id,
  kind: 'message',
  at,
  direction: 'in',
  text: '',
  source: c.source,
  links: [{ url, kind: 'submission' } satisfies Link],
  needsReply: false,
})

export const asked = (c: Candidate, at: string, text = 'Can I use a hosted database?'): Entry => ({
  id: id('e'),
  candidateId: c.id,
  kind: 'message',
  at,
  direction: 'in',
  text,
  source: c.source,
  links: [],
  needsReply: true,
})

export const staged = (c: Candidate, at: string, stage: Stage): Entry => ({
  id: id('e'),
  candidateId: c.id,
  kind: 'stage',
  at,
  stage,
})

export const openedAt = (c: Candidate, at: string): Entry => ({
  id: id('e'),
  candidateId: c.id,
  kind: 'opened',
  at,
  url: `https://${c.id}.example.com`,
})

function records(items: Array<Candidate | Entry>): StoredRecord[] {
  return items.map(
    (data): StoredRecord =>
      'kind' in data
        ? { id: data.id, type: 'entry', updatedAt: data.at, deleted: false, data }
        : { id: data.id, type: 'candidate', updatedAt: data.createdAt, deleted: false, data },
  )
}

/**
 * Writes records into the signed-in person's Sheet in the fake Google, then opens the app,
 * which reads them. Avery Stone is the person the saved session belongs to.
 */
export async function seed(page: Page, items: Array<Candidate | Entry>, sub = 'fake-avery') {
  const res = await page.request.post(`${FAKE_GOOGLE_URL}/__seed`, {
    data: { sub, rows: records(items).map(toRow) },
  })
  if (!res.ok()) throw new Error(`seed failed: ${res.status()}`)
  await page.goto('/')
}
