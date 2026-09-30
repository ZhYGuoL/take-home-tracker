import type { Page } from '@playwright/test'
import { deadlineAt } from '../../src/core/deadline'
import type { StoredRecord } from '../../src/core/records'
import type { Candidate, Entry, Link, Source, Stage } from '../../src/core/types'

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

/** Writes records where the app keeps them, then reloads so the app reads them. */
export async function seed(page: Page, items: Array<Candidate | Entry>) {
  await page.goto('/')
  await page.evaluate(async (recs) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('take-home-tracker')
      open.onupgradeneeded = () => open.result.createObjectStore('records')
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const tx = open.result.transaction('records', 'readwrite')
        tx.objectStore('records').put(recs, 'records:local')
        tx.oncomplete = () => {
          open.result.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
  }, records(items))
  await page.reload()
}
